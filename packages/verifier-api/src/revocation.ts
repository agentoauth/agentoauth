/**
 * Revocation and Replay Protection Module
 * 
 * Provides in-memory storage for revoked tokens and replay cache.
 * In production, use Redis or a database for persistence.
 */

// In-memory revocation list - Set of revoked jti values
const revokedTokens = new Set<string>();

// In-memory replay cache - Map of jti to expiration time
const usedTokens = new Map<string, number>();

/**
 * Revoke a token by its jti
 * 
 * @param jti - JWT ID to revoke
 * @returns true if revoked, false if already revoked
 */
export function revokeToken(jti: string): boolean {
  if (revokedTokens.has(jti)) {
    return false; // Already revoked
  }
  
  revokedTokens.add(jti);
  console.log(`🚫 Token revoked: ${jti}`);
  return true;
}

/**
 * Check if a token is revoked
 * 
 * @param jti - JWT ID to check
 * @returns true if revoked, false otherwise
 */
export function isRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}

/**
 * Mark a token as used (replay protection)
 * 
 * @param jti - JWT ID
 * @param exp - Expiration timestamp
 * @returns true if marked successfully, false if already used (replay attack)
 */
export function markAsUsed(jti: string, exp: number): boolean {
  if (usedTokens.has(jti)) {
    console.warn(`⚠️  Replay attack detected: ${jti}`);
    return false; // Already used - replay attack!
  }
  
  usedTokens.set(jti, exp);
  return true;
}

/**
 * Check if a token has been used
 * 
 * @param jti - JWT ID to check
 * @returns true if already used, false otherwise
 */
export function isUsed(jti: string): boolean {
  return usedTokens.has(jti);
}

/**
 * Clean up expired tokens from replay cache
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupExpired(): void {
  const now = Math.floor(Date.now() / 1000);
  let cleaned = 0;
  
  for (const [jti, exp] of usedTokens.entries()) {
    if (exp < now) {
      usedTokens.delete(jti);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired tokens from replay cache`);
  }
}

/**
 * Get revocation statistics
 */
export function getStats() {
  return {
    revokedCount: revokedTokens.size,
    replayCacheSize: usedTokens.size
  };
}

/**
 * Clear all revocations and replay cache (for testing)
 */
export function clearAll(): void {
  revokedTokens.clear();
  usedTokens.clear();
  console.log('🧹 Cleared all revocations and replay cache');
}

// Cleanup expired tokens every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

