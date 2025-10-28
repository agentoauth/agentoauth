export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  error?: string;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export class RateLimiter {
  constructor(private kv: KVLike) {}
  
  /**
   * Check rate limit for API key using Cloudflare KV
   */
  async checkLimit(
    orgId: string, 
    quotas: { daily: number; monthly: number }
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const dayKey = `quota:daily:${orgId}:${Math.floor(now / (24 * 60 * 60 * 1000))}`;
    const monthKey = `quota:monthly:${orgId}:${Math.floor(now / (30 * 24 * 60 * 60 * 1000))}`;
    
    // Check current usage
    const [dailyUsageStr, monthlyUsageStr] = await Promise.all([
      this.kv.get(dayKey),
      this.kv.get(monthKey)
    ]);
    
    const dailyUsage = parseInt(dailyUsageStr || '0');
    const monthlyUsage = parseInt(monthlyUsageStr || '0');
    
    // Check limits
    if (dailyUsage >= quotas.daily) {
      return {
        allowed: false,
        limit: quotas.daily,
        remaining: 0,
        resetTime: Math.floor((now + 24 * 60 * 60 * 1000) / 1000),
        error: 'Daily quota exceeded'
      };
    }
    
    if (monthlyUsage >= quotas.monthly) {
      return {
        allowed: false,
        limit: quotas.monthly, 
        remaining: 0,
        resetTime: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000),
        error: 'Monthly quota exceeded'
      };
    }
    
    // Increment counters
    const newDailyUsage = dailyUsage + 1;
    const newMonthlyUsage = monthlyUsage + 1;
    
    await Promise.all([
      this.kv.put(dayKey, newDailyUsage.toString(), { expirationTtl: 24 * 60 * 60 }),
      this.kv.put(monthKey, newMonthlyUsage.toString(), { expirationTtl: 30 * 24 * 60 * 60 })
    ]);
    
    return {
      allowed: true,
      limit: quotas.daily,
      remaining: quotas.daily - newDailyUsage,
      resetTime: Math.floor((now + 24 * 60 * 60 * 1000) / 1000)
    };
  }
  
  /**
   * Get current usage for organization
   */
  async getUsage(orgId: string): Promise<{
    daily: { used: number; limit: number };
    monthly: { used: number; limit: number };
  }> {
    const now = Date.now();
    const dayKey = `quota:daily:${orgId}:${Math.floor(now / (24 * 60 * 60 * 1000))}`;
    const monthKey = `quota:monthly:${orgId}:${Math.floor(now / (30 * 24 * 60 * 60 * 1000))}`;
    
    const [dailyUsageStr, monthlyUsageStr] = await Promise.all([
      this.kv.get(dayKey),
      this.kv.get(monthKey)
    ]);
    
    const dailyUsed = parseInt(dailyUsageStr || '0');
    const monthlyUsed = parseInt(monthlyUsageStr || '0');
    
    return {
      daily: { used: dailyUsed, limit: 0 }, // Will be filled by caller
      monthly: { used: monthlyUsed, limit: 0 }
    };
  }
}
