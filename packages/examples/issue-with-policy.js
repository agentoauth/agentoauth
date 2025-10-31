#!/usr/bin/env node

/**
 * Example: Issue an AgentOAuth Token with Policy (v0.2)
 * 
 * Demonstrates creating a token with structured policy rules.
 */

import { issueConsent, buildPolicyV2 } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import crypto from 'crypto';
import chalk from 'chalk';

async function main() {
  console.log(chalk.bold.cyan('\n🎫 Issue AgentOAuth Token with Policy Example\n'));

  // Step 1: Generate key pair
  console.log(chalk.blue('1️⃣ Generating Ed25519 keypair...'));
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = 'example-policy-key-1';
  console.log(chalk.green('✅ Keypair generated'));
  console.log(chalk.gray(`   Key ID: ${publicJWK.kid}\n`));

  // Step 2: Create policy using fluent API
  console.log(chalk.blue('2️⃣ Creating policy using fluent API...'));
  const policy = buildPolicyV2()
    .id(`pol_${crypto.randomBytes(12).toString('hex')}`)
    .actions(['payments.send', 'payments.review'])
    .merchants(['airbnb', 'expedia', 'booking'])
    .limitPerTxn(500, 'USD')
    .limitPerPeriod(1500, 'USD', 'week')
    .timeWindow({
      dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      start: '08:00',
      end: '20:00',
      tz: 'America/Los_Angeles'
    })
    .strict(true)
    .meta({ note: 'Business travel policy', created: new Date().toISOString() })
    .finalize();
  
  console.log(chalk.green('✅ Policy created'));
  console.log(chalk.yellow('\nPolicy:'));
  console.log(JSON.stringify(policy, null, 2));
  console.log();

  // Step 3: Issue token with policy
  console.log(chalk.blue('3️⃣ Issuing token with policy...'));
  const { token, keyId } = await issueConsent({
    user: 'did:example:alice',
    agent: 'travel-assistant@company.com',
    scope: 'payments.send',
    limit: { amount: 1500, currency: 'USD' },
    policy: policy,
    privateKey: privateJWK,
    keyId: publicJWK.kid,
    expiresIn: '7d'
  });
  
  console.log(chalk.green('✅ Token issued with policy\n'));

  // Display token
  console.log(chalk.bold('📋 Token (JWS Compact):'));
  console.log(chalk.cyan(token));
  console.log();
  console.log(chalk.gray('👆 Copy the entire token above for use in verify-with-policy.js'));
  console.log();

  // Decode and show payload
  const { decode } = await import('@agentoauth/sdk');
  const { payload } = decode(token);
  
  console.log(chalk.bold('📦 Token Payload:'));
  console.log(JSON.stringify({
    ver: payload.ver,
    jti: payload.jti,
    user: payload.user,
    agent: payload.agent,
    scope: payload.scope,
    policy_id: payload.policy?.id,
    policy_hash: payload.policy_hash?.substring(0, 20) + '...',
    exp: new Date(payload.exp * 1000).toISOString()
  }, null, 2));
  console.log();

  // Show policy in token
  console.log(chalk.bold('🔐 Policy in Token:'));
  console.log(JSON.stringify(payload.policy, null, 2));
  console.log();

  console.log(chalk.green('🎉 Token with policy created successfully!\n'));
  console.log(chalk.gray('Next steps:'));
  console.log(chalk.gray('  1. Start verifier: cd ../verifier-api && pnpm dev'));
  console.log(chalk.gray('  2. Test verification with: curl -X POST http://localhost:3000/verify'));
  console.log(chalk.gray('     - Body: {"token":"...","action":"payments.send","amount":250,"currency":"USD","resource":{"type":"merchant","id":"airbnb"}}'));
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error.message);
  process.exit(1);
});

