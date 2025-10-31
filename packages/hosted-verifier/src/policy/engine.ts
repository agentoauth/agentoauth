/**
 * Policy evaluation engine (Workers-compatible)
 * 
 * Stateless evaluation of pol.v0.2 policies for authorization decisions
 */

// Policy types (match SDK)
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
 * Request context for policy evaluation
 */
export interface RequestContext {
  action: string;
  resource?: {
    type: string;
    id: string;
  };
  amount?: number;
  currency?: string;
  timestamp?: number; // Unix seconds, defaults to now
}

/**
 * Policy evaluation result
 */
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  remaining?: {
    amount?: number;
    currency?: string;
    period_ends?: string;
  };
}

/**
 * Evaluate policy stateless checks only
 * (Used for fast rejection before Durable Object call)
 */
export function evaluatePolicyStateless(
  policy: PolicyV2,
  context: RequestContext
): PolicyResult {
  // Check actions
  if (!policy.actions.includes(context.action)) {
    return {
      allowed: false,
      reason: `Action '${context.action}' not permitted`
    };
  }

  // Check resources
  if (context.resource) {
    const resourceAllowed = policy.resources.some(res => {
      if (res.type !== context.resource!.type) {
        return false;
      }
      const match = res.match;
      
      if (match.ids && match.ids.includes(context.resource!.id)) {
        return true;
      }
      
      if (match.prefixes) {
        return match.prefixes.some(prefix => 
          context.resource!.id.startsWith(prefix)
        );
      }
      
      return false;
    });
    
    if (!resourceAllowed) {
      return {
        allowed: false,
        reason: `Resource '${context.resource.type}:${context.resource.id}' not allowed`
      };
    }
  }

  // Check per-transaction limits (stateless)
  if (context.amount && policy.limits.per_txn) {
    const limit = policy.limits.per_txn;
    
    if (context.currency !== limit.currency) {
      return {
        allowed: false,
        reason: `Currency mismatch: expected ${limit.currency}, got ${context.currency}`
      };
    }
    
    if (context.amount > limit.amount) {
      return {
        allowed: false,
        reason: `Amount ${context.amount} ${context.currency} exceeds per-transaction limit ${limit.amount} ${limit.currency}`
      };
    }
  }

  // Check time constraints
  if (policy.constraints?.time) {
    const timeCheck = checkTimeConstraints(
      policy.constraints.time,
      context.timestamp
    );
    
    if (!timeCheck.allowed) {
      return {
        allowed: false,
        reason: timeCheck.reason
      };
    }
  }

  // Stateless checks passed
  return { allowed: true };
}

/**
 * Check time-based constraints
 */
function checkTimeConstraints(
  time: PolicyConstraints['time'],
  timestamp?: number
): { allowed: boolean; reason?: string } {
  if (!time) {
    return { allowed: true };
  }
  
  const now = timestamp ? new Date(timestamp * 1000) : new Date();
  const tz = time.tz || 'UTC';
  
  // Check day of week
  if (time.dow && time.dow.length > 0) {
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = dowNames[now.getUTCDay()];
    
    if (!time.dow.includes(currentDay as any)) {
      return {
        allowed: false,
        reason: `Current day ${currentDay} not in allowed days: ${time.dow.join(', ')}`
      };
    }
  }
  
  // Check time window (using UTC for simplicity, proper timezone would need date-fns or similar)
  if (time.start && time.end) {
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    if (currentTime < time.start || currentTime > time.end) {
      return {
        allowed: false,
        reason: `Current time ${currentTime} UTC not in allowed window ${time.start} - ${time.end} (${tz})`
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Generate a budget key for stateful tracking
 */
export function getBudgetKey(policyId: string, period: string, timestamp: number): string {
  const date = new Date(timestamp * 1000);
  
  let periodKey: string;
  switch (period) {
    case 'hour':
      periodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}`;
      break;
    case 'day':
      periodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      break;
    case 'week':
      const weekStart = getWeekStart(date);
      periodKey = `${weekStart.getUTCFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, '0')}`;
      break;
    case 'month':
      periodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      break;
    default:
      throw new Error(`Unknown period: ${period}`);
  }
  
  return `budget:${policyId}:${period}:${periodKey}`;
}

function getWeekStart(date: Date): Date {
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  return monday;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - d.getTime()) / 86400000) + d.getUTCDay() + 1) / 7);
  return weekNo;
}

