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

// Policy helpers (legacy v0.1)
export { 
  buildPolicy, 
  hasScope, 
  validatePolicy 
} from './policy.js';

// Policy v0.2 helpers
export {
  buildPolicy as buildPolicyV2,
  canonicalizePolicy,
  hashPolicy,
  verifyPolicyHash,
  PolicyBuilder,
  type PolicyV2,
  type ResourceMatch,
  type PolicyLimits,
  type PolicyConstraints
} from './policy-v2.js';

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

