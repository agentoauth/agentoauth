#!/usr/bin/env node
/**
 * Generate Demo Issuer Key Pair
 * 
 * This script generates an Ed25519 key pair for the playground demo issuer.
 * The private key is base64-encoded for storage in Cloudflare environment variables.
 * 
 * Usage:
 *   node scripts/generate-demo-key.js
 */

import { generateKeyPair, exportJWK } from 'jose';

async function generateDemoIssuerKey() {
  console.log('🔑 Generating demo issuer Ed25519 key pair...\n');
  
  // Generate Ed25519 key pair
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519'
  });
  
  // Export to JWK format
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  
  // Add metadata
  const DEMO_KID = 'demo-key-2025';
  
  privateJWK.kid = DEMO_KID;
  privateJWK.alg = 'EdDSA';
  privateJWK.use = 'sig';
  
  publicJWK.kid = DEMO_KID;
  publicJWK.alg = 'EdDSA';
  publicJWK.use = 'sig';
  
  // Encode private key for environment variable
  const privateKeyJson = JSON.stringify(privateJWK);
  const privateKeyBase64 = Buffer.from(privateKeyJson).toString('base64');
  
  console.log('✅ Key pair generated!\n');
  console.log('━'.repeat(80));
  console.log('\n📋 PUBLIC KEY (JWKS):\n');
  console.log(JSON.stringify({ keys: [publicJWK] }, null, 2));
  console.log('\n━'.repeat(80));
  console.log('\n🔐 PRIVATE KEY (for wrangler secret):\n');
  console.log(privateKeyBase64);
  console.log('\n━'.repeat(80));
  console.log('\n⚙️  To configure in Cloudflare Workers:\n');
  console.log('1. Copy the private key above');
  console.log('2. Run: wrangler secret put DEMO_ISSUER_PRIVATE_KEY');
  console.log('3. Paste the base64 string when prompted');
  console.log('\nOr add to .dev.vars for local testing:');
  console.log(`DEMO_ISSUER_PRIVATE_KEY=${privateKeyBase64}`);
  console.log('\n━'.repeat(80));
}

generateDemoIssuerKey().catch(console.error);

