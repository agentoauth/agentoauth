/**
 * Policy canonicalization utilities (Workers-compatible)
 * 
 * Provides stable, deterministic JSON serialization for policy hashing
 * Uses Web Crypto API instead of Node.js crypto
 */

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
 * 
 * @param policy - Policy object to canonicalize
 * @returns Canonicalized JSON string
 */
export function canonicalizePolicy(policy: any): string {
  // Deep clone to avoid mutating input
  const cloned = JSON.parse(JSON.stringify(policy));
  
  // Sort all keys recursively
  const sorted = sortKeys(cloned);
  
  // Serialize to compact JSON
  return JSON.stringify(sorted);
}

/**
 * Compute SHA-256 hash of canonicalized policy using Web Crypto API
 * 
 * @param policy - Policy object to hash
 * @returns Hash in format "sha256:hexstring"
 */
export async function hashPolicy(policy: any): Promise<string> {
  const canonical = canonicalizePolicy(policy);
  
  // Use Web Crypto API for hashing (Workers-compatible)
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256:${hex}`;
}

/**
 * Verify that a policy matches its hash
 * 
 * @param policy - Policy object to verify
 * @param policyHash - Expected hash value
 * @returns True if hash matches
 */
export async function verifyPolicyHash(policy: any, policyHash: string): Promise<boolean> {
  if (!policyHash.startsWith('sha256:')) {
    return false;
  }
  
  const computed = await hashPolicy(policy);
  return computed === policyHash;
}

