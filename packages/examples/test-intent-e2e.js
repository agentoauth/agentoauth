#!/usr/bin/env node

/**
 * E2E Test for Intent Validation (act.v0.3)
 * 
 * Tests WebAuthn intent approval with time-bound validity
 * 
 * PREREQUISITE: Start the verifier API first in another terminal:
 *   cd packages/verifier-api && pnpm dev
 * 
 * Then run this test:
 *   node test-intent-e2e.js
 */

import chalk from 'chalk';
import { buildPolicyV2, hashPolicy } from '@agentoauth/sdk';
import crypto from 'crypto';

const VERIFIER_PORT = 3000;
const VERIFIER_URL = `http://localhost:${VERIFIER_PORT}`;

// Mock intent helper (simulates WebAuthn output)
function createMockIntent(policy, durationDays, expired = false) {
  const approvedAt = new Date();
  const validUntil = expired 
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)  // Yesterday (expired)
    : new Date(approvedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  const policyHash = hashPolicy(policy);
  
  return {
    type: 'webauthn.v0',
    credential_id: 'mock_credential_' + crypto.randomBytes(16).toString('base64url'),
    signature: crypto.randomBytes(64).toString('base64url'),
    client_data_json: Buffer.from(JSON.stringify({
      type: 'webauthn.get',
      challenge: policyHash,
      origin: 'http://localhost:3001'
    })).toString('base64url'),
    authenticator_data: crypto.randomBytes(37).toString('base64url'),
    approved_at: approvedAt.toISOString(),
    valid_until: validUntil.toISOString(),
    challenge: policyHash,
    rp_id: 'localhost'
  };
}

// Check if verifier is running
async function checkVerifier() {
  try {
    const response = await fetch(`${VERIFIER_URL}/health`);
    if (response.ok) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

// Run tests
async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║            INTENT VALIDATION E2E TESTS (act.v0.3)                ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════════════╝\n'));
  
  // Get verifier's public key from JWKS
  console.log(chalk.gray('Fetching verifier JWKS...'));
  const jwksResponse = await fetch(`${VERIFIER_URL}/.well-known/jwks.json`);
  if (!jwksResponse.ok) {
    throw new Error('Failed to fetch JWKS from verifier');
  }
  const jwks = await jwksResponse.json();
  const publicJWK = jwks.keys[0];
  console.log(chalk.green(`✅ Got public key: ${publicJWK.kid}\n`));
  
  // Generate matching private key for demo (in real scenario, agent has its own keys)
  // For testing, we'll use the demo endpoint to create tokens
  console.log(chalk.gray('Setting up test environment...'));
  
  // Build test policy
  const policy = buildPolicyV2()
    .id('pol_intent_test_01')
    .actions(['payments.send'])
    .merchants(['airbnb', 'uber'])
    .limitPerTxn(500, 'USD')
    .limitPerPeriod(2000, 'USD', 'week')
    .strict(true)
    .finalize();
  
  const policyHash = hashPolicy(policy);
  
  // Test 1: Valid intent (v0.3) - should ALLOW
  try {
    console.log(chalk.yellow('\n📝 Test 1: Valid Intent (30 days) - should ALLOW'));
    
    const intent = createMockIntent(policy, 30, false);
    
    // Use demo endpoint to create token with verifier's key
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:user:alice',
        agent: 'did:agent:test',
        scope: 'payments.send',
        policy,
        intent,
        audience: 'merchant.example',
        expiresIn: 3600
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create token: ${error.error || 'Unknown error'}`);
    }
    
    const { token } = await createResponse.json();
    
    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        audience: 'merchant.example',
        action: 'payments.send',
        resource: { type: 'merchant', id: 'airbnb' },
        amount: 300,
        currency: 'USD'
      })
    });
    
    const result = await response.json();
    
    if (result.valid !== undefined && result.policy_decision?.allowed) {
      console.log(chalk.green('✅ Test 1 PASSED'));
      console.log(chalk.gray(`   Intent verified: ${result.policy_decision?.receipt?.intent_verified || 'N/A'}`));
      results.passed++;
      results.tests.push({ name: 'Test 1', status: 'PASSED' });
    } else {
      throw new Error(`Expected ALLOW, got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Test 1 FAILED'));
    console.log(chalk.red(`   ${error.message}`));
    results.failed++;
    results.tests.push({ name: 'Test 1', status: 'FAILED', error: error.message });
  }
  
  // Test 2: Expired intent - should DENY with INTENT_EXPIRED
  try {
    console.log(chalk.yellow('\n📝 Test 2: Expired Intent - should DENY'));
    
    const expiredIntent = createMockIntent(policy, 30, true); // expired = true
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:user:alice',
        agent: 'did:agent:test',
        scope: 'payments.send',
        policy,
        intent: expiredIntent,
        audience: 'merchant.example',
        expiresIn: 3600
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create token: ${error.error || 'Unknown error'}`);
    }
    
    const { token } = await createResponse.json();
    
    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        audience: 'merchant.example',
        action: 'payments.send',
        resource: { type: 'merchant', id: 'airbnb' },
        amount: 300,
        currency: 'USD'
      })
    });
    
    const result = await response.json();
    
    if (result.code === 'INTENT_EXPIRED' && result.valid === false) {
      console.log(chalk.green('✅ Test 2 PASSED'));
      console.log(chalk.gray(`   Error: ${result.error}`));
      results.passed++;
      results.tests.push({ name: 'Test 2', status: 'PASSED' });
    } else {
      throw new Error(`Expected INTENT_EXPIRED, got: ${result.code || 'no code'}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Test 2 FAILED'));
    console.log(chalk.red(`   ${error.message}`));
    results.failed++;
    results.tests.push({ name: 'Test 2', status: 'FAILED', error: error.message });
  }
  
  // Test 3: Policy hash mismatch - should DENY with INTENT_POLICY_MISMATCH
  try {
    console.log(chalk.yellow('\n📝 Test 3: Policy Hash Mismatch - should DENY'));
    
    const intent = createMockIntent(policy, 30, false);
    // Tamper with the challenge
    intent.challenge = 'sha256:wronghash123';
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:user:alice',
        agent: 'did:agent:test',
        scope: 'payments.send',
        policy,
        intent,
        audience: 'merchant.example',
        expiresIn: 3600
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create token: ${error.error || 'Unknown error'}`);
    }
    
    const { token } = await createResponse.json();
    
    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        audience: 'merchant.example',
        action: 'payments.send',
        resource: { type: 'merchant', id: 'airbnb' },
        amount: 300,
        currency: 'USD'
      })
    });
    
    const result = await response.json();
    
    if (result.code === 'INTENT_POLICY_MISMATCH' && result.valid === false) {
      console.log(chalk.green('✅ Test 3 PASSED'));
      console.log(chalk.gray(`   Error: ${result.error}`));
      results.passed++;
      results.tests.push({ name: 'Test 3', status: 'PASSED' });
    } else {
      throw new Error(`Expected INTENT_POLICY_MISMATCH, got: ${result.code || 'no code'}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Test 3 FAILED'));
    console.log(chalk.red(`   ${error.message}`));
    results.failed++;
    results.tests.push({ name: 'Test 3', status: 'FAILED', error: error.message });
  }
  
  // Test 4: Backward compatibility - v0.2 token without intent should still work
  try {
    console.log(chalk.yellow('\n📝 Test 4: Backward Compatibility (v0.2) - should ALLOW'));
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:user:alice',
        agent: 'did:agent:test',
        scope: 'payments.send',
        policy,
        // No intent field (v0.2)
        audience: 'merchant.example',
        expiresIn: 3600
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create token: ${error.error || 'Unknown error'}`);
    }
    
    const { token } = await createResponse.json();
    
    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        audience: 'merchant.example',
        action: 'payments.send',
        resource: { type: 'merchant', id: 'airbnb' },
        amount: 300,
        currency: 'USD'
      })
    });
    
    const result = await response.json();
    
    if (result.valid !== undefined && result.policy_decision?.allowed) {
      console.log(chalk.green('✅ Test 4 PASSED'));
      console.log(chalk.gray(`   v0.2 token processed without intent validation`));
      results.passed++;
      results.tests.push({ name: 'Test 4', status: 'PASSED' });
    } else {
      throw new Error(`Expected ALLOW for v0.2 token, got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Test 4 FAILED'));
    console.log(chalk.red(`   ${error.message}`));
    results.failed++;
    results.tests.push({ name: 'Test 4', status: 'FAILED', error: error.message });
  }
  
  return results;
}

// Main execution
async function main() {
  try {
    // Check if verifier is running
    console.log(chalk.blue('🔍 Checking if verifier is running...\n'));
    const isRunning = await checkVerifier();
    
    if (!isRunning) {
      console.log(chalk.red('❌ Verifier API is not running!\n'));
      console.log(chalk.yellow('Please start the verifier first:'));
      console.log(chalk.white('  cd packages/verifier-api'));
      console.log(chalk.white('  pnpm dev\n'));
      console.log(chalk.yellow('Then run this test again:'));
      console.log(chalk.white('  cd packages/examples'));
      console.log(chalk.white('  pnpm test:intent\n'));
      process.exit(1);
    }
    
    console.log(chalk.green('✅ Verifier API is running\n'));
    
    const results = await runTests();
    
    // Print summary
    console.log(chalk.bold.blue('\n\n╔═══════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║                         TEST SUMMARY                               ║'));
    console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════════════╝\n'));
    
    for (const test of results.tests) {
      if (test.status === 'PASSED') {
        console.log(chalk.green(`✅ ${test.name}`));
      } else {
        console.log(chalk.red(`❌ ${test.name}`));
        console.log(chalk.red(`   ${test.error}`));
      }
    }
    
    console.log(chalk.bold(`\nTotal: ${results.passed + results.failed} tests`));
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}\n`));
    
    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Test execution failed:'), error);
    process.exit(1);
  }
}

main();

