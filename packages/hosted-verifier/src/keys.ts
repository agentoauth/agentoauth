import { importJWK } from 'jose';

/**
 * Load public keys for token verification from environment
 * This would typically load from a JWKS endpoint or KV storage
 */
export async function loadPublicKeys(): Promise<{
  keys: Array<{
    kty: string;
    crv: string;
    x: string;
    kid: string;
    use: string;
    alg: string;
  }>;
}> {
  // For demo purposes, return a basic JWKS structure
  // In production, this would load from a configured JWKS endpoint
  return {
    keys: [
      {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'demo-public-key-x-value',
        kid: 'demo-key-1',
        use: 'sig',
        alg: 'EdDSA'
      }
    ]
  };
}

/**
 * Find public key by kid from JWKS
 */
export async function findPublicKey(kid: string): Promise<any | null> {
  try {
    const jwks = await loadPublicKeys();
    const keyData = jwks.keys.find(key => key.kid === kid);
    
    if (!keyData) {
      return null;
    }
    
    return await importJWK(keyData);
  } catch (error) {
    console.error('Error loading public key:', error);
    return null;
  }
}
