/**
 * Receipt signing and verification
 * 
 * JWS-signed receipts for policy evaluation audit trail
 */

import { SignJWT, importJWK, type JWK } from 'jose';
import crypto from 'node:crypto';

export interface Receipt {
  version: 'receipt.v0.2';
  id: string;
  policy_id: string;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  timestamp: number; // Unix seconds
  remaining?: {
    period?: number;
    currency?: string;
  };
  intent_verified?: boolean; // (v0.3) Whether intent was validated
  intent_valid_until?: string; // (v0.3) ISO 8601 timestamp when intent expires
  intent_approved_at?: string; // (v0.3) ISO 8601 timestamp when intent was approved
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
  
  // Import the JWK to a KeyObject
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
  const randomBytes = crypto.randomBytes(16);
  return `receipt_${randomBytes.toString('hex')}`;
}

