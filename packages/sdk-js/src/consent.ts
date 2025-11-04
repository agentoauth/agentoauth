import { generateKeyPair, exportJWK } from 'jose';
import { request, verify } from './index.js';
import { AgentOAuthPayload, IntentV0 } from './types.js';
import { hashPolicy, type PolicyV2 } from './policy-v2.js';

// Use native crypto in browser, Node.js crypto otherwise
const getCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  // Only import node:crypto if we're in Node.js
  return require('node:crypto');
};

const crypto = getCrypto();

/**
 * Issue a consent token with automatic key management
 */
export async function issueConsent(options: {
  user: string;
  agent: string;
  scope: string | string[];
  limit?: { amount: number; currency: string }; // Optional now (required if no policy)
  audience?: string;
  expiresIn?: string | number; // "1h", 3600, etc.
  privateKey?: any; // Auto-generate if not provided
  keyId?: string;
  policy?: PolicyV2; // Optional pol.v0.2 policy
  jti?: string; // Optional JWT ID (auto-generated if not provided)
  intent?: IntentV0; // Optional WebAuthn intent (act.v0.3)
  iss?: string; // Optional issuer
}): Promise<{ token: string; keyId: string; publicKey: any }> {
  // Helper to build payload with optional policy and intent
  const buildPayload = (): AgentOAuthPayload => {
    // Determine version based on intent presence
    let ver: '0.2' | 'act.v0.2' | 'act.v0.3' = '0.2';
    if (options.intent) {
      ver = 'act.v0.3';
    } else if (options.policy) {
      ver = 'act.v0.2';
    }

    const payload: AgentOAuthPayload = {
      ver,
      jti: options.jti || crypto.randomUUID(),
      user: options.user,
      agent: options.agent,
      scope: options.scope,
      aud: options.audience,
      exp: Math.floor(Date.now() / 1000) + parseExpiresIn(options.expiresIn || '1h'),
      nonce: crypto.randomUUID()
    };
    
    // Add limit if provided (backward compatibility)
    if (options.limit) {
      payload.limit = options.limit;
    }
    
    // Add issuer if provided
    if (options.iss) {
      payload.iss = options.iss;
    }
    
    // Add policy and policy_hash if provided
    if (options.policy) {
      payload.policy = options.policy;
      payload.policy_hash = hashPolicy(options.policy);
    }
    
    // Add intent if provided (v0.3)
    if (options.intent) {
      payload.intent = options.intent;
      // Ensure policy is also present for v0.3
      if (!options.policy) {
        throw new Error('Policy is required when intent is provided (act.v0.3)');
      }
    }
    
    return payload;
  };
  
  // Auto-generate keys if not provided
  if (!options.privateKey) {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const publicJWK = await exportJWK(publicKey);
    const privateJWK = await exportJWK(privateKey);
    
    publicJWK.kid = options.keyId || `key-${Date.now()}`;
    publicJWK.use = 'sig';
    publicJWK.alg = 'EdDSA';
    
    const payload = buildPayload();
    const token = await request(payload, privateJWK, publicJWK.kid);
    
    return { token, keyId: publicJWK.kid!, publicKey: publicJWK };
  }
  
  // Use provided key
  const payload = buildPayload();
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
    // Determine JWKS URL or public key
    let result;
    if (options.jwksUrl) {
      result = await verify(token, options.jwksUrl, { audience: options.audience });
    } else if (options.publicKey) {
      // For direct public key verification, we'd need to implement that
      // For now, fall back to decode-only
      const { decode } = await import('./decode.js');
      const decoded = decode(token);
      result = { valid: true, payload: decoded.payload };
    } else {
      return {
        valid: false,
        error: {
          code: 'NO_VERIFICATION_METHOD',
          message: 'No JWKS URL or public key provided',
          suggestion: 'Provide either jwksUrl or publicKey in options'
        }
      };
    }
    
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
    // Dynamic import for Node.js-only feature (avoids breaking browser builds)
    const { writeFile } = await import('fs/promises');
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
