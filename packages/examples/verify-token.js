#!/usr/bin/env node

/**
 * Example: Verify an AgentOAuth Token
 * 
 * This script demonstrates how to verify a token.
 * Paste a token when prompted, or pipe it in.
 */

import { verify, decode } from '@agentoauth/sdk';
import { createInterface } from 'readline';
import chalk from 'chalk';

const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3000/.well-known/jwks.json';
const AUDIENCE = process.env.AUDIENCE || undefined;

async function verifyTokenInput(token) {
  console.log(chalk.bold.cyan('\n🔐 Verify AgentOAuth Token Example\n'));

  // Step 1: Decode token (without verification)
  console.log(chalk.blue('1️⃣ Decoding token...'));
  try {
    const { header, payload } = decode(token);
    console.log(chalk.green('✅ Token decoded\n'));
    
    console.log(chalk.bold('📄 Header:'));
    console.log(JSON.stringify(header, null, 2));
    
    console.log(chalk.bold('\n📦 Payload:'));
    console.log(JSON.stringify(payload, null, 2));
    console.log();

    // Step 2: Verify signature and claims
    console.log(chalk.blue('2️⃣ Verifying signature and claims...'));
    console.log(chalk.gray(`   JWKS URL: ${JWKS_URL}`));
    if (AUDIENCE) {
      console.log(chalk.gray(`   Expected Audience: ${AUDIENCE}`));
    }
    console.log();

    const result = await verify(token, JWKS_URL, {
      audience: AUDIENCE
    });

    // Display result
    if (result.valid) {
      console.log(chalk.bold.green('✅ TOKEN IS VALID\n'));
      console.log(chalk.green(`   JTI: ${result.payload.jti}`));
      console.log(chalk.green(`   User: ${result.payload.user}`));
      console.log(chalk.green(`   Agent: ${result.payload.agent}`));
      console.log(chalk.green(`   Scope: ${result.payload.scope}`));
      console.log(chalk.green(`   Limit: $${result.payload.limit.amount} ${result.payload.limit.currency}`));
      console.log(chalk.green(`   Expires: ${new Date(result.payload.exp * 1000).toISOString()}`));
    } else {
      console.log(chalk.bold.red('❌ TOKEN IS INVALID\n'));
      console.log(chalk.red(`   Error: ${result.error}`));
      console.log(chalk.red(`   Code: ${result.code}`));
      
      if (result.code === 'REVOKED') {
        console.log(chalk.yellow('\n⚠️  This token has been revoked'));
      } else if (result.code === 'REPLAY') {
        console.log(chalk.yellow('\n⚠️  Replay attack - this token was already used'));
      } else if (result.code === 'EXPIRED') {
        console.log(chalk.yellow('\n⚠️  This token has expired'));
      } else if (result.code === 'INVALID_AUDIENCE') {
        console.log(chalk.yellow('\n⚠️  This token is for a different audience'));
      }
    }
    
    console.log();

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    console.log();
    process.exit(1);
  }
}

// Main
if (process.stdin.isTTY) {
  // Interactive mode
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  
  rl.question(chalk.yellow('Paste token (or Ctrl+C to exit): '), async (token) => {
    rl.close();
    if (token && token.trim()) {
      await verifyTokenInput(token.trim());
    } else {
      console.log(chalk.red('No token provided'));
    }
  });
} else {
  // Piped input
  let token = '';
  process.stdin.on('data', chunk => { token += chunk; });
  process.stdin.on('end', async () => {
    if (token.trim()) {
      await verifyTokenInput(token.trim());
    }
  });
}

