/**
 * Intent Validation Module (Cloudflare Workers)
 * 
 * Validates WebAuthn intents (webauthn.v0) for act.v0.3 tokens.
 * Uses Web Crypto API for Workers compatibility.
 */

/**
 * Intent validation result
 */
export interface IntentValidationResult {
  /** Whether the intent is valid */
  valid: boolean;
  /** Whether the intent has expired */
  expired: boolean;
  /** Error reason if invalid */
  reason?: string;
  /** Error code for programmatic handling */
  code?: 'INTENT_EXPIRED' | 'INTENT_INVALID' | 'INTENT_POLICY_MISMATCH';
  /** Remaining days until expiry (if valid) */
  remainingDays?: number;
}

/**
 * Base64url decode helper (Workers-compatible)
 */
function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validate a WebAuthn intent (Workers-compatible)
 * 
 * Note: This is a basic validation for demo/testing purposes.
 * Production systems should perform full WebAuthn signature verification
 * using stored authenticator public keys from registration.
 * 
 * @param intent - The intent object from the token
 * @param expectedPolicyHash - The policy_hash from the token (must match intent.challenge)
 * @param rpId - Expected relying party ID (domain)
 * @returns Promise<IntentValidationResult>
 */
export async function validateIntent(
  intent: any,
  expectedPolicyHash: string,
  rpId: string
): Promise<IntentValidationResult> {
  try {
    // 1. Check intent type
    if (intent.type !== 'webauthn.v0') {
      return {
        valid: false,
        expired: false,
        reason: `Unsupported intent type: ${intent.type}`,
        code: 'INTENT_INVALID'
      };
    }

    // 2. Check expiry
    const now = new Date();
    const validUntil = new Date(intent.valid_until);
    
    if (now > validUntil) {
      const approvedAt = new Date(intent.approved_at);
      return {
        valid: false,
        expired: true,
        reason: `User approval expired on ${validUntil.toISOString()} (approved at ${approvedAt.toISOString()})`,
        code: 'INTENT_EXPIRED'
      };
    }

    // 3. Verify policy hash matches challenge
    if (intent.challenge !== expectedPolicyHash) {
      return {
        valid: false,
        expired: false,
        reason: 'Intent challenge does not match policy hash',
        code: 'INTENT_POLICY_MISMATCH'
      };
    }

    // 4. Verify RP ID matches
    if (intent.rp_id !== rpId) {
      return {
        valid: false,
        expired: false,
        reason: `RP ID mismatch: expected ${rpId}, got ${intent.rp_id}`,
        code: 'INTENT_INVALID'
      };
    }

    // 5. Validate client data JSON structure
    try {
      const clientDataJSON = base64urlDecode(intent.client_data_json);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));
      
      if (clientData.type !== 'webauthn.get') {
        return {
          valid: false,
          expired: false,
          reason: 'Invalid client data type (expected webauthn.get)',
          code: 'INTENT_INVALID'
        };
      }
      
      // Note: In production, you would verify the challenge in clientData
      // matches the expected policy hash and perform full WebAuthn signature
      // verification using the stored authenticator public key
      
    } catch (error) {
      return {
        valid: false,
        expired: false,
        reason: 'Invalid client data JSON format',
        code: 'INTENT_INVALID'
      };
    }

    // 6. Verify base64url encoding is valid
    try {
      base64urlDecode(intent.signature);
      base64urlDecode(intent.authenticator_data);
      base64urlDecode(intent.credential_id);
    } catch (error) {
      return {
        valid: false,
        expired: false,
        reason: 'Invalid base64url encoding in WebAuthn data',
        code: 'INTENT_INVALID'
      };
    }

    // Calculate remaining validity
    const remainingMs = validUntil.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    // All checks passed
    return {
      valid: true,
      expired: false,
      remainingDays
    };

  } catch (error) {
    return {
      valid: false,
      expired: false,
      reason: `Intent validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'INTENT_INVALID'
    };
  }
}

/**
 * Simplified intent validation for basic checks
 * Does not verify WebAuthn signatures (use validateIntent for production)
 * 
 * @param intent - The intent object from the token
 * @param expectedPolicyHash - The policy_hash from the token
 * @returns IntentValidationResult
 */
export function validateIntentBasic(
  intent: any,
  expectedPolicyHash: string
): IntentValidationResult {
  // Check type
  if (intent.type !== 'webauthn.v0') {
    return {
      valid: false,
      expired: false,
      reason: `Unsupported intent type: ${intent.type}`,
      code: 'INTENT_INVALID'
    };
  }

  // Check expiry
  const now = new Date();
  const validUntil = new Date(intent.valid_until);
  
  if (now > validUntil) {
    return {
      valid: false,
      expired: true,
      reason: `User approval expired on ${validUntil.toISOString()}`,
      code: 'INTENT_EXPIRED'
    };
  }

  // Verify policy hash matches
  if (intent.challenge !== expectedPolicyHash) {
    return {
      valid: false,
      expired: false,
      reason: 'Intent challenge does not match policy hash',
      code: 'INTENT_POLICY_MISMATCH'
    };
  }

  // Calculate remaining validity
  const remainingMs = validUntil.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return {
    valid: true,
    expired: false,
    remainingDays
  };
}

