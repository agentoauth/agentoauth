import { generateKeyPair, exportJWK, type JWK } from 'jose';

export interface KeyPair {
  publicJWK: JWK;
  privateJWK: JWK;
  kid: string;
}

/**
 * Generate an Ed25519 key pair for demo purposes
 */
export async function generateDemoKeyPair(): Promise<KeyPair> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  
  const publicJWK = await exportJWK(publicKey);
  const privateJWK = await exportJWK(privateKey);
  
  const kid = `key-${Date.now()}`;
  publicJWK.kid = kid;
  publicJWK.use = 'sig';
  publicJWK.alg = 'EdDSA';
  
  return {
    publicJWK,
    privateJWK,
    kid
  };
}

