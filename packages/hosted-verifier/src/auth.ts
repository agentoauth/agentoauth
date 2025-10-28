import { jwtVerify, SignJWT, importJWK } from 'jose';

export interface ApiKeyPayload {
  sub: string;        // Organization ID
  name: string;       // Organization name
  tier: 'free' | 'pro' | 'enterprise';
  quotas: {
    daily: number;    // Daily verification limit
    monthly: number;  // Monthly verification limit
  };
  iss: 'agentoauth.org';
  exp: number;
}

/**
 * Verify API key JWT and extract organization info
 */
export async function verifyApiKey(apiKey: string, publicKey: any): Promise<{
  valid: boolean;
  payload?: ApiKeyPayload;
  error?: string;
}> {
  try {
    if (!apiKey.startsWith('ak_')) {
      return { valid: false, error: 'Invalid API key format' };
    }
    
    const jwt = apiKey.slice(3); // Remove 'ak_' prefix
    const { payload } = await jwtVerify(jwt, publicKey);
    
    return {
      valid: true,
      payload: payload as ApiKeyPayload
    };
  } catch (error) {
    return {
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid API key'
    };
  }
}

/**
 * Generate API key for organization
 */
export async function generateApiKey(
  org: { id: string; name: string; tier: 'free' | 'pro' | 'enterprise' },
  privateKey: any
): Promise<string> {
  const payload: ApiKeyPayload = {
    sub: org.id,
    name: org.name,
    tier: org.tier,
    quotas: getQuotasForTier(org.tier),
    iss: 'agentoauth.org',
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
  };
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .sign(privateKey);
    
  return `ak_${jwt}`;
}

export function getQuotasForTier(tier: string) {
  const quotas = {
    free: { daily: 1000, monthly: 10000 },
    pro: { daily: 50000, monthly: 1000000 },
    enterprise: { daily: 500000, monthly: 10000000 }
  };
  return quotas[tier] || quotas.free;
}

/**
 * Load API key public key from environment or KV
 */
export async function loadApiKeyPublicKey(publicKeyJson: string): Promise<any> {
  try {
    const keyData = JSON.parse(publicKeyJson);
    return await importJWK(keyData);
  } catch (error) {
    throw new Error(`Failed to load API key public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
