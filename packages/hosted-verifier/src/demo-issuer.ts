/**
 * Demo Issuer Key Management
 * 
 * Manages demo issuer keys for playground token issuance.
 * Demo tokens are clearly marked and only for educational purposes.
 */

import { SignJWT, importJWK, exportJWK, generateKeyPair } from 'jose';

// Demo issuer constants
export const DEMO_ISSUER_ID = 'https://demo.agentoauth.org';
export const DEMO_ISSUER_KID = 'demo-key-2025';

/**
 * Get demo issuer private key from environment
 */
export async function getDemoIssuerPrivateKey(env: { DEMO_ISSUER_PRIVATE_KEY?: string }): Promise<any> {
  if (!env.DEMO_ISSUER_PRIVATE_KEY) {
    throw new Error('DEMO_ISSUER_PRIVATE_KEY not configured');
  }
  
  try {
    // Private key is stored as base64-encoded JSON in environment
    const privateKeyJson = atob(env.DEMO_ISSUER_PRIVATE_KEY);
    const privateJWK = JSON.parse(privateKeyJson);
    return await importJWK(privateJWK, 'EdDSA');
  } catch (error) {
    throw new Error(`Failed to load demo issuer private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get demo issuer public key in JWK format
 */
export async function getDemoIssuerPublicJWK(env: { DEMO_ISSUER_PRIVATE_KEY?: string }): Promise<any> {
  if (!env.DEMO_ISSUER_PRIVATE_KEY) {
    throw new Error('DEMO_ISSUER_PRIVATE_KEY not configured');
  }
  
  try {
    const privateKeyJson = atob(env.DEMO_ISSUER_PRIVATE_KEY);
    const privateJWK = JSON.parse(privateKeyJson);
    
    // Extract public key components
    const publicJWK = {
      kty: privateJWK.kty,
      crv: privateJWK.crv,
      x: privateJWK.x,
      kid: DEMO_ISSUER_KID,
      use: 'sig',
      alg: 'EdDSA'
    };
    
    return publicJWK;
  } catch (error) {
    throw new Error(`Failed to extract demo issuer public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get demo issuer key ID
 */
export function getDemoIssuerKid(): string {
  return DEMO_ISSUER_KID;
}

/**
 * Sign a demo consent token
 * 
 * @param payload - Token payload (must include policy, policy_hash, etc.)
 * @param env - Environment with DEMO_ISSUER_PRIVATE_KEY
 * @returns Signed JWS token string
 */
export async function signDemoToken(payload: Record<string, any>, env: { DEMO_ISSUER_PRIVATE_KEY?: string }): Promise<string> {
  const privateKey = await getDemoIssuerPrivateKey(env);
  
  // Create JWS
  const jwt = new SignJWT(payload)
    .setProtectedHeader({
      alg: 'EdDSA',
      typ: 'JWT',
      kid: DEMO_ISSUER_KID
    });
  
  const token = await jwt.sign(privateKey);
  return token;
}

/**
 * Generate a new demo issuer key pair (for initial setup)
 * 
 * This function is exported for use in setup scripts.
 * The generated private key should be base64-encoded and stored in DEMO_ISSUER_PRIVATE_KEY environment variable.
 * 
 * @returns Object with privateKeyBase64 (for env var) and publicJWK (for reference)
 */
export async function generateDemoIssuerKeyPair(): Promise<{ privateKeyBase64: string; publicJWK: any }> {
  // Generate Ed25519 key pair
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519'
  });
  
  // Export keys to JWK format
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  
  // Add key ID and metadata
  privateJWK.kid = DEMO_ISSUER_KID;
  privateJWK.alg = 'EdDSA';
  privateJWK.use = 'sig';
  
  publicJWK.kid = DEMO_ISSUER_KID;
  publicJWK.alg = 'EdDSA';
  publicJWK.use = 'sig';
  
  // Encode private key for storage
  const privateKeyJson = JSON.stringify(privateJWK);
  const privateKeyBase64 = btoa(privateKeyJson);
  
  return {
    privateKeyBase64,
    publicJWK
  };
}

