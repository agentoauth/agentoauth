/**
 * Durable Object for Policy State
 * 
 * Handles atomic budget tracking and replay detection
 */

import { getBudgetKey, type PolicyV2, type RequestContext } from './policy/engine.js';

interface Env {
  KV: KVNamespace;
}

export class PolicyState {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const { method, body } = await request.json();
      
      if (method === 'apply') {
        // Mutating verification - update budgets/replay
        return this.applyPolicy(body);
      } else if (method === 'simulate') {
        // Read-only simulation - no state changes
        return this.simulatePolicy(body);
      } else {
        return new Response('Invalid method', { status: 400 });
      }
    } catch (error) {
      console.error('PolicyState error:', error);
      return new Response(JSON.stringify({ 
        allowed: false, 
        reason: 'Internal error processing policy state' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Mutating policy evaluation - updates budgets and replay cache
   */
  private async applyPolicy(body: any): Promise<Response> {
    const { policy, context, jti, idempotencyKey } = body;
    
    // Check replay
    if (jti) {
      const replayKey = `replay:${jti}`;
      const existing = await this.state.storage.get(replayKey);
      if (existing) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: 'Replay detected: token already used'
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Mark as used (expires with token)
      const tokenExp = context.timestamp || Math.floor(Date.now() / 1000);
      const ttl = tokenExp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.state.storage.put(replayKey, '1', { expirationTtl: ttl });
      }
    }
    
    // Check idempotency
    if (idempotencyKey) {
      const idemKey = `idem:${idempotencyKey}`;
      const existing = await this.state.storage.get(idemKey);
      if (existing) {
        const decision = JSON.parse(existing);
        return new Response(JSON.stringify(decision), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Check per-period budget
    if (context.amount && policy.limits.per_period) {
      const limit = policy.limits.per_period;
      
      if (context.currency !== limit.currency) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: `Currency mismatch: expected ${limit.currency}, got ${context.currency}`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const timestamp = context.timestamp || Math.floor(Date.now() / 1000);
      const budgetKey = getBudgetKey(policy.id, limit.period, timestamp);
      
      // Get current budget atomically
      const spent = await this.state.storage.get(budgetKey) || 0;
      const remaining = limit.amount - spent;
      
      if (context.amount > remaining) {
        // Store decision for idempotency if needed
        if (idempotencyKey) {
          const decision = {
            allowed: false,
            reason: `Amount ${context.amount} ${context.currency} exceeds remaining budget ${remaining.toFixed(2)} ${context.currency}`
          };
          await this.state.storage.put(`idem:${idempotencyKey}`, JSON.stringify(decision), { 
            expirationTtl: 3600 // 1 hour 
          });
        }
        
        return new Response(JSON.stringify({
          allowed: false,
          reason: `Amount ${context.amount} ${context.currency} exceeds remaining budget ${remaining.toFixed(2)} ${context.currency}`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Update budget atomically
      await this.state.storage.put(budgetKey, spent + context.amount);
    }
    
    // All checks passed
    const result = {
      allowed: true,
      remaining: this.calculateRemaining(policy, context)
    };
    
    // Store decision for idempotency if needed
    if (idempotencyKey) {
      await this.state.storage.put(`idem:${idempotencyKey}`, JSON.stringify(result), { 
        expirationTtl: 3600 // 1 hour
      });
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Read-only policy simulation - no state mutations
   */
  private async simulatePolicy(body: any): Promise<Response> {
    const { policy, context } = body;
    
    // Check per-period budget (read-only)
    if (context.amount && policy.limits.per_period) {
      const limit = policy.limits.per_period;
      
      if (context.currency !== limit.currency) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: `Currency mismatch: expected ${limit.currency}, got ${context.currency}`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const timestamp = context.timestamp || Math.floor(Date.now() / 1000);
      const budgetKey = getBudgetKey(policy.id, limit.period, timestamp);
      
      const spent = await this.state.storage.get(budgetKey) || 0;
      const remaining = limit.amount - spent;
      
      if (context.amount > remaining) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: `Amount ${context.amount} ${context.currency} exceeds remaining budget ${remaining.toFixed(2)} ${context.currency}`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // All checks passed
    return new Response(JSON.stringify({
      allowed: true,
      remaining: this.calculateRemaining(policy, context)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Calculate remaining budget and period end
   */
  private calculateRemaining(policy: PolicyV2, context: RequestContext): any {
    if (!policy.limits.per_period || !context.amount || !context.currency) {
      return undefined;
    }
    
    const limit = policy.limits.per_period;
    const timestamp = context.timestamp || Math.floor(Date.now() / 1000);
    const budgetKey = getBudgetKey(policy.id, limit.period, timestamp);
    
    // We need to calculate this from the storage, but in the response we return it
    // For now, return the period end timestamp estimate
    const periodEnd = this.calculatePeriodEnd(limit.period, timestamp);
    
    return {
      amount: limit.amount, // Full amount for now
      currency: context.currency,
      period_ends: periodEnd
    };
  }

  /**
   * Calculate when the current period ends
   */
  private calculatePeriodEnd(period: string, timestamp: number): string {
    const date = new Date(timestamp * 1000);
    let endDate: Date;
    
    switch (period) {
      case 'hour':
        endDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours() + 1,
          0
        ));
        break;
      case 'day':
        endDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() + 1,
          0
        ));
        break;
      case 'week':
        const day = date.getUTCDay();
        const daysToMonday = day === 0 ? 1 : 8 - day;
        endDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() + daysToMonday,
          0
        ));
        break;
      case 'month':
        endDate = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          1
        ));
        break;
      default:
        throw new Error(`Unknown period: ${period}`);
    }
    
    return endDate.toISOString();
  }
}

