// SPDX-License-Identifier: MIT
// Interop runner: bridges the Python AgentOAuth implementation to the canonical
// TypeScript one. Uses `jose` (the exact library the TS SDK/verifier sign and
// verify with) and the REAL canonicalize.ts from packages/verifier-api.
//
// Paths are injected as absolute paths via env (JOSE_PATH, CANON_PATH) so this
// runs regardless of cwd. Run with tsx. Subcommand in argv[2]; JSON on stdin.
//
//   hash    stdin: [policy, ...]            -> { hashes: [ "sha256:..", .. ] }
//   verify  stdin: { jws, jwk }             -> { valid: bool, payload?, error? }
//   sign    stdin: { claims }               -> { jws, jwk }   (TS-signed, EdDSA)

const jose: any = await import(process.env.JOSE_PATH as string);
const canon: any = await import(process.env.CANON_PATH as string);

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

const cmd = process.argv[2];
const input = (await readStdin()).trim();
const payload = input ? JSON.parse(input) : {};

if (cmd === 'hash') {
  const hashes = (payload as any[]).map((p) => canon.hashPolicy(p));
  process.stdout.write(JSON.stringify({ hashes }));
} else if (cmd === 'verify') {
  try {
    const key = await jose.importJWK(payload.jwk, 'EdDSA');
    const { payload: claims, protectedHeader } = await jose.jwtVerify(payload.jws, key);
    process.stdout.write(JSON.stringify({ valid: true, header: protectedHeader, payload: claims }));
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ valid: false, error: String(e && e.message || e) }));
  }
} else if (cmd === 'sign') {
  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA');
  const jwk = await jose.exportJWK(publicKey);
  jwk.alg = 'EdDSA';
  jwk.use = 'sig';
  const jws = await new jose.SignJWT(payload.claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'ts-key', typ: 'JWT' })
    .sign(privateKey);
  process.stdout.write(JSON.stringify({ jws, jwk }));
} else {
  process.stderr.write(`unknown command: ${cmd}\n`);
  process.exit(2);
}
