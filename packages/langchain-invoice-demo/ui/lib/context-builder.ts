/**
 * Context construction for claims settlement authority.
 * Builds machine-grade context blob, canonicalizes for hashing, and derives human-readable summary.
 */

import crypto from 'node:crypto';

export const CONTEXT_SCHEMA_VERSION = 'context.v0.1';

export interface ContextBlob {
  action: string;
  claim_id: string;
  amount: number;
  currency: string;
  coverage_confirmed: boolean;
  docs_complete: boolean;
  loss_type: string;
  decision_time: string;
  schema_version: string;
  provenance: {
    source: string;
    [key: string]: unknown;
  };
}

export interface ClaimInput {
  claim_id: string;
  loss_type: string;
  amount: number;
  currency: string;
  coverage_confirmed: boolean;
  docs_complete: boolean;
}

/**
 * Build machine-grade context blob at decision time.
 */
export function buildContextBlob(
  claim: ClaimInput,
  options?: { decisionTime?: string; policyThreshold?: number }
): ContextBlob {
  const decision_time = options?.decisionTime ?? new Date().toISOString();
  return {
    action: 'claims.settle',
    claim_id: claim.claim_id,
    amount: claim.amount,
    currency: claim.currency,
    coverage_confirmed: claim.coverage_confirmed,
    docs_complete: claim.docs_complete,
    loss_type: claim.loss_type,
    decision_time,
    schema_version: CONTEXT_SCHEMA_VERSION,
    provenance: {
      source: 'claims-system',
      schema_version: CONTEXT_SCHEMA_VERSION
    }
  };
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sortKeys(item));
  }
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Canonicalize context object to stable JSON (sorted keys, compact).
 */
export function canonicalizeContext(context: ContextBlob): string {
  const cloned = JSON.parse(JSON.stringify(context));
  const sorted = sortKeys(cloned);
  return JSON.stringify(sorted);
}

/**
 * Compute SHA-256 hash of canonicalized context.
 * Returns format "sha256:hexstring".
 */
export function computeContextHash(canonicalContextJson: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(canonicalContextJson, 'utf8');
  const hex = hash.digest('hex');
  return `sha256:${hex}`;
}

/**
 * Deterministic human-readable summary from context blob.
 * Display/export only; not trusted without the hash.
 */
export function buildContextSummary(
  blob: ContextBlob,
  options?: { policyThreshold?: number }
): string {
  const lines = [
    `Claim ID: ${blob.claim_id}`,
    `Loss type: ${blob.loss_type}`,
    `Settlement amount: $${blob.amount}`,
    `Coverage confirmed: ${blob.coverage_confirmed ? 'Yes' : 'No'}`,
    `Documentation complete: ${blob.docs_complete ? 'Yes' : 'No'}`
  ];
  if (options?.policyThreshold != null) {
    lines.push(`Policy threshold: $${options.policyThreshold}`);
  }
  const dt = new Date(blob.decision_time);
  lines.push(`Decision time: ${dt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })} PT`);
  return lines.join('\n');
}
