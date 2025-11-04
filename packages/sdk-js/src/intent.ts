/**
 * WebAuthn Intent Module
 * 
 * Provides functions for requesting user intent via WebAuthn/Passkeys,
 * creating time-bound approvals cryptographically bound to policies.
 */

import { IntentV0 } from './types.js';
import type { PolicyV2 } from './types-policy.js';

// Browser-compatible policy hash function using Web Crypto API
async function hashPolicyBrowser(policy: PolicyV2): Promise<string> {
  // Canonicalize policy (same logic as policy-v2.ts but browser-safe)
  const sortKeys = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((result: any, key) => {
        result[key] = sortKeys(obj[key]);
        return result;
      }, {});
    }
    return obj;
  };
  
  const canonical = JSON.stringify(sortKeys(policy));
  
  // Use Web Crypto API (available in all modern browsers)
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256:${hex}`;
}

/**
 * Duration options for intent validity (in days)
 */
export type IntentDuration = 7 | 30 | 90;

/**
 * Base64url encoding (browser-compatible)
 */
function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Convert string to Uint8Array (browser-compatible)
 */
function stringToBuffer(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side
  }
  return typeof (window as any).PublicKeyCredential !== 'undefined';
}

/**
 * Request user intent via WebAuthn/Passkey
 * 
 * Triggers a WebAuthn ceremony where the user approves the policy
 * with their passkey (biometric or PIN), creating a cryptographically
 * bound, time-limited approval.
 * 
 * @param policy - The policy to be approved (pol.v0.2 format)
 * @param durationDays - How long the approval should last (7, 30, or 90 days)
 * @param rpId - Relying party identifier (domain, e.g., "example.com")
 * @returns Promise<IntentV0> - WebAuthn intent object
 * @throws Error if WebAuthn is not supported or user cancels/fails
 * 
 * @example
 * ```typescript
 * const policy = buildPolicyV2()
 *   .actions(['payments.send'])
 *   .limitPerTxn(500, 'USD')
 *   .finalize();
 * 
 * const intent = await requestIntent(policy, 30, window.location.hostname);
 * ```
 */
export async function requestIntent(
  policy: any,
  durationDays: IntentDuration,
  rpId: string
): Promise<IntentV0> {
  // Check browser support
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn/Passkey not supported in this browser');
  }

  // Generate challenge from policy hash
  // This cryptographically binds the intent to the specific policy
  const policyHash = await hashPolicyBrowser(policy);
  const challenge = stringToBuffer(policyHash);
  
  try {
    // Request WebAuthn assertion (user approval with passkey)
    // Type assertions for browser APIs
    const nav = (typeof navigator !== 'undefined' ? navigator : null) as any;
    if (!nav?.credentials?.get) {
      throw new Error('navigator.credentials.get not available');
    }
    
    // Use credentials.create() to generate a new attestation for this approval
    // This works even if no passkey exists yet (unlike credentials.get)
    const credential = await nav.credentials.create({
      publicKey: {
        challenge,
        rp: {
          id: rpId,
          name: 'AgentOAuth Intent Approval'
        },
        user: {
          id: crypto.getRandomValues(new Uint8Array(32)), // Random user ID for this approval
          name: 'policy-approver',
          displayName: 'Policy Approver'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },  // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          userVerification: 'required', // Ensures biometric/PIN is used
          residentKey: 'discouraged' // Don't store permanently
        },
        timeout: 60000, // 60 seconds
        attestation: 'none' // We don't need attestation
      }
    }) as any;

    if (!credential) {
      throw new Error('WebAuthn ceremony failed: no credential returned');
    }

    const response = credential.response;

    // Calculate approval timestamps
    const approvedAt = new Date();
    const validUntil = new Date(approvedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Build intent object
    // Note: create() returns attestationObject instead of signature
    const intent: IntentV0 = {
      type: 'webauthn.v0',
      credential_id: base64urlEncode(credential.rawId),
      signature: base64urlEncode(response.attestationObject || new Uint8Array()), // attestationObject serves as proof
      client_data_json: base64urlEncode(response.clientDataJSON),
      authenticator_data: base64urlEncode(response.getAuthenticatorData ? response.getAuthenticatorData() : new Uint8Array()),
      approved_at: approvedAt.toISOString(),
      valid_until: validUntil.toISOString(),
      challenge: policyHash, // Store the policy hash as the challenge
      rp_id: rpId
    };

    return intent;
  } catch (error) {
    // Handle WebAuthn errors
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('User cancelled passkey approval');
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('No valid passkey found for this device');
      }
      throw new Error(`WebAuthn ceremony failed: ${error.message}`);
    }
    throw new Error('WebAuthn ceremony failed: unknown error');
  }
}

/**
 * Check if an intent has expired
 * 
 * @param intent - Intent object to check
 * @returns boolean - true if expired, false if still valid
 */
export function isIntentExpired(intent: IntentV0): boolean {
  const now = new Date();
  const validUntil = new Date(intent.valid_until);
  return now > validUntil;
}

/**
 * Get remaining validity duration for an intent
 * 
 * @param intent - Intent object to check
 * @returns number - Remaining days (rounded up), or 0 if expired
 */
export function getIntentRemainingDays(intent: IntentV0): number {
  if (isIntentExpired(intent)) {
    return 0;
  }
  const now = new Date();
  const validUntil = new Date(intent.valid_until);
  const remainingMs = validUntil.getTime() - now.getTime();
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}


