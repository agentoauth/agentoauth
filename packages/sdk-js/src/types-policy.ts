/**
 * Policy types (re-exported for browser compatibility)
 * This file contains only type definitions with no runtime code
 */

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
    after?: string;
    before?: string;
  };
  geo?: {
    allowed_countries?: string[];
    blocked_countries?: string[];
  };
  rate?: {
    max_per_hour?: number;
    max_per_day?: number;
  };
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

