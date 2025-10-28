import { TestVector } from './types.js';

/**
 * Validates JSON canonicalization against test vectors
 */
export function validateCanonicalization(vectors: TestVector[]): boolean {
  let allPassed = true;
  
  for (const vector of vectors) {
    const canonicalized = canonicalizeJSON(vector.input);
    const base64url = base64urlEncode(canonicalized);
    
    if (canonicalized !== vector.canonicalized) {
      console.error(`❌ Canonicalization mismatch for ${vector.name}`);
      console.error(`   Expected: ${vector.canonicalized}`);
      console.error(`   Actual:   ${canonicalized}`);
      allPassed = false;
      continue;
    }
    
    if (base64url !== vector.base64url) {
      console.error(`❌ Base64URL mismatch for ${vector.name}`);
      console.error(`   Expected: ${vector.base64url}`);
      console.error(`   Actual:   ${base64url}`);
      allPassed = false;
      continue;
    }
    
    console.log(`✅ ${vector.name}: canonicalization and base64url encoding correct`);
  }
  
  if (allPassed) {
    console.log(`✅ All ${vectors.length} canonicalization vectors passed`);
  }
  
  return allPassed;
}

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS)
 * 
 * This is a simplified implementation. For production use,
 * consider using a dedicated JCS library.
 */
function canonicalizeJSON(obj: any): string {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return obj.toString();
  if (typeof obj === 'string') return JSON.stringify(obj);
  
  if (Array.isArray(obj)) {
    const elements = obj.map(canonicalizeJSON);
    return `[${elements.join(',')}]`;
  }
  
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      const canonicalKey = JSON.stringify(key);
      const canonicalValue = canonicalizeJSON(obj[key]);
      return `${canonicalKey}:${canonicalValue}`;
    });
    return `{${pairs.join(',')}}`;
  }
  
  throw new Error(`Cannot canonicalize value of type ${typeof obj}`);
}

/**
 * Base64URL encoding (RFC 4648 Section 5)
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate test vectors from a payload object
 */
export function generateTestVector(name: string, description: string, input: any): TestVector {
  const canonicalized = canonicalizeJSON(input);
  const base64url = base64urlEncode(canonicalized);
  
  // For signature base, we would need the header as well
  // This is a simplified version for demonstration
  const mockHeader = {
    alg: 'EdDSA',
    kid: 'key-1729512345',
    typ: 'JWT'
  };
  
  const headerCanonical = canonicalizeJSON(mockHeader);
  const headerBase64url = base64urlEncode(headerCanonical);
  const signatureBase = `${headerBase64url}.${base64url}`;
  
  return {
    name,
    description,
    input,
    canonicalized,
    base64url,
    signatureBase
  };
}
