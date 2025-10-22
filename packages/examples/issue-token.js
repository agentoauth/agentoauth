#!/usr/bin/env node

/**
 * Example: Issue an AgentOAuth Token
 * 
 * This script demonstrates how to create an authorization token.
 */

import { request, decode } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import chalk from 'chalk';

async function main() {
  console.log(chalk.bold.cyan('\n🎫 Issue AgentOAuth Token Example\n'));

  // Step 1: Generate key pair
  console.log(chalk.blue('1️⃣ Generating Ed25519 keypair...'));
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = 'example-key-1';
  console.log(chalk.green('✅ Keypair generated'));
  console.log(chalk.gray(`   Key ID: ${publicJWK.kid}\n`));

  // Step 2: Create authorization payload
  console.log(chalk.blue('2️⃣ Creating authorization payload...'));
  const payload = {
    ver: '0.2',
    jti: crypto.randomUUID(), // Unique token ID (auto-generated if omitted)
    user: 'did:example:alice',
    agent: 'payment-bot@example',
    scope: 'pay:merchant',
    limit: {
      amount: 1000,
      currency: 'USD'
    },
    aud: 'merchant.example',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    nonce: crypto.randomUUID()
  };

  console.log(chalk.yellow('Payload:'));
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  // Step 3: Sign the token
  console.log(chalk.blue('3️⃣ Signing token...'));
  const token = await request(payload, privateJWK, publicJWK.kid);
  console.log(chalk.green('✅ Token created\n'));

  // Display token
  console.log(chalk.bold('📋 Token (JWS Compact):'));
  console.log(chalk.cyan(token));
  console.log();

  // Decode and display
  console.log(chalk.blue('4️⃣ Decoding token (for verification)...'));
  const { header, payload: decodedPayload } = decode(token);
  
  console.log(chalk.bold('\n📄 Header:'));
  console.log(JSON.stringify(header, null, 2));
  
  console.log(chalk.bold('\n📦 Payload:'));
  console.log(JSON.stringify(decodedPayload, null, 2));
  
  console.log(chalk.bold('\n🔐 Signature:'));
  console.log(chalk.gray(token.split('.')[2].substring(0, 50) + '...'));

  // Summary
  console.log(chalk.bold.green('\n✅ Token Summary:'));
  console.log(chalk.gray(`   JTI: ${decodedPayload.jti}`));
  console.log(chalk.gray(`   User: ${decodedPayload.user}`));
  console.log(chalk.gray(`   Agent: ${decodedPayload.agent}`));
  console.log(chalk.gray(`   Scope: ${decodedPayload.scope}`));
  console.log(chalk.gray(`   Limit: $${decodedPayload.limit.amount} ${decodedPayload.limit.currency}`));
  console.log(chalk.gray(`   Expires: ${new Date(decodedPayload.exp * 1000).toISOString()}`));
  console.log();

  // Next steps
  console.log(chalk.bold.yellow('📝 Next Steps:'));
  console.log(chalk.gray('   • Save this token to use with verify-token.js'));
  console.log(chalk.gray('   • Send it to a merchant/verifier'));
  console.log(chalk.gray('   • Verify it: node verify-token.js'));
  console.log();
}

main().catch(console.error);

