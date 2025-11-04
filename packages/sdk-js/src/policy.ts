import { AgentOAuthPayload } from './types.js';

export type PolicyPreset = 'payment' | 'read' | 'admin' | 'custom';

export interface PolicyOptions {
  preset?: PolicyPreset;
  scopes?: string[];
  limits?: {
    amount?: number;
    currency?: string;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
  expiresIn?: string | number;
  audience?: string;
  custom?: Partial<AgentOAuthPayload>;
}

/**
 * Build a policy with safe defaults and presets
 */
export function buildPolicy(options: PolicyOptions = {}): Partial<AgentOAuthPayload> {
  const preset = getPreset(options.preset || 'payment');
  
  return {
    ...preset,
    scope: options.scopes?.join(' ') || preset.scope,
    limit: {
      amount: options.limits?.amount || preset.limit.amount,
      currency: options.limits?.currency || preset.limit.currency
    },
    aud: options.audience || preset.aud,
    exp: Math.floor(Date.now() / 1000) + parseExpiresIn(options.expiresIn || preset.defaultExpiry),
    ...options.custom
  };
}

/**
 * Get preset configuration
 */
function getPreset(preset: PolicyPreset) {
  const presets = {
    payment: {
      scope: 'pay:merchant',
      limit: { amount: 1000, currency: 'USD' },
      defaultExpiry: 3600, // 1 hour
      aud: undefined
    },
    read: {
      scope: 'read:data',
      limit: { amount: 0, currency: 'USD' }, // No financial limit for read
      defaultExpiry: 86400, // 24 hours
      aud: undefined
    },
    admin: {
      scope: 'admin:manage',
      limit: { amount: 100, currency: 'USD' }, // Restricted for admin
      defaultExpiry: 900, // 15 minutes
      aud: 'admin.internal'
    },
    custom: {
      scope: 'custom:scope',
      limit: { amount: 500, currency: 'USD' },
      defaultExpiry: 1800, // 30 minutes
      aud: undefined
    }
  };
  
  return presets[preset];
}

/**
 * Parse expiresIn string or number to seconds
 */
function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  
  const match = expiresIn.match(/^(\d+)([smhd]?)$/);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}. Use "1h", "30m", "3600", etc.`);
  }
  
  const [, num, unit] = match;
  const value = parseInt(num, 10);
  
  switch (unit) {
    case 's': case '': return value; // seconds (default)
    case 'm': return value * 60; // minutes  
    case 'h': return value * 3600; // hours
    case 'd': return value * 86400; // days
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Check if a token scope includes the required scope
 */
export function hasScope(tokenScope: string, requiredScope: string): boolean {
  const tokenScopes = tokenScope.split(' ');
  const requiredScopes = requiredScope.split(' ');
  
  return requiredScopes.every(scope => 
    tokenScopes.includes(scope) || 
    tokenScopes.some(tokenScope => tokenScope.startsWith(scope + ':'))
  );
}

/**
 * Validate policy limits
 */
export function validatePolicy(policy: Partial<AgentOAuthPayload>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const scope = typeof policy.scope === 'string' ? policy.scope : (Array.isArray(policy.scope) ? policy.scope.join(',') : '');
  if (!scope || scope.trim().length === 0) {
    errors.push('Scope is required');
  }
  
  if (!policy.limit) {
    errors.push('Limit is required');
  } else {
    if (typeof policy.limit.amount !== 'number' || policy.limit.amount < 0) {
      errors.push('Limit amount must be a non-negative number');
    }
    
    if (!policy.limit.currency || policy.limit.currency.length !== 3) {
      errors.push('Limit currency must be a 3-letter currency code');
    }
  }
  
  if (policy.exp && (typeof policy.exp !== 'number' || policy.exp <= Math.floor(Date.now() / 1000))) {
    errors.push('Expiration must be a future timestamp');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
