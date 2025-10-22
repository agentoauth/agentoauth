import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { AgentOAuthPayload, VerifyOptions, VerificationResult } from './types.js';
import { validatePayload } from './schema.js';

/**
 * Verifies an AgentOAuth token's signature, expiration, and claims.
 * 
 * This function performs complete token verification including:
 * - Signature validation using the public key from JWKS
 * - Expiration check (with configurable clock skew)
 * - Audience validation (if specified)
 * - Payload schema validation
 * - Protocol version check
 * 
 * @param token - JWS compact token string to verify
 * @param jwksUrl - URL to JWKS endpoint containing public keys (e.g., https://issuer.example/.well-known/jwks.json)
 * @param options - Optional verification settings
 * @param options.audience - Expected audience value (must match token's aud field)
 * @param options.clockSkew - Clock skew tolerance in seconds (default: 60)
 * @param options.currentTime - Override current time for testing (Unix timestamp in seconds)
 * 
 * @returns Verification result with valid flag, payload (if valid), or error details
 * 
 * @example
 * ```typescript
 * import { verify } from '@agentoauth/sdk';
 * 
 * const result = await verify(
 *   token,
 *   'https://auth.example/.well-known/jwks.json',
 *   {
 *     audience: 'merchant-123.example',
 *     clockSkew: 60
 *   }
 * );
 * 
 * if (result.valid) {
 *   console.log('Authorized:', result.payload.user);
 *   console.log('Scope:', result.payload.scope);
 *   console.log('Limit:', result.payload.limit);
 * } else {
 *   console.error('Verification failed:', result.error);
 *   console.error('Error code:', result.code);
 * }
 * ```
 * 
 * @remarks
 * Error codes returned in result.code:
 * - INVALID_SIGNATURE: Signature verification failed or token malformed
 * - EXPIRED: Token expiration time has passed
 * - INVALID_AUDIENCE: Audience claim doesn't match expected value
 * - INVALID_PAYLOAD: Payload doesn't conform to schema
 * - INVALID_VERSION: Protocol version is not supported
 * - NETWORK_ERROR: Failed to fetch JWKS from the provided URL
 */
export async function verify(
  token: string,
  jwksUrl: string,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const {
    audience,
    clockSkew = 60,
    currentTime
  } = options;

  // Validate inputs
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token must be a non-empty string',
      code: 'INVALID_SIGNATURE'
    };
  }

  if (!jwksUrl || typeof jwksUrl !== 'string') {
    return {
      valid: false,
      error: 'JWKS URL must be a valid string',
      code: 'NETWORK_ERROR'
    };
  }

  try {
    // Validate and create JWKS fetcher
    let jwksUrlParsed: URL;
    try {
      jwksUrlParsed = new URL(jwksUrl);
    } catch {
      return {
        valid: false,
        error: `Invalid JWKS URL format: ${jwksUrl}`,
        code: 'NETWORK_ERROR'
      };
    }

    const JWKS = createRemoteJWKSet(jwksUrlParsed);

    // Verify signature and decode
    const { payload } = await jwtVerify(token, JWKS, {
      clockTolerance: clockSkew,
      currentDate: currentTime ? new Date(currentTime * 1000) : undefined
    });

    // Validate payload structure
    if (!validatePayload(payload)) {
      const errors = validatePayload.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
      return {
        valid: false,
        error: `Invalid payload structure: ${errors}`,
        code: 'INVALID_PAYLOAD'
      };
    }

    const typedPayload = payload as unknown as AgentOAuthPayload;

    // Check version (support both 0.1 and 0.2)
    if (typedPayload.ver !== '0.2' && typedPayload.ver !== '0.1') {
      return {
        valid: false,
        error: `Unsupported version: ${typedPayload.ver}`,
        code: 'INVALID_VERSION'
      };
    }

    // Check audience if specified
    if (audience && typedPayload.aud !== audience) {
      return {
        valid: false,
        error: `Audience mismatch: expected ${audience}, got ${typedPayload.aud}`,
        code: 'INVALID_AUDIENCE'
      };
    }

    // Check expiration (jose handles this, but we double-check)
    const now = currentTime || Math.floor(Date.now() / 1000);
    if (typedPayload.exp < now - clockSkew) {
      return {
        valid: false,
        error: 'Token expired',
        code: 'EXPIRED'
      };
    }

    return {
      valid: true,
      payload: typedPayload
    };

  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Handle specific jose errors
      if (errorMessage.includes('expired') || errorMessage.includes('exp')) {
        return {
          valid: false,
          error: 'Token expired',
          code: 'EXPIRED'
        };
      }
      
      if (errorMessage.includes('signature')) {
        return {
          valid: false,
          error: 'Invalid signature',
          code: 'INVALID_SIGNATURE'
        };
      }
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        return {
          valid: false,
          error: `Failed to fetch JWKS from ${jwksUrl}: ${error.message}`,
          code: 'NETWORK_ERROR'
        };
      }
      
      return {
        valid: false,
        error: `Verification failed: ${error.message}`,
        code: 'INVALID_SIGNATURE'
      };
    }
    
    return {
      valid: false,
      error: 'Unknown verification error',
      code: 'INVALID_SIGNATURE'
    };
  }
}

