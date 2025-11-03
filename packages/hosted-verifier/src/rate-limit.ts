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
  
  /**
   * Check IP-based rate limits (backstop for keyless requests)
   */
  async checkIPLimit(
    ip: string,
    limits: { perMinute: number; perHour: number }
  ): Promise<{
    allowed: boolean;
    reason?: string;
    resetTime?: number;
  }> {
    const now = Date.now();
    const minuteKey = `ip:${ip}:minute:${Math.floor(now / (60 * 1000))}`;
    const hourKey = `ip:${ip}:hour:${Math.floor(now / (60 * 60 * 1000))}`;
    
    // Check current usage
    const [minuteUsageStr, hourUsageStr] = await Promise.all([
      this.kv.get(minuteKey),
      this.kv.get(hourKey)
    ]);
    
    const minuteUsage = parseInt(minuteUsageStr || '0');
    const hourUsage = parseInt(hourUsageStr || '0');
    
    // Check per-minute limit
    if (minuteUsage >= limits.perMinute) {
      return {
        allowed: false,
        reason: `IP rate limit exceeded: ${limits.perMinute} requests per minute`,
        resetTime: Math.floor((Math.floor(now / (60 * 1000)) + 1) * 60)
      };
    }
    
    // Check per-hour limit
    if (hourUsage >= limits.perHour) {
      return {
        allowed: false,
        reason: `IP rate limit exceeded: ${limits.perHour} requests per hour`,
        resetTime: Math.floor((Math.floor(now / (60 * 60 * 1000)) + 1) * 3600)
      };
    }
    
    // Increment counters
    const newMinuteUsage = minuteUsage + 1;
    const newHourUsage = hourUsage + 1;
    
    await Promise.all([
      this.kv.put(minuteKey, newMinuteUsage.toString(), { expirationTtl: 120 }), // 2 minutes TTL
      this.kv.put(hourKey, newHourUsage.toString(), { expirationTtl: 7200 }) // 2 hours TTL
    ]);
    
    return {
      allowed: true
    };
  }
}
