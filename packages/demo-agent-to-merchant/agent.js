#!/usr/bin/env node

/**
 * AgentOAuth Demo - Payment Agent
 * 
 * This script simulates an AI agent that needs authorization to make payments.
 * It creates an AgentOAuth token and sends a payment request to a merchant.
 */

import { request } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'agent-private.json');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'agent-public.json');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    user: 'did:example:alice',
    agent: 'payment-bot@demo',
    amount: 150,
    currency: 'USD',
    limit: 1000,
    merchant: 'http://localhost:4000',
    scope: 'pay:merchant',
    description: 'Payment via AgentOAuth demo'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) parsed.user = args[++i];
    if (args[i] === '--agent' && args[i + 1]) parsed.agent = args[++i];
    if (args[i] === '--amount' && args[i + 1]) parsed.amount = parseFloat(args[++i]);
    if (args[i] === '--currency' && args[i + 1]) parsed.currency = args[++i];
    if (args[i] === '--limit' && args[i + 1]) parsed.limit = parseFloat(args[++i]);
    if (args[i] === '--merchant' && args[i + 1]) parsed.merchant = args[++i];
    if (args[i] === '--scope' && args[i + 1]) parsed.scope = args[++i];
    if (args[i] === '--description' && args[i + 1]) parsed.description = args[++i];
  }

  return parsed;
}

// Load or generate keys
async function getKeys() {
  // Create keys directory if it doesn't exist
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Check if keys exist
  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    console.log(chalk.blue('🔑 Loading existing keypair...'));
    const privateJWK = JSON.parse(readFileSync(PRIVATE_KEY_PATH, 'utf8'));
    const publicJWK = JSON.parse(readFileSync(PUBLIC_KEY_PATH, 'utf8'));
    return { privateJWK, publicJWK, kid: publicJWK.kid };
  }

  // Generate new keys
  console.log(chalk.blue('🔑 Generating new Ed25519 keypair...'));
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);

  const kid = `agent-key-${Date.now()}`;
  publicJWK.kid = kid;
  publicJWK.use = 'sig';
  publicJWK.alg = 'EdDSA';

  // Save keys
  writeFileSync(PRIVATE_KEY_PATH, JSON.stringify(privateJWK, null, 2));
  writeFileSync(PUBLIC_KEY_PATH, JSON.stringify(publicJWK, null, 2));

  console.log(chalk.green('✅ Keypair generated and saved'));
  console.log(chalk.gray(`   Private: ${PRIVATE_KEY_PATH}`));
  console.log(chalk.gray(`   Public: ${PUBLIC_KEY_PATH}`));

  return { privateJWK, publicJWK, kid };
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('\n🤖 AgentOAuth Payment Agent\n'));

  const config = parseArgs();

  // Display configuration
  console.log(chalk.bold('📝 Payment Request:'));
  console.log(chalk.gray(`   User: ${config.user}`));
  console.log(chalk.gray(`   Agent: ${config.agent}`));
  console.log(chalk.gray(`   Amount: ${chalk.yellow(`$${config.amount.toFixed(2)} ${config.currency}`)}`));
  console.log(chalk.gray(`   Limit: ${chalk.yellow(`$${config.limit.toFixed(2)} ${config.currency}`)}`));
  console.log(chalk.gray(`   Merchant: ${config.merchant}`));
  console.log(chalk.gray(`   Scope: ${config.scope}`));
  console.log();

  try {
    // Get or generate keys
    const { privateJWK, kid } = await getKeys();
    console.log(chalk.gray(`   Key ID: ${kid}\n`));

    // Create authorization token
    console.log(chalk.blue('🎫 Creating authorization token...'));
    
    const payload = {
      ver: '0.2',
      jti: crypto.randomUUID(), // v0.2: JWT ID for revocation/replay protection
      user: config.user,
      agent: config.agent,
      scope: config.scope,
      limit: {
        amount: config.limit,
        currency: config.currency
      },
      aud: 'merchant-demo',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      nonce: crypto.randomUUID()
    };

    const token = await request(payload, privateJWK, kid);
    console.log(chalk.green('✅ Token created'));
    console.log(chalk.gray(`   Preview: ${token.substring(0, 50)}...`));
    console.log();

    // Send payment to merchant
    console.log(chalk.blue('💸 Sending payment to merchant...'));
    console.log(chalk.gray(`   POST ${config.merchant}/api/payment`));
    console.log();

    const response = await fetch(`${config.merchant}/api/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authToken: token,
        amount: config.amount,
        currency: config.currency,
        description: config.description
      })
    });

    const result = await response.json();

    // Display result
    if (result.success) {
      console.log(chalk.bold.green('✅ Payment Successful!\n'));
      console.log(chalk.green(`   Transaction ID: ${result.transactionId}`));
      console.log(chalk.gray(`   Authorized by: ${result.authorizedBy}`));
      console.log(chalk.gray(`   Agent: ${result.agent}`));
      console.log(chalk.gray(`   Amount: $${result.amount.toFixed(2)} ${result.currency}`));
      console.log(chalk.gray(`   Timestamp: ${result.timestamp}`));
      if (result.remainingLimit !== undefined) {
        console.log(chalk.gray(`   Remaining limit: $${result.remainingLimit.toFixed(2)}`));
      }
    } else {
      console.log(chalk.bold.red('❌ Payment Failed!\n'));
      console.log(chalk.red(`   Error: ${result.error}`));
      console.log(chalk.red(`   Code: ${result.code}`));
      if (result.details) {
        console.log(chalk.gray(`   Details: ${JSON.stringify(result.details, null, 2)}`));
      }
    }

    console.log();

  } catch (error) {
    console.error(chalk.bold.red('\n❌ Error:'), error.message);
    if (error.code) {
      console.error(chalk.red(`   Code: ${error.code}`));
    }
    console.log();
    process.exit(1);
  }
}

main();

