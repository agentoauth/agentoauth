import { generateKeyPair, exportJWK } from 'jose';
import { request, verify } from './index.js';
import { AgentOAuthPayload } from './types.js';
import { writeFile } from 'fs/promises';

/**
 * Issue a consent token with automatic key management
 */
export async function issueConsent(options: {
  user: string;
  agent: string;
  scope: string;
  limit: { amount: number; currency: string };
  audience?: string;
  expiresIn?: string | number; // "1h", 3600, etc.
  privateKey?: any; // Auto-generate if not provided
  keyId?: string;
}): Promise<{ token: string; keyId: string; publicKey: any }> {
  // Auto-generate keys if not provided
  if (!options.privateKey) {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const publicJWK = await exportJWK(publicKey);
    const privateJWK = await exportJWK(privateKey);
    
    publicJWK.kid = options.keyId || `key-${Date.now()}`;
    publicJWK.use = 'sig';
    publicJWK.alg = 'EdDSA';
    
    const payload: AgentOAuthPayload = {
      ver: '0.2' as const,
      user: options.user,
      agent: options.agent,
      scope: options.scope,
      limit: options.limit,
      aud: options.audience,
      exp: Math.floor(Date.now() / 1000) + parseExpiresIn(options.expiresIn || '1h'),
      nonce: crypto.randomUUID()
    };
    
    const token = await request(payload, privateJWK, publicJWK.kid);
    
    return { token, keyId: publicJWK.kid!, publicKey: publicJWK };
  }
  
  // Use provided key
  const payload: AgentOAuthPayload = {
    ver: '0.2' as const,
    user: options.user,
    agent: options.agent,
    scope: options.scope,
    limit: options.limit,
    aud: options.audience,
    exp: Math.floor(Date.now() / 1000) + parseExpiresIn(options.expiresIn || '1h'),
    nonce: crypto.randomUUID()
  };
  
  const token = await request(payload, options.privateKey, options.keyId || 'provided-key');
  
  return { 
    token, 
    keyId: options.keyId || 'provided-key', 
    publicKey: null // User should provide public key separately
  };
}

/**
 * Verify a consent token with clear error handling
 */
export async function verifyConsent(
  token: string,
  options: { audience?: string; jwksUrl?: string; publicKey?: any } = {}
): Promise<{
  valid: boolean;
  payload?: AgentOAuthPayload;
  error?: { code: string; message: string; suggestion?: string };
}> {
  try {
    const result = await verify(token, options.publicKey, options);
    
    if (!result.valid) {
      return {
        valid: false,
        error: {
          code: result.code || 'VERIFICATION_FAILED',
          message: result.error || 'Token verification failed',
          suggestion: getSuggestionForError(result.code)
        }
      };
    }
    
    return { valid: true, payload: result.payload };
  } catch (error) {
    return {
      valid: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your token format and try again'
      }
    };
  }
}

/**
 * Revoke a consent token
 */
export async function revokeConsent(
  jti: string,
  options: { apiUrl?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = options.apiUrl || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${apiUrl}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jti })
    });
    
    const result = await response.json() as { success: boolean; error?: string };
    
    return {
      success: result.success,
      error: result.success ? undefined : result.error
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Rotate keys and update JWKS
 */
export async function rotateKeys(options: {
  currentKeys: any[];
  jwksPath?: string;
}): Promise<{ newKey: any; updatedJwks: any }> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = `key-${Date.now()}`;
  publicJWK.use = 'sig';
  publicJWK.alg = 'EdDSA';
  
  const updatedJwks = {
    keys: [...options.currentKeys, publicJWK]
  };
  
  // Auto-save if path provided
  if (options.jwksPath) {
    await writeFile(options.jwksPath, JSON.stringify(updatedJwks, null, 2));
  }
  
  return { newKey: publicJWK, updatedJwks };
}

/**
 * Parse expiresIn string or number to seconds
 */
function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  
  const match = expiresIn.match(/^(\d+)([smhd]?)$/);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}. Use "1h", "30m", "3600", etc.`);
  }
  
  const [, num, unit] = match;
  const value = parseInt(num, 10);
  
  switch (unit) {
    case 's': case '': return value; // seconds (default)
    case 'm': return value * 60; // minutes
    case 'h': return value * 3600; // hours
    case 'd': return value * 86400; // days
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Get helpful suggestion for error codes
 */
function getSuggestionForError(code?: string): string {
  switch (code) {
    case 'EXPIRED':
      return 'The token has expired. Generate a new token with a longer expiration time.';
    case 'INVALID_SIGNATURE':
      return 'The token signature is invalid. Ensure you are using the correct public key.';
    case 'INVALID_AUDIENCE':
      return 'The token audience does not match. Check the expected audience value.';
    case 'REVOKED':
      return 'This token has been revoked and can no longer be used.';
    case 'REPLAY':
      return 'This token has already been used. Generate a new token for each request.';
    case 'INVALID_PAYLOAD':
      return 'The token payload is malformed. Check required fields and format.';
    default:
      return 'Check the token format and verification parameters.';
  }
}
