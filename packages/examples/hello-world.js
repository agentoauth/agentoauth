#!/usr/bin/env node

/**
 * AgentOAuth Hello World Demo
 * 
 * A 5-minute demo showing policy creation, token issuance, and verification.
 * Demonstrates ALLOW vs DENY decisions using the hosted verifier.
 * 
 * Run: node packages/examples/hello-world.js
 */

import { issueConsent, buildPolicyV2 } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import crypto from 'crypto';

const HOSTED_VERIFIER_URL = 'https://verifier.agentoauth.org/verify';

// Colors for pretty output (fallback if chalk not available)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n--- AgentOAuth Hello World ---\n', 'bold');
  
  // Step 1: Create Policy
  log('Policy:', 'bold');
  log('• Allow agent "demo-agent" to pay up to $200/week');
  log('• Merchant: merchant.example\n', 'gray');
  
  const policy = buildPolicyV2()
    .id(`pol_${crypto.randomBytes(12).toString('hex')}`)
    .actions(['payments.send'])
    .merchants(['merchant.example'])
    .limitPerPeriod(200, 'USD', 'week')
    .finalize();
  
  log('Policy Definition:', 'blue');
  console.log(JSON.stringify(policy, null, 2));
  console.log();
  
  // Step 2: Generate keys and issue token
  log('Generating keys and issuing token...', 'blue');
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const privateJWK = await exportJWK(privateKey);
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = 'demo-key-1';
  
  const { token } = await issueConsent({
    user: 'demo-user',
    agent: 'demo-agent',
    scope: 'payments.send',
    policy: policy,
    privateKey: privateJWK,
    keyId: publicJWK.kid,
    iss: 'demo-issuer',
    expiresIn: '1h'
  });
  
  log('✅ Token issued\n', 'green');
  log(`Token: ${token.substring(0, 50)}...\n`, 'gray');
  
  // Step 3: Attempt #1 - $150 payment (should ALLOW)
  log('Attempt #1:', 'bold');
  log('Agent tries to pay: $150', 'blue');
  
  try {
    const response1 = await fetch(HOSTED_VERIFIER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        action: 'payments.send',
        resource: { type: 'merchant', id: 'merchant.example' },
        amount: 150,
        currency: 'USD'
      })
    });
    
    const result1 = await response1.json();
    
    if (result1.decision === 'ALLOW') {
      log('→ Decision: ALLOW', 'green');
      log(`→ Reason: Within policy limit`, 'green');
      if (result1.receipt_id) {
        log(`→ Receipt ID: ${result1.receipt_id}`, 'green');
      }
      if (result1.remaining_budget) {
        log(`→ Remaining Budget: $${result1.remaining_budget.amount} ${result1.remaining_budget.currency}`, 'green');
      }
    } else {
      log('→ Decision: DENY', 'red');
      log(`→ Error Code: ${result1.code || 'POLICY_DENY'}`, 'red');
      log(`→ Reason: ${result1.reason || result1.error || 'Policy violation'}`, 'red');
    }
  } catch (error) {
    log(`→ Error: ${error.message}`, 'red');
    log('Note: Hosted verifier may require API key or may be unavailable', 'yellow');
    log('For local testing, start verifier-api and use http://localhost:3000/verify', 'gray');
  }
  
  console.log();
  
  // Step 4: Attempt #2 - $500 payment (should DENY)
  log('Attempt #2:', 'bold');
  log('Agent tries to pay: $500', 'blue');
  
  try {
    const response2 = await fetch(HOSTED_VERIFIER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        action: 'payments.send',
        resource: { type: 'merchant', id: 'merchant.example' },
        amount: 500,
        currency: 'USD'
      })
    });
    
    const result2 = await response2.json();
    
    if (result2.decision === 'ALLOW') {
      log('→ Decision: ALLOW', 'green');
      log(`→ Reason: ${result2.reason || 'Within policy limit'}`, 'green');
    } else {
      log('→ Decision: DENY', 'red');
      log(`→ Error Code: ${result2.code || 'POLICY_DENY'}`, 'red');
      log(`→ Reason: ${result2.reason || result2.error || 'Payment amount exceeds weekly limit of $200'}`, 'red');
    }
  } catch (error) {
    log(`→ Error: ${error.message}`, 'red');
    log('Note: Hosted verifier may require API key or may be unavailable', 'yellow');
    log('For local testing, start verifier-api and use http://localhost:3000/verify', 'gray');
  }
  
  console.log();
  log('--- Demo Complete ---\n', 'bold');
  log('This demonstrates how AgentOAuth enforces scoped consent with verifiable policies.', 'gray');
  log('The verifier evaluates the policy and returns ALLOW/DENY decisions with clear reasons.\n', 'gray');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

