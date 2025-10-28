export interface AuditLog {
  id: string;
  timestamp: string;
  orgId: string;
  orgNameHash: string;    // Hashed for privacy
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent: string;
  ipHash: string;         // Hashed IP for privacy
  userIdHash?: string;    // Hashed user ID from token
  agentIdHash?: string;   // Hashed agent ID from token
  scope?: string;         // Scope is not sensitive
  audience?: string;      // Audience is not sensitive
  amountRange?: string;   // Range instead of exact amount
  currency?: string;
  errorCode?: string;
  // Deliberately exclude: nonce, jti, signatures, exact amounts
}

export interface R2Like {
  put(key: string, value: string | ArrayBuffer): Promise<void>;
}

export class AuditLogger {
  constructor(private r2?: R2Like, private auditSalt?: string) {}
  
  /**
   * Log verification request with privacy-first approach
   */
  async logVerification(data: {
    orgId: string;
    orgName: string;
    request: Request;
    statusCode: number;
    responseTime: number;
    tokenPayload?: any;
    errorCode?: string;
  }): Promise<void> {
    const clientIP = data.request.headers.get('CF-Connecting-IP') 
                  || data.request.headers.get('X-Forwarded-For') 
                  || 'unknown';
                  
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      orgId: data.orgId,
      orgNameHash: await this.hashPII(data.orgName),
      endpoint: '/verify',
      method: data.request.method,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      userAgent: data.request.headers.get('User-Agent') || '',
      ipHash: await this.hashPII(clientIP),
      userIdHash: data.tokenPayload?.user ? await this.hashPII(data.tokenPayload.user) : undefined,
      agentIdHash: data.tokenPayload?.agent ? await this.hashPII(data.tokenPayload.agent) : undefined,
      scope: data.tokenPayload?.scope,
      audience: data.tokenPayload?.aud,
      amountRange: data.tokenPayload?.limit?.amount ? this.getAmountRange(data.tokenPayload.limit.amount) : undefined,
      currency: data.tokenPayload?.limit?.currency,
      errorCode: data.errorCode
    };
    
    // Store audit log
    await this.storeLog(log);
  }
  
  /**
   * Hash PII data for privacy while maintaining analytics capability
   */
  private async hashPII(data: string): Promise<string> {
    const salt = this.auditSalt || 'default-salt';
    
    try {
      // Use crypto.subtle for proper hashing in Cloudflare Workers
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data + salt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16); // Truncate for storage efficiency
    } catch {
      // Fallback for environments without crypto.subtle
      return btoa(data + salt).substring(0, 16);
    }
  }
  
  /**
   * Convert exact amount to privacy-preserving range
   */
  private getAmountRange(amount: number): string {
    if (amount <= 10) return '0-10';
    if (amount <= 100) return '11-100'; 
    if (amount <= 1000) return '101-1000';
    if (amount <= 10000) return '1001-10000';
    if (amount <= 100000) return '10001-100000';
    return '100000+';
  }
  
  /**
   * Store audit log to R2 or console
   */
  private async storeLog(log: AuditLog): Promise<void> {
    try {
      if (this.r2) {
        // Store in R2 bucket with date-partitioned keys
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `audit-logs/${date}/${log.id}.json`;
        await this.r2.put(key, JSON.stringify(log));
      } else {
        // Fallback to console logging for development
        console.log('[AUDIT]', JSON.stringify(log));
      }
    } catch (error) {
      // Don't let audit logging failures break the main request
      console.error('[AUDIT-ERROR]', error);
    }
  }
  
  /**
   * Get analytics for organization (privacy-preserving)
   * This would typically query stored audit logs
   */
  async getAnalytics(orgId: string, timeRange: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    topScopes: Array<{ scope: string; count: number }>;
    errorBreakdown: Array<{ code: string; count: number }>;
  }> {
    // Implementation would query the audit logs from R2
    // For now, return mock data
    return {
      totalRequests: 0,
      successRate: 0.95,
      avgResponseTime: 85,
      topScopes: [],
      errorBreakdown: []
    };
  }
}
