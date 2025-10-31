#!/usr/bin/env node

/**
 * End-to-End Test Suite for Phase 2A Policy Support
 * 
 * Automatically runs all policy tests from TESTING_INSTRUCTIONS.md
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { buildPolicyV2, issueConsent, decode, hashPolicy } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import crypto from 'crypto';

// Test configuration
const VERIFIER_URL = 'http://localhost:3000';
const MAX_WAIT_MS = 30000; // 30 seconds max wait for verifier
const POLL_INTERVAL = 500; // Check every 500ms

// Results tracking
let results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Verifier API process
let verifierProcess = null;

/**
 * Wait for verifier API to be ready
 */
async function waitForVerifier() {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const response = await fetch(`${VERIFIER_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          return true;
        }
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
  
  return false;
}

/**
 * Start Verifier API as a background process
 */
async function startVerifier() {
  console.log(chalk.blue('\n🔧 Starting Verifier API...'));
  
  return new Promise((resolve, reject) => {
    verifierProcess = spawn('node', ['../verifier-api/dist/index.js'], {
      stdio: 'pipe',
      shell: true
    });
    
    // Wait for ready signal
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) {
        verifierProcess.kill();
        reject(new Error('Verifier API failed to start within timeout'));
      }
    }, MAX_WAIT_MS);
    
    verifierProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Server listening')) {
        clearTimeout(timeout);
        ready = true;
        resolve();
      }
    });
    
    verifierProcess.stderr.on('data', (data) => {
      console.error(chalk.red('Verifier stderr:'), data.toString());
    });
  });
}

/**
 * Stop Verifier API
 */
async function stopVerifier() {
  if (verifierProcess) {
    console.log(chalk.blue('\n🛑 Stopping Verifier API...'));
    verifierProcess.kill();
    verifierProcess = null;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Test helper: Record result
 */
function recordResult(testName, passed, message = '') {
  const result = { name: testName, passed, message };
  results.tests.push(result);
  
  if (passed) {
    results.passed++;
    console.log(chalk.green(`  ✅ PASS: ${testName}`));
  } else {
    results.failed++;
    console.log(chalk.red(`  ❌ FAIL: ${testName}`));
    if (message) {
      console.log(chalk.red(`     ${message}`));
    }
  }
}

/**
 * Test 1: Issue Token with Policy using SDK
 */
async function test1_IssueTokenWithPolicy() {
  console.log(chalk.bold('\n📝 Test 1: Issue Token with Policy using SDK'));
  
  try {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const privateJWK = await exportJWK(privateKey);
    const publicJWK = await exportJWK(publicKey);
    publicJWK.kid = 'test-key';
    
    const policy = buildPolicyV2()
      .id('pol_test_001')
      .actions(['payments.send'])
      .merchants(['airbnb'])
      .limitPerTxn(500, 'USD')
      .limitPerPeriod(1500, 'USD', 'week')
      .finalize();
    
    const { token, keyId } = await issueConsent({
      user: 'did:example:alice',
      agent: 'test-agent',
      scope: 'payments.send',
      limit: { amount: 1000, currency: 'USD' },
      policy: policy,
      privateKey: privateJWK,
      keyId: publicJWK.kid,
      expiresIn: '1h'
    });
    
    // Verify token was created
    if (!token || token.length < 100) {
      recordResult('Test 1', false, 'Token not created properly');
      return null;
    }
    
    // Verify policy hash
    const policyHash = hashPolicy(policy);
    const decoded = decode(token);
    
    if (decoded.payload.policy_hash !== policyHash) {
      recordResult('Test 1', false, 'Policy hash mismatch');
      return null;
    }
    
    recordResult('Test 1', true);
    return { token, policy };
    
  } catch (error) {
    recordResult('Test 1', false, error.message);
    return null;
  }
}

/**
 * Test 2: Decode Token and Verify Policy
 */
async function test2_DecodeToken(testData) {
  console.log(chalk.bold('\n📝 Test 2: Decode Token and Verify Policy'));
  
  if (!testData) {
    recordResult('Test 2', false, 'Skipped - Test 1 failed');
    return false;
  }
  
  try {
    const { token } = testData;
    const decoded = decode(token);
    
    if (!decoded.payload) {
      recordResult('Test 2', false, 'Payload not found');
      return false;
    }
    
    if (!decoded.payload.policy) {
      recordResult('Test 2', false, 'Policy not in payload');
      return false;
    }
    
    if (decoded.payload.policy.actions[0] !== 'payments.send') {
      recordResult('Test 2', false, 'Wrong actions in policy');
      return false;
    }
    
    recordResult('Test 2', true);
    return true;
    
  } catch (error) {
    recordResult('Test 2', false, error.message);
    return false;
  }
}

/**
 * Test 3: Full Policy Evaluation - ALLOW
 */
async function test3_PolicyAllow() {
  console.log(chalk.bold('\n📝 Test 3: Full Policy Evaluation - ALLOW'));
  
  try {
    // Create token via API
    const policy = {
      version: 'pol.v0.2',
      id: 'pol_test_003',
      actions: ['payments.send'],
      resources: [{ type: 'merchant', match: { ids: ['airbnb'] } }],
      limits: {
        per_txn: { amount: 500, currency: 'USD' },
        per_period: { amount: 1500, currency: 'USD', period: 'week' }
      }
    };
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:example:alice',
        agent: 'test-agent',
        scope: 'payments.send',
        policy: policy
      })
    });
    
    if (!createResponse.ok) {
      recordResult('Test 3', false, 'Failed to create token');
      return null;
    }
    
    const { token } = await createResponse.json();
    
    // Test ALLOW
    const verifyResponse = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'payments.send',
        resource: { type: 'merchant', id: 'airbnb' },
        amount: 250,
        currency: 'USD'
      })
    });
    
    const result = await verifyResponse.json();
    
    if (!result.valid || !result.policy_decision?.allowed) {
      recordResult('Test 3', false, 'Should have ALLOWED but didn\'t');
      return null;
    }
    
    if (!result.policy_decision.receipt_id) {
      recordResult('Test 3', false, 'No receipt_id returned');
      return null;
    }
    
    recordResult('Test 3', true);
    return { token, receipt_id: result.policy_decision.receipt_id, policy_id: 'pol_test_003' };
    
  } catch (error) {
    recordResult('Test 3', false, error.message);
    return null;
  }
}

/**
 * Test 4: Policy Evaluation - DENY
 */
async function test4_PolicyDeny(testData) {
  console.log(chalk.bold('\n📝 Test 4: Policy Evaluation - DENY'));
  
  if (!testData) {
    recordResult('Test 4', false, 'Skipped - Test 3 failed');
    return false;
  }
  
  try {
    // Create fresh token for DENY test
    const policy = {
      version: 'pol.v0.2',
      id: 'pol_test_004',
      actions: ['payments.send'],
      limits: {
        per_txn: { amount: 500, currency: 'USD' }
      }
    };
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:example:alice',
        agent: 'test-agent',
        scope: 'payments.send',
        policy: policy
      })
    });
    
    const { token } = await createResponse.json();
    
    // Test DENY (amount exceeded)
    const verifyResponse = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'payments.send',
        amount: 600,
        currency: 'USD'
      })
    });
    
    const result = await verifyResponse.json();
    
    if (result.valid || result.policy_decision?.allowed !== false) {
      recordResult('Test 4', false, 'Should have DENIED but didn\'t');
      return false;
    }
    
    if (!result.policy_decision?.reason) {
      recordResult('Test 4', false, 'No reason provided for denial');
      return false;
    }
    
    recordResult('Test 4', true);
    return true;
    
  } catch (error) {
    recordResult('Test 4', false, error.message);
    return false;
  }
}

/**
 * Test 5: Budget Tracking
 */
async function test5_BudgetTracking(testData) {
  console.log(chalk.bold('\n📝 Test 5: Budget Tracking'));
  
  if (!testData) {
    recordResult('Test 5', false, 'Skipped - Test 3 failed');
    return false;
  }
  
  try {
    // Create fresh token for budget test
    const policy = {
      version: 'pol.v0.2',
      id: 'pol_test_005',
      actions: ['payments.send'],
      limits: {
        per_period: { amount: 1500, currency: 'USD', period: 'week' }
      }
    };
    
    const createResponse = await fetch(`${VERIFIER_URL}/demo/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'did:example:alice',
        agent: 'test-agent',
        scope: 'payments.send',
        policy: policy
      })
    });
    
    const { token } = await createResponse.json();
    
    // Make 3 requests that should ALLOW
    for (let i = 0; i < 3; i++) {
      const verifyResponse = await fetch(`${VERIFIER_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'payments.send',
          amount: 400,
          currency: 'USD'
        })
      });
      
      const result = await verifyResponse.json();
      
      if (!result.valid) {
        recordResult('Test 5', false, `Request ${i + 1} should have ALLOWED`);
        return false;
      }
    }
    
    // 4th request should DENY (budget exceeded)
    const verifyResponse = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'payments.send',
        amount: 400,
        currency: 'USD'
      })
    });
    
    const result = await verifyResponse.json();
    
    if (result.valid) {
      recordResult('Test 5', false, '4th request should have DENIED (budget exceeded)');
      return false;
    }
    
    recordResult('Test 5', true);
    return true;
    
  } catch (error) {
    recordResult('Test 5', false, error.message);
    return false;
  }
}

/**
 * Test 6: Receipt Retrieval
 */
async function test6_ReceiptRetrieval(testData) {
  console.log(chalk.bold('\n📝 Test 6: Receipt Retrieval'));
  
  if (!testData || !testData.receipt_id) {
    recordResult('Test 6', false, 'Skipped - Test 3 failed');
    return false;
  }
  
  try {
    const receiptResponse = await fetch(`${VERIFIER_URL}/receipts/${testData.receipt_id}`);
    
    if (!receiptResponse.ok) {
      recordResult('Test 6', false, 'Failed to retrieve receipt');
      return false;
    }
    
    const { receipt } = await receiptResponse.json();
    
    if (!receipt || receipt.length < 100) {
      recordResult('Test 6', false, 'Receipt not valid');
      return false;
    }
    
    recordResult('Test 6', true);
    return true;
    
  } catch (error) {
    recordResult('Test 6', false, error.message);
    return false;
  }
}

/**
 * Test 7: Policy Revocation
 */
async function test7_PolicyRevocation(testData) {
  console.log(chalk.bold('\n📝 Test 7: Policy Revocation'));
  
  if (!testData) {
    recordResult('Test 7', false, 'Skipped - Test 3 failed');
    return false;
  }
  
  try {
    // Revoke the policy
    const revokeResponse = await fetch(`${VERIFIER_URL}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_id: 'pol_test_003' })
    });
    
    const revokeResult = await revokeResponse.json();
    
    if (!revokeResult.success) {
      recordResult('Test 7', false, 'Failed to revoke policy');
      return false;
    }
    
    // Try to use the token again (should fail)
    const verifyResponse = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testData.token,
        action: 'payments.send',
        amount: 100,
        currency: 'USD'
      })
    });
    
    const verifyResult = await verifyResponse.json();
    
    if (verifyResult.valid) {
      recordResult('Test 7', false, 'Token should be rejected after policy revocation');
      return false;
    }
    
    if (verifyResult.code !== 'POLICY_REVOKED') {
      recordResult('Test 7', false, 'Wrong error code after revocation');
      return false;
    }
    
    recordResult('Test 7', true);
    return true;
    
  } catch (error) {
    recordResult('Test 7', false, error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║         AgentOAuth v0.7 Phase 2A - Automated Test Suite           ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝\n'));
  
  let testData1 = null;
  let testData3 = null;
  
  try {
    // Tests 1 & 2 don't need verifier
    testData1 = await test1_IssueTokenWithPolicy();
    await test2_DecodeToken(testData1);
    
    // Start verifier for remaining tests
    await startVerifier();
    console.log(chalk.green('✅ Verifier API ready\n'));
    
    // Tests 3-7 need verifier
    testData3 = await test3_PolicyAllow();
    await test4_PolicyDeny(testData3);
    await test5_BudgetTracking(testData3);
    await test6_ReceiptRetrieval(testData3);
    await test7_PolicyRevocation(testData3);
    
  } catch (error) {
    console.error(chalk.red('❌ Test suite error:'), error.message);
  } finally {
    await stopVerifier();
  }
  
  // Print summary
  console.log(chalk.bold('\n╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold('║                         TEST SUMMARY                               ║'));
  console.log(chalk.bold('╚═══════════════════════════════════════════════════════════════════╝\n'));
  
  results.tests.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    const color = test.passed ? chalk.green : chalk.red;
    console.log(color(`${icon} ${test.name}`));
    if (!test.passed && test.message) {
      console.log(chalk.gray(`   ${test.message}`));
    }
  });
  
  console.log(chalk.bold(`\nTotal: ${results.passed + results.failed} tests`));
  console.log(chalk.green(`Passed: ${results.passed}`));
  console.log(chalk.red(`Failed: ${results.failed}`));
  
  if (results.failed === 0) {
    console.log(chalk.green.bold('\n🎉 All tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n❌ Some tests failed'));
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  await stopVerifier();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await stopVerifier();
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

