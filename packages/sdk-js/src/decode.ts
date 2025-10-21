import { AgentOAuthError, type DecodedToken } from './types.js';

/**
 * Decodes an AgentOAuth token without verification.
 * 
 * This is useful for debugging and inspecting token contents without
 * validating the signature. **Do not use decoded tokens for authorization
 * decisions** - always use `verify()` for that.
 * 
 * @param token - JWS compact token string to decode
 * 
 * @returns Decoded token with header and payload
 * 
 * @throws {AgentOAuthError} With code 'DECODE_ERROR' if token format is invalid
 * 
 * @example
 * ```typescript
 * import { decode } from '@agentoauth/sdk';
 * 
 * const { header, payload } = decode(token);
 * 
 * console.log('Algorithm:', header.alg);
 * console.log('Key ID:', header.kid);
 * console.log('User:', payload.user);
 * console.log('Expires:', new Date(payload.exp * 1000));
 * ```
 * 
 * @remarks
 * This function only decodes the token structure. It does NOT:
 * - Verify the signature
 * - Check expiration
 * - Validate the audience
 * - Verify the payload schema
 * 
 * Always use `verify()` for security-critical operations.
 */
export function decode(token: string): DecodedToken {
  // Validate input
  if (!token || typeof token !== 'string') {
    throw new AgentOAuthError(
      'Token must be a non-empty string',
      'DECODE_ERROR',
      { received: typeof token }
    );
  }

  // Split JWT into parts
  const parts = token.split('.');
  
  if (parts.length !== 3) {
    throw new AgentOAuthError(
      'Invalid JWT format: must have exactly 3 parts (header.payload.signature)',
      'DECODE_ERROR',
      { parts: parts.length }
    );
  }

  try {
    // Decode header (base64url)
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);

    // Decode payload (base64url)
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Validate basic structure
    if (!header || typeof header !== 'object') {
      throw new Error('Header is not a valid object');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is not a valid object');
    }

    return {
      header: header as DecodedToken['header'],
      payload: payload as DecodedToken['payload']
    };

  } catch (error) {
    if (error instanceof AgentOAuthError) {
      throw error;
    }

    throw new AgentOAuthError(
      `Failed to decode token: ${error instanceof Error ? error.message : 'Invalid base64 or JSON'}`,
      'DECODE_ERROR',
      { originalError: error }
    );
  }
}

