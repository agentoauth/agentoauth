import { SignJWT, importJWK, type JWK } from 'jose';
import { AgentOAuthPayload, AgentOAuthError } from './types.js';
import { validatePayload } from './schema.js';

/**
 * Creates a signed AgentOAuth authorization token.
 * 
 * This function validates the payload against the AgentOAuth v0.1 schema,
 * signs it with the provided private key using EdDSA (Ed25519) or ES256K,
 * and returns a JWS compact serialization token.
 * 
 * @param payload - The authorization payload containing user, agent, scope, limits, etc.
 * @param privateKey - Private key in JWK (JSON Web Key) format for signing
 * @param kid - Key identifier to include in the JWT header (for key rotation support)
 * 
 * @returns A JWS compact token string (header.payload.signature)
 * 
 * @throws {AgentOAuthError} With code 'INVALID_PAYLOAD' if payload validation fails
 * @throws {AgentOAuthError} With code 'INVALID_KEY' if the private key is invalid
 * 
 * @example
 * ```typescript
 * import { request } from '@agentoauth/sdk';
 * import { generateKeyPair, exportJWK } from 'jose';
 * 
 * // Generate keys
 * const { privateKey } = await generateKeyPair('EdDSA');
 * const privateJWK = await exportJWK(privateKey);
 * 
 * // Create token
 * const token = await request({
 *   ver: '0.1',
 *   user: 'did:example:alice',
 *   agent: 'payment-bot@myapp',
 *   scope: 'pay:merchant',
 *   limit: { amount: 1000, currency: 'USD' },
 *   exp: Math.floor(Date.now() / 1000) + 3600,
 *   nonce: crypto.randomUUID()
 * }, privateJWK, 'key-2025-01');
 * ```
 */
export async function request(
  payload: AgentOAuthPayload,
  privateKey: JWK,
  kid: string
): Promise<string> {
  // Validate input parameters
  if (!payload || typeof payload !== 'object') {
    throw new AgentOAuthError(
      'Payload must be a valid object',
      'INVALID_PAYLOAD',
      { received: typeof payload }
    );
  }

  if (!privateKey || typeof privateKey !== 'object') {
    throw new AgentOAuthError(
      'Private key must be a valid JWK object',
      'INVALID_KEY',
      { received: typeof privateKey }
    );
  }

  if (!kid || typeof kid !== 'string' || kid.trim().length === 0) {
    throw new AgentOAuthError(
      'Key ID (kid) must be a non-empty string',
      'INVALID_KEY',
      { received: kid }
    );
  }

  // Auto-generate jti if not provided
  if (!payload.jti || payload.jti.trim().length === 0) {
    (payload as any).jti = crypto.randomUUID();
  }

  // Validate payload structure against JSON schema
  if (!validatePayload(payload)) {
    const errors = validatePayload.errors?.map(e => 
      `${e.instancePath || 'root'} ${e.message}`
    ).join('; ');
    
    throw new AgentOAuthError(
      `Payload validation failed: ${errors}`,
      'INVALID_PAYLOAD',
      { validationErrors: validatePayload.errors }
    );
  }

  try {
    // Import private key
    const key = await importJWK(privateKey, privateKey.alg);

    // Create and sign JWT
    const jwt = await new SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({
        alg: privateKey.alg || 'EdDSA',
        kid,
        typ: 'JWT'
      })
      .sign(key);

    return jwt;
  } catch (error) {
    // Handle key import or signing errors
    if (error instanceof AgentOAuthError) {
      throw error;
    }
    
    throw new AgentOAuthError(
      `Failed to sign token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'INVALID_KEY',
      { originalError: error }
    );
  }
}

