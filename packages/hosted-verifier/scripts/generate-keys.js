#!/usr/bin/env node

/**
 * Generate API key signing keys and first demo API key
 * 
 * This script generates the EdDSA keypair needed for API key signing
 * and creates a demo API key for testing.
 */

import { generateKeyPair, exportJWK } from 'jose';
import { generateApiKey } from '../src/auth.js';

async function generateKeys() {
  console.log('🔑 Generating AgentOAuth Hosted Verifier Keys\n');
  
  // Generate EdDSA keypair for API key signing
  console.log('1️⃣ Generating EdDSA keypair for API key signing...');
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  
  console.log('✅ Keypair generated\n');
  
  // Display keys
  console.log('📋 API Key Signing Keys:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🔒 Private Key (set as API_KEY_PRIVATE_KEY secret):');
  console.log('wrangler secret put API_KEY_PRIVATE_KEY --env production');
  console.log('Enter this value when prompted:');
  console.log(JSON.stringify(privateJWK));
  
  console.log('\n🔓 Public Key (set as API_KEY_PUBLIC_KEY secret):');
  console.log('wrangler secret put API_KEY_PUBLIC_KEY --env production'); 
  console.log('Enter this value when prompted:');
  console.log(JSON.stringify(publicJWK));
  
  // Generate demo API key
  console.log('\n2️⃣ Generating demo API key...');
  
  const demoOrg = {
    id: 'demo-org-001',
    name: 'Demo Organization',
    tier: 'free'
  };
  
  const demoApiKey = await generateApiKey(demoOrg, privateKey);
  
  console.log('✅ Demo API key generated\n');
  
  console.log('🧪 Demo API Key:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(demoApiKey);
  
  console.log('\n💡 Usage Examples:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n# Test health endpoint:');
  console.log('curl https://verifier.agentoauth.org/health');
  
  console.log('\n# Test verify endpoint:');
  console.log(`curl -X POST https://verifier.agentoauth.org/verify \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${demoApiKey}" \\
  -d '{"token": "your-agentoauth-token", "audience": "merchant.example"}'`);
  
  console.log('\n# Check usage:');
  console.log(`curl -X GET https://verifier.agentoauth.org/usage \\
  -H "X-API-Key: ${demoApiKey}"`);
  
  console.log('\n🚀 Deployment Steps:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Set up Cloudflare domain and KV/R2 resources');
  console.log('2. Set API key secrets using the commands above');
  console.log('3. Generate audit salt: wrangler secret put AUDIT_SALT --env production');
  console.log('4. Update wrangler.toml with your actual KV namespace ID');
  console.log('5. Deploy: wrangler deploy --env production');
  console.log('6. Test with the demo API key above');
  
  console.log('\n🔒 Security Notes:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('• Keep the private key secure - never commit to git');
  console.log('• Rotate keys periodically');
  console.log('• Monitor API key usage for abuse');
  console.log('• Use different keys for production vs development');
  
  console.log('\n✅ Setup complete! Ready to deploy hosted verifier.\n');
}

generateKeys().catch(console.error);
