/**
 * AgentOAuth SDK
 * 
 * A neutral protocol for AI agents to prove authorization.
 * 
 * @packageDocumentation
 */

export { request } from './request.js';
export { verify } from './verify.js';
export { decode } from './decode.js';

// Ergonomic consent functions
export { 
  issueConsent, 
  verifyConsent, 
  revokeConsent, 
  rotateKeys 
} from './consent.js';

// Policy helpers
export { 
  buildPolicy, 
  hasScope, 
  validatePolicy 
} from './policy.js';

// Key management
export { 
  loadKeys, 
  saveKeys, 
  loadKey, 
  loadPrivateKey, 
  loadPublicKey 
} from './keys.js';

export type {
  AgentOAuthPayload,
  VerifyOptions,
  VerificationResult,
  DecodedToken,
  ErrorCode,
  AgentOAuthErrorObject
} from './types.js';

export type {
  PolicyPreset,
  PolicyOptions
} from './policy.js';

export { AgentOAuthError } from './types.js';

