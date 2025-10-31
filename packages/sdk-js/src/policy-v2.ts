/**
 * Policy v0.2 (pol.v0.2) utilities
 * 
 * Structured policy rules for verifiable consent enforcement
 */

// Import Node.js crypto for hashing
let crypto: any;
try {
  crypto = require('crypto');
} catch {
  // Fallback for browser environments
  crypto = null;
}

/**
 * Policy object structure (pol.v0.2)
 */
export interface PolicyV2 {
  version: 'pol.v0.2';
  id: string;
  actions: string[];
  resources: ResourceMatch[];
  limits: PolicyLimits;
  constraints?: PolicyConstraints;
  strict?: boolean;
  meta?: Record<string, unknown>;
}

export interface ResourceMatch {
  type: string;
  match: {
    ids?: string[];
    prefixes?: string[];
  };
}

export interface PolicyLimits {
  per_txn?: {
    amount: number;
    currency: string;
  };
  per_period?: {
    amount: number;
    currency: string;
    period: 'hour' | 'day' | 'week' | 'month';
  };
}

export interface PolicyConstraints {
  time?: {
    dow?: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>;
    start?: string; // HH:MM
    end?: string; // HH:MM
    tz?: string; // IANA timezone
  };
}

/**
 * Fluent builder for pol.v0.2 policies
 */
export class PolicyBuilder {
  private policy: Partial<PolicyV2> = {
    version: 'pol.v0.2',
    strict: false
  };

  /**
   * Set policy ID
   */
  id(id: string): this {
    this.policy.id = id;
    return this;
  }

  /**
   * Set permitted actions
   */
  actions(actions: string[]): this {
    this.policy.actions = actions;
    return this;
  }

  /**
   * Add resource match
   */
  resource(type: string, match: ResourceMatch['match']): this {
    if (!this.policy.resources) {
      this.policy.resources = [];
    }
    this.policy.resources.push({ type, match });
    return this;
  }

  /**
   * Convenience: add merchant whitelist
   */
  merchants(ids: string[]): this {
    return this.resource('merchant', { ids });
  }

  /**
   * Set per-transaction limit
   */
  limitPerTxn(amount: number, currency: string): this {
    if (!this.policy.limits) {
      this.policy.limits = {};
    }
    this.policy.limits.per_txn = { amount, currency };
    return this;
  }

  /**
   * Set per-period budget limit
   */
  limitPerPeriod(amount: number, currency: string, period: 'hour' | 'day' | 'week' | 'month'): this {
    if (!this.policy.limits) {
      this.policy.limits = {};
    }
    this.policy.limits.per_period = { amount, currency, period };
    return this;
  }

  /**
   * Set time constraints
   */
  timeWindow(config: PolicyConstraints['time']): this {
    if (!this.policy.constraints) {
      this.policy.constraints = {};
    }
    this.policy.constraints.time = config;
    return this;
  }

  /**
   * Set strict mode (unknown fields = deny)
   */
  strict(value: boolean = true): this {
    this.policy.strict = value;
    return this;
  }

  /**
   * Set metadata
   */
  meta(data: Record<string, unknown>): this {
    this.policy.meta = data;
    return this;
  }

  /**
   * Finalize and return policy object
   */
  finalize(): PolicyV2 {
    if (!this.policy.id) {
      throw new Error('Policy ID is required');
    }
    if (!this.policy.actions || this.policy.actions.length === 0) {
      throw new Error('At least one action is required');
    }
    if (!this.policy.resources || this.policy.resources.length === 0) {
      throw new Error('At least one resource is required');
    }
    if (!this.policy.limits) {
      throw new Error('At least one limit is required');
    }

    return this.policy as PolicyV2;
  }
}

/**
 * Create a new policy builder
 */
export function buildPolicy(): PolicyBuilder {
  return new PolicyBuilder();
}

/**
 * Recursively sort object keys alphabetically
 */
function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sortKeys(item));
  }
  
  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortKeys(obj[key]);
  }
  
  return sorted;
}

/**
 * Canonicalize a policy object to stable JSON
 * 
 * This ensures consistent hashing by:
 * 1. Sorting all object keys alphabetically
 * 2. Using compact JSON (no whitespace)
 * 3. Maintaining array order (arrays are context-sensitive)
 */
export function canonicalizePolicy(policy: PolicyV2): string {
  // Deep clone to avoid mutating input
  const cloned = JSON.parse(JSON.stringify(policy));
  
  // Sort all keys recursively
  const sorted = sortKeys(cloned);
  
  // Serialize to compact JSON
  return JSON.stringify(sorted);
}

/**
 * Compute SHA-256 hash of canonicalized policy
 * 
 * Returns hash in format "sha256:hexstring"
 */
export function hashPolicy(policy: PolicyV2): string {
  const canonical = canonicalizePolicy(policy);
  
  if (!crypto) {
    throw new Error('Crypto module not available');
  }
  
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  const hex = hash.digest('hex');
  
  return `sha256:${hex}`;
}

/**
 * Verify that a policy matches its hash
 */
export function verifyPolicyHash(policy: PolicyV2, policyHash: string): boolean {
  if (!policyHash.startsWith('sha256:')) {
    return false;
  }
  
  const computed = hashPolicy(policy);
  return computed === policyHash;
}

