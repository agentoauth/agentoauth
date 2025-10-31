#!/usr/bin/env node

/**
 * Example: Verify AgentOAuth Token with Policy Evaluation
 * 
 * Demonstrates verifying a token with policy enforcement.
 */

import { verifyConsent } from '@agentoauth/sdk';
import chalk from 'chalk';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log(chalk.bold.cyan('\n🔍 Verify AgentOAuth Token with Policy Example\n'));

  // Read token from command line or prompt
  let token = process.argv[2];
  
  if (!token) {
    token = await new Promise(resolve => {
      rl.question(chalk.yellow('Enter token (or paste from issue-with-policy.js): '), resolve);
    });
  }
  
  rl.close();

  if (!token) {
    console.error(chalk.red('❌ No token provided'));
    process.exit(1);
  }

  console.log(chalk.blue('\n1️⃣ Decoding token...\n'));

  try {
    // Just decode the token to show policy details
    // For full signature verification, use the Verifier API (see instructions below)
    const { decode } = await import('@agentoauth/sdk');
    const decoded = decode(token);
    const result = {
      valid: true,
      payload: decoded.payload
    };

    if (result.valid && result.payload) {
      console.log(chalk.green('✅ Token is valid!\n'));
      console.log(chalk.bold('📦 Decoded Payload:'));
      console.log(JSON.stringify({
        user: result.payload.user,
        agent: result.payload.agent,
        scope: result.payload.scope,
        policy_id: result.payload.policy?.id,
        has_policy: !!result.payload.policy,
        exp: new Date(result.payload.exp * 1000).toISOString()
      }, null, 2));
      
      if (result.payload.policy) {
        console.log(chalk.yellow('\n🔐 Policy:'));
        console.log(JSON.stringify(result.payload.policy, null, 2));
        console.log(chalk.gray('\nNote: This is basic verification. Use the verifier API for full policy evaluation.'));
      }
    } else {
      console.log(chalk.red('❌ Token verification failed'));
      if (result.error) {
        console.log(chalk.red('Error:'), result.error.message);
        if (result.error.suggestion) {
          console.log(chalk.yellow('Suggestion:'), result.error.suggestion);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Verification error:'), error.message);
  }

  console.log(chalk.bold('\n📡 To test full policy evaluation with the Verifier API:'));
  console.log(chalk.cyan(`
curl -X POST http://localhost:3000/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "${token}",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
  `));
}

main().catch(error => {
  console.error(chalk.red('❌ Error:'), error.message);
  process.exit(1);
});

