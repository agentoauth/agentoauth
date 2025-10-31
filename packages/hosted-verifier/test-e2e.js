#!/usr/bin/env node

/**
 * End-to-End Test Suite for Cloudflare Workers Policy Verifier
 * 
 * Runs policy tests against local wrangler dev server
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

// Test configuration
const WORKER_URL = 'http://localhost:8787';
const MAX_WAIT_MS = 60000; // 60 seconds max wait (longer for wrangler)
const POLL_INTERVAL = 1000; // Check every 1s
const TEST_API_KEY = 'ak_test_demo_key'; // Will need real key for full tests

// Results tracking
let results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Wrangler process
let wranglerProcess = null;

/**
 * Wait for worker to be ready
 */
async function waitForWorker() {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const response = await fetch(`${WORKER_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.version) {
          return true;
        }
      }
    } catch (error) {
      // Worker not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
  
  return false;
}

/**
 * Start Wrangler dev server
 */
async function startWrangler() {
  console.log(chalk.blue('\n🔧 Starting Wrangler dev server...'));
  
  return new Promise((resolve, reject) => {
    wranglerProcess = spawn('wrangler', ['dev'], {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd()
    });
    
    // Wait for ready signal
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) {
        wranglerProcess.kill();
        reject(new Error('Wrangler failed to start within timeout'));
      }
    }, MAX_WAIT_MS);
    
    wranglerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready on http') || output.includes('Listening on')) {
        clearTimeout(timeout);
        ready = true;
        resolve();
      }
    });
    
    wranglerProcess.stderr.on('data', (data) => {
      console.error(chalk.yellow('Wrangler stderr:'), data.toString());
    });
  });
}

/**
 * Stop Wrangler
 */
async function stopWrangler() {
  if (wranglerProcess) {
    console.log(chalk.blue('\n🛑 Stopping Wrangler...'));
    wranglerProcess.kill();
    wranglerProcess = null;
    await new Promise(resolve => setTimeout(resolve, 2000));
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
 * Test helper: Skip result
 */
function recordSkip(testName, reason = '') {
  results.skipped++;
  results.tests.push({ name: testName, passed: 'SKIP', message: reason });
  console.log(chalk.yellow(`  ⏭️  SKIP: ${testName}`));
  if (reason) {
    console.log(chalk.yellow(`     ${reason}`));
  }
}

/**
 * Test 1: Health Check
 */
async function test1_HealthCheck() {
  console.log(chalk.bold('\n📝 Test 1: Health Check'));
  
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    
    if (!response.ok) {
      recordResult('Test 1', false, `HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    if (data.status !== 'ok') {
      recordResult('Test 1', false, 'Status not ok');
      return false;
    }
    
    if (!data.version || !data.version.includes('0.7')) {
      recordResult('Test 1', false, `Version mismatch: ${data.version}`);
      return false;
    }
    
    if (!data.features || !data.features.includes('act.v0.2')) {
      recordResult('Test 1', false, 'act.v0.2 feature not listed');
      return false;
    }
    
    recordResult('Test 1', true);
    return true;
    
  } catch (error) {
    recordResult('Test 1', false, error.message);
    return false;
  }
}

/**
 * Test 2: Policy Linting
 */
async function test2_PolicyLint() {
  console.log(chalk.bold('\n📝 Test 2: Policy Linting'));
  
  try {
    const policy = {
      version: 'pol.v0.2',
      id: 'pol_test_001',
      actions: ['payments.send'],
      resources: [{ type: 'merchant', match: { ids: ['airbnb'] } }],
      limits: {
        per_txn: { amount: 500, currency: 'USD' },
        per_period: { amount: 1500, currency: 'USD', period: 'week' }
      }
    };
    
    const response = await fetch(`${WORKER_URL}/lint/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy)
    });
    
    if (!response.ok) {
      recordResult('Test 2', false, `HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    if (!data.valid) {
      recordResult('Test 2', false, 'Policy should be valid');
      return false;
    }
    
    if (!data.policy_hash || !data.policy_hash.startsWith('sha256:')) {
      recordResult('Test 2', false, 'Invalid policy hash format');
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
 * Test 3: Policy Linting - Invalid
 */
async function test3_PolicyLintInvalid() {
  console.log(chalk.bold('\n📝 Test 3: Policy Linting (Invalid)'));
  
  try {
    const invalidPolicy = { version: 'pol.v0.2' }; // Missing required fields
    
    const response = await fetch(`${WORKER_URL}/lint/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPolicy)
    });
    
    const data = await response.json();
    
    if (data.valid !== false) {
      recordResult('Test 3', false, 'Should have been invalid');
      return false;
    }
    
    if (!data.errors || data.errors.length === 0) {
      recordResult('Test 3', false, 'Should have errors array');
      return false;
    }
    
    recordResult('Test 3', true);
    return true;
    
  } catch (error) {
    recordResult('Test 3', false, error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║  Cloudflare Workers Policy Verifier E2E Tests             ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════╝\n'));
  
  try {
    // Start Wrangler
    await startWrangler();
    console.log(chalk.green('✓ Wrangler started\n'));
    
    // Wait for ready
    console.log(chalk.blue('Waiting for worker to be ready...'));
    if (!await waitForWorker()) {
      console.error(chalk.red('Worker failed to become ready'));
      await stopWrangler();
      process.exit(1);
    }
    console.log(chalk.green('✓ Worker ready\n'));
    
    // Run tests
    await test1_HealthCheck();
    await test2_PolicyLint();
    await test3_PolicyLintInvalid();
    
    // Note: Full verification tests require API key and token creation
    // These would need SDK integration or token generation setup
    recordSkip('Test 4-N', 'Full verification tests require API key and test tokens');
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test suite error:'), error.message);
    process.exit(1);
  } finally {
    await stopWrangler();
  }
  
  // Print summary
  console.log(chalk.bold('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold('║                        TEST SUMMARY                        ║'));
  console.log(chalk.bold('╚═══════════════════════════════════════════════════════════╝\n'));
  
  results.tests.forEach(test => {
    if (test.passed === 'SKIP') {
      console.log(chalk.yellow(`⏭️  ${test.name} - SKIPPED`));
    } else if (test.passed) {
      console.log(chalk.green(`✅ ${test.name}`));
    } else {
      console.log(chalk.red(`❌ ${test.name}`));
      console.log(chalk.red(`   ${test.message || 'No details'}`));
    }
  });
  
  console.log(chalk.bold(`\nTotal: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped\n`));
  
  // Exit with error code if any failed
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('\nFatal error:'), error);
  process.exit(1);
});

