/**
 * Browser-safe exports from @agentoauth/sdk
 * 
 * This entry point only exports functions and types that work in the browser.
 * Use this in client-side code (React components, etc.)
 * 
 * For Node.js-only features (issueConsent, request, etc.), import from the main package.
 */

// Intent (WebAuthn) - Browser only
export {
  requestIntent,
  isWebAuthnSupported,
  isIntentExpired,
  getIntentRemainingDays,
  type IntentDuration
} from './intent.js';

// Policy types only (no runtime code that uses Node.js crypto)
export type {
  PolicyV2,
  ResourceMatch,
  PolicyLimits,
  PolicyConstraints
} from './types-policy.js';

// Note: buildPolicy and hashPolicy are not exported in browser build
// They require Node.js crypto module and are server-side only

// Types - Safe to export
export type {
  AgentOAuthPayload,
  AgentOAuthPayloadV3,
  IntentV0,
  VerifyOptions,
  VerificationResult,
  ErrorCode
} from './types.js';

// Decode - Browser safe (no crypto needed)
export { decode } from './decode.js';

