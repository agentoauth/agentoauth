/**
 * Receipt signing (Workers-compatible)
 * 
 * JWS-signed receipts for policy evaluation audit trail
 * Uses Web Crypto API
 */

import { SignJWT, importJWK, type JWK } from 'jose';

export interface Receipt {
  version: 'receipt.v0.2';
  id: string;
  policy_id: string;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  timestamp: number; // Unix seconds
  remaining?: {
    amount?: number;
    currency?: string;
    period_ends?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Sign a receipt with JWS
 */
export async function signReceipt(
  receipt: Omit<Receipt, 'version'>,
  privateKey: JWK,
  keyId: string
): Promise<string> {
  const payload = {
    ...receipt,
    version: 'receipt.v0.2' as const
  };
  
  // Import the JWK
  const key = await importJWK(privateKey, privateKey.alg);
  
  const jwt = new SignJWT(payload)
    .setProtectedHeader({
      alg: privateKey.alg || 'EdDSA',
      kid: keyId,
      typ: 'JWT'
    })
    .setIssuedAt(Math.floor(Date.now() / 1000));
  
  return await jwt.sign(key);
}

/**
 * Create a receipt ID
 */
export function createReceiptId(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `rcpt_${hex}`;
}

