/**
 * WebAuthn Intent (webauthn.v0)
 * Provides cryptographic proof of human approval with time-bound validity
 */
export interface IntentV0 {
  /** Intent type version */
  type: 'webauthn.v0';
  /** Base64url-encoded WebAuthn credential ID */
  credential_id: string;
  /** Base64url-encoded WebAuthn signature */
  signature: string;
  /** Base64url-encoded client data JSON */
  client_data_json: string;
  /** Base64url-encoded authenticator data */
  authenticator_data: string;
  /** ISO 8601 timestamp when user approved the policy */
  approved_at: string;
  /** ISO 8601 timestamp when approval expires */
  valid_until: string;
  /** Base64url-encoded challenge (derived from policy_hash) */
  challenge: string;
  /** Relying party identifier (domain) */
  rp_id: string;
}

/**
 * AgentOAuth Token Payload (v0.2 / act.v0.2)
 */
export interface AgentOAuthPayload {
  /** Specification version */
  ver: '0.2' | '0.1' | 'act.v0.2' | 'act.v0.3';
  /** JWT ID - unique token identifier for revocation and replay protection (required in v0.2) */
  jti?: string;
  /** User identifier (DID or stable ID) */
  user: string;
  /** Agent identifier */
  agent: string;
  /** OAuth-style scope */
  scope: string | string[];
  /** Authorization limits (legacy, use policy.limits for structured rules) */
  limit?: {
    amount: number;
    currency: string;
  };
  /** Structured policy rules (required in act.v0.2+) */
  policy?: any;
  /** SHA-256 hash of canonicalized policy (required when policy is present) */
  policy_hash?: string;
  /** WebAuthn intent proving human approval (required in act.v0.3) */
  intent?: IntentV0;
  /** Issuer identifier */
  iss?: string;
  /** Audience (optional) */
  aud?: string;
  /** Expiration timestamp (Unix seconds) */
  exp: number;
  /** Nonce for replay protection */
  nonce: string;
}

/**
 * AgentOAuth Token Payload v0.3 (with Intent)
 */
export interface AgentOAuthPayloadV3 extends Omit<AgentOAuthPayload, 'ver' | 'intent'> {
  /** Specification version */
  ver: 'act.v0.3';
  /** WebAuthn intent proving human approval (required in v0.3) */
  intent: IntentV0;
  /** Structured policy rules (required in v0.3) */
  policy: any;
  /** SHA-256 hash of canonicalized policy (required in v0.3) */
  policy_hash: string;
}

/**
 * Verification options
 */
export interface VerifyOptions {
  /** Expected audience (if not provided, aud check is skipped) */
  audience?: string;
  /** Clock skew tolerance in seconds (default: 60) */
  clockSkew?: number;
  /** Current time override for testing (Unix seconds) */
  currentTime?: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** Decoded payload (if valid) */
  payload?: AgentOAuthPayload;
  /** Error message (if invalid) */
  error?: string;
  /** Error code for programmatic handling */
  code?: 'INVALID_SIGNATURE' | 'EXPIRED' | 'INVALID_AUDIENCE' | 'INVALID_PAYLOAD' | 'INVALID_VERSION' | 'NETWORK_ERROR' | 'REVOKED' | 'REPLAY' | 'INTENT_EXPIRED' | 'INTENT_INVALID' | 'INTENT_POLICY_MISMATCH';
}

/**
 * Standard error codes for AgentOAuth operations
 */
export type ErrorCode = 
  | 'INVALID_PAYLOAD'
  | 'INVALID_SIGNATURE' 
  | 'EXPIRED'
  | 'INVALID_AUDIENCE'
  | 'INVALID_VERSION'
  | 'INVALID_KEY'
  | 'DECODE_ERROR'
  | 'NETWORK_ERROR'
  | 'REVOKED'
  | 'REPLAY'
  | 'INTENT_EXPIRED'
  | 'INTENT_INVALID'
  | 'INTENT_POLICY_MISMATCH';

/**
 * Consistent error object structure
 */
export interface AgentOAuthErrorObject {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: unknown;
}

/**
 * AgentOAuth Error class with consistent structure
 */
export class AgentOAuthError extends Error implements AgentOAuthErrorObject {
  /**
   * Creates a new AgentOAuth error
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param details - Additional error details
   */
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgentOAuthError';
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentOAuthError);
    }
  }

  /**
   * Converts error to plain object
   */
  toJSON(): AgentOAuthErrorObject {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

/**
 * Decoded token structure (header + payload, no verification)
 */
export interface DecodedToken {
  /** JWT header (alg, kid, typ) */
  header: {
    alg: string;
    kid: string;
    typ: string;
    [key: string]: unknown;
  };
  /** Token payload */
  payload: AgentOAuthPayload;
}

