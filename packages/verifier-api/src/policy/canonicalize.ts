/**
 * Policy canonicalization utilities
 * 
 * Provides stable, deterministic JSON serialization for policy hashing
 */

import { createHash } from 'node:crypto';

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
 * Compute SHA-256 hash of canonicalized policy
 * 
 * @param policy - Policy object to hash
 * @returns Hash in format "sha256:hexstring"
 */
export function hashPolicy(policy: any): string {
  const canonical = canonicalizePolicy(policy);
  
  // Use Node.js crypto for hashing
  const hash = createHash('sha256');
  hash.update(canonical, 'utf8');
  const hex = hash.digest('hex');
  
  return `sha256:${hex}`;
}

/**
 * Verify that a policy matches its hash
 * 
 * @param policy - Policy object to verify
 * @param policyHash - Expected hash value
 * @returns True if hash matches
 */
export function verifyPolicyHash(policy: any, policyHash: string): boolean {
  if (!policyHash.startsWith('sha256:')) {
    return false;
  }
  
  const computed = hashPolicy(policy);
  return computed === policyHash;
}

