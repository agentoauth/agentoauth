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

export type {
  AgentOAuthPayload,
  VerifyOptions,
  VerificationResult,
  DecodedToken,
  ErrorCode,
  AgentOAuthErrorObject
} from './types.js';

export { AgentOAuthError } from './types.js';

