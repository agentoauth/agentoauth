#!/usr/bin/env node

/**
 * Generate API key signing keys and first demo API key
 * 
 * This script generates the EdDSA keypair needed for API key signing
 * and creates a demo API key for testing.
 */

import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import chalk from 'chalk';

async function generateKeys() {
  console.log('🔑 Generating AgentOAuth Hosted Verifier Keys\n');
  
  // Generate EdDSA keypair for API key signing
  console.log('1️⃣ Generating EdDSA keypair for API key signing...');
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  
  // Add algorithm to JWKs
  privateJWK.alg = 'EdDSA';
  publicJWK.alg = 'EdDSA';
  
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
  
  // Inline API key generation (standalone)
  const payload = {
    sub: demoOrg.id,
    name: demoOrg.name,
    tier: demoOrg.tier,
    quotas: { daily: 1000, monthly: 10000 }, // Free tier quotas
    iss: 'agentoauth.org',
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
  };
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .sign(privateKey);
    
  const demoApiKey = `ak_${jwt}`;
  
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
  
  // Generate receipt signing keys
  console.log('\n3️⃣ Generating receipt signing keys...');
  const { privateKey: receiptPrivateKey, publicKey: receiptPublicKey } = await generateKeyPair('EdDSA');
  
  const receiptPrivateJWK = await exportJWK(receiptPrivateKey);
  const receiptPublicJWK = await exportJWK(receiptPublicKey);
  
  receiptPrivateJWK.alg = 'EdDSA';
  receiptPublicJWK.alg = 'EdDSA';
  
  const receiptKid = `receipt-key-${Date.now()}`;
  
  console.log('✅ Receipt signing keys generated\n');
  
  console.log('📋 Receipt Signing Keys:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🔒 Receipt Private Key (set as SIGNING_PRIVATE_KEY secret):');
  console.log('wrangler secret put SIGNING_PRIVATE_KEY --env production');
  console.log('Enter this value when prompted:');
  console.log(JSON.stringify(receiptPrivateJWK));
  
  console.log('\n🆔 Receipt Key ID (set as SIGNING_KID secret):');
  console.log('wrangler secret put SIGNING_KID --env production');
  console.log('Enter this value when prompted:');
  console.log(receiptKid);
  
  console.log('\n🚀 Deployment Steps:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Set up Cloudflare domain and KV/R2 resources');
  console.log('2. Set all 4 secrets using the commands above');
  console.log('3. Generate audit salt: wrangler secret put AUDIT_SALT --env production');
  console.log('   Enter a random string like: agentoauth-audit-salt-' + Date.now());
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
  
  // Step 4: Generate .env.local file
  console.log('4️⃣ Generating .env.local file...');
  
  const envContent = `# Cloudflare Workers Secrets (Auto-generated)
# DO NOT commit this file to git!
# Generated: ${new Date().toISOString()}

# API Key Public Key (for verifying API keys)
API_KEY_PUBLIC_KEY=${JSON.stringify(publicJWK)}

# Audit Salt (for hashing PII in logs)
AUDIT_SALT=agentoauth-audit-salt-${Date.now()}

# Receipt Signing Private Key (for signing JWS receipts)
SIGNING_PRIVATE_KEY=${JSON.stringify(receiptPrivateJWK)}

# Receipt Signing Key ID
SIGNING_KID=${receiptKid}
`;
  
  const { writeFile } = await import('fs/promises');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, '..', '.env.local');
  
  await writeFile(envPath, envContent, 'utf-8');
  
  console.log(chalk.green('✅ .env.local created with all secrets\n'));
  
  console.log(chalk.bold.yellow('🚀 Ready to Deploy!\n'));
  console.log(chalk.gray('Run: pnpm run deploy:auto\n'));
}

generateKeys().catch(console.error);
