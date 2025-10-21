/**
 * AgentOAuth Token Payload (v0.1)
 */
export interface AgentOAuthPayload {
  /** Specification version */
  ver: '0.1';
  /** User identifier (DID or stable ID) */
  user: string;
  /** Agent identifier */
  agent: string;
  /** OAuth-style scope */
  scope: string;
  /** Authorization limits */
  limit: {
    amount: number;
    currency: string;
  };
  /** Audience (optional) */
  aud?: string;
  /** Expiration timestamp (Unix seconds) */
  exp: number;
  /** Nonce for replay protection */
  nonce: string;
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
  code?: 'INVALID_SIGNATURE' | 'EXPIRED' | 'INVALID_AUDIENCE' | 'INVALID_PAYLOAD' | 'INVALID_VERSION' | 'NETWORK_ERROR';
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
  | 'NETWORK_ERROR';

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

