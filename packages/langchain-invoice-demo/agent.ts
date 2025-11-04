#!/usr/bin/env tsx

/**
 * AgentOAuth × LangChain Invoice Payer Demo
 * 
 * An autonomous finance agent that pays invoices through Stripe,
 * with every payment gated by AgentOAuth policy verification.
 */

import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { request } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import Stripe from 'stripe';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

import { createVerifyAndPayTool } from './tools/verify-and-pay.js';
import { createTravelPolicy } from './utils/policy.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     🤖 AgentOAuth × LangChain Invoice Payer Demo            ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════╝\n'));
  
  // Validate environment
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(chalk.red('❌ STRIPE_SECRET_KEY not set in .env'));
    console.log(chalk.yellow('\nGet your test key from: https://dashboard.stripe.com/test/apikeys'));
    console.log(chalk.gray('Then: cp .env.example .env and add your keys\n'));
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('❌ OPENAI_API_KEY not set in .env'));
    console.log(chalk.yellow('\nGet your API key from: https://platform.openai.com/api-keys'));
    console.log(chalk.gray('Then: cp .env.example .env and add your keys\n'));
    process.exit(1);
  }
  
  const verifierUrl = process.env.VERIFIER_URL || 'https://verifier.agentoauth.org';
  
  // Step 1: Load invoices
  console.log(chalk.blue('📄 Loading invoices...'));
  const invoicesPath = join(__dirname, 'invoices.json');
  const invoicesData = await readFile(invoicesPath, 'utf-8');
  const invoices = JSON.parse(invoicesData);
  console.log(chalk.green(`✅ Loaded ${invoices.length} invoices\n`));
  
  // Step 2: Generate signing keypair
  console.log(chalk.blue('🔑 Generating signing keypair...'));
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  publicJWK.alg = 'EdDSA';
  publicJWK.kid = 'finance-agent-key-1';
  console.log(chalk.green(`✅ Keypair generated (kid: ${publicJWK.kid})\n`));
  
  // Step 3: Create policy
  console.log(chalk.blue('📋 Creating payment policy...'));
  const policy = createTravelPolicy();
  console.log(chalk.green('✅ Policy created:'));
  console.log(chalk.gray(`   Per-transaction limit: $${policy.limits.per_txn.amount} ${policy.limits.per_txn.currency}`));
  console.log(chalk.gray(`   Weekly budget: $${policy.limits.per_period.amount} ${policy.limits.per_period.currency}`));
  console.log(chalk.gray(`   Allowed merchants: ${policy.resources[0].match.ids.join(', ')}`));
  console.log(chalk.gray(`   Policy ID: ${policy.id}\n`));
  
  // Step 4: Issue consent token
  console.log(chalk.blue('🎫 Issuing consent token...'));
  
  // Import hashPolicy
  const { hashPolicy } = await import('@agentoauth/sdk');
  
  // Build payload manually to include iss claim
  const payload = {
    ver: 'act.v0.2' as const,
    jti: crypto.randomUUID(),
    user: 'did:user:alice',
    agent: 'did:agent:finance-assistant',
    scope: 'payments.send',
    limit: {
      amount: policy.limits.per_period.amount,
      currency: policy.limits.per_period.currency
    },
    policy,
    policy_hash: hashPolicy(policy),
    iss: 'finance.example.com', // Required for keyless verification
    aud: 'merchant.example',
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    nonce: crypto.randomUUID()
  };
  
  const token = await request(payload, privateJWK, publicJWK.kid);
  console.log(chalk.green('✅ Consent token issued'));
  console.log(chalk.gray(`   Token preview: ${token.substring(0, 50)}...`));
  console.log(chalk.gray(`   Issuer (iss): ${payload.iss}`));
  console.log(chalk.gray(`   Audience (aud): ${payload.aud}`));
  console.log(chalk.gray(`   Policy ID: ${payload.policy.id}`));
  console.log(chalk.gray(`   Policy Hash: ${payload.policy_hash}\n`));
  
  // Step 5: Initialize Stripe
  console.log(chalk.blue('💳 Initializing Stripe (test mode)...'));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-10-28.acacia'
  });
  console.log(chalk.green('✅ Stripe initialized\n'));
  
  // Step 6: Create LangChain tool
  console.log(chalk.blue('🔧 Creating LangChain tool...'));
  const verifyAndPayTool = createVerifyAndPayTool({
    consentToken: token,
    stripeClient: stripe,
    verifierUrl
  });
  console.log(chalk.green('✅ Tool created\n'));
  
  // Step 7: Create LangChain agent
  console.log(chalk.blue('🤖 Initializing LangChain agent...'));
  const model = new ChatOpenAI({
    model: 'gpt-4',
    temperature: 0
  });
  
  const agent = createReactAgent({
    llm: model,
    tools: [verifyAndPayTool]
  });
  console.log(chalk.green('✅ Agent ready\n'));
  
  // Step 8: Process invoices
  console.log(chalk.bold.magenta('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.magenta('                   PROCESSING INVOICES'));
  console.log(chalk.bold.magenta('═══════════════════════════════════════════════════════════════\n'));
  
  const prompt = `You are a Finance Agent responsible for paying vendor invoices.

Your task: Process each of these invoices by calling the verify_and_pay tool:

${JSON.stringify(invoices, null, 2)}

For each invoice:
1. Call verify_and_pay with the invoice details
2. Log whether it was PAID or DENIED
3. Continue to the next invoice even if one fails

After processing all invoices, provide a summary including:
- Total invoices processed
- How many were paid vs denied
- Total amount paid
- Remaining budget
- Any notable issues

Be thorough and systematic.`;
  
  const result = await agent.invoke({
    messages: [{ role: 'user', content: prompt }]
  });
  
  // Display agent's summary
  console.log(chalk.bold.magenta('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.magenta('                      AGENT SUMMARY'));
  console.log(chalk.bold.magenta('═══════════════════════════════════════════════════════════════\n'));
  
  const finalMessage = result.messages[result.messages.length - 1];
  console.log(chalk.white(finalMessage.content));
  console.log();
  
  // Additional info
  console.log(chalk.bold.cyan('\n📊 Demo Complete!\n'));
  console.log(chalk.gray('Next steps:'));
  console.log(chalk.gray(`  • View receipts: ${verifierUrl}/receipts/:id`));
  console.log(chalk.gray('  • Check Stripe dashboard: https://dashboard.stripe.com/test/payments'));
  console.log(chalk.gray('  • Inspect payment metadata for AgentOAuth receipt_id\n'));
  
  console.log(chalk.bold.green('✅ Demo completed successfully!\n'));
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  if (error.stack) {
    console.error(chalk.gray(error.stack));
  }
  process.exit(1);
});

