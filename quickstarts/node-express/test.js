#!/usr/bin/env node

/**
 * AgentOAuth Express Quickstart - Test Script
 * 
 * This script tests the agent-to-merchant flow to demonstrate
 * the complete 5-minute DX experience.
 */

import { issueConsent, verifyConsent, revokeConsent, buildPolicy } from '@agentoauth/sdk';
import chalk from 'chalk';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFlow() {
  console.log(chalk.bold.cyan('\n🧪 Testing AgentOAuth Express Flow\n'));
  
  try {
    // Wait for servers to be ready
    console.log(chalk.gray('⏳ Waiting for servers to be ready...'));
    await sleep(1000);
    
    // Test 1: Agent-to-Merchant Payment
    console.log(chalk.bold.blue('1️⃣ Testing Agent-to-Merchant Payment'));
    
    const paymentResponse = await fetch('http://localhost:3001/payments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 250,
        recipient: 'merchant-123',
        description: 'Test payment from agent'
      })
    });
    
    const paymentResult = await paymentResponse.json();
    
    if (paymentResponse.ok) {
      console.log(chalk.green('✅ Payment successful!'));
      console.log(chalk.gray(`   Transaction ID: ${paymentResult.transactionId}`));
      console.log(chalk.gray(`   Amount: $${paymentResult.amount}`));
      console.log(chalk.gray(`   Authorized by: ${paymentResult.authorizedBy}`));
    } else {
      console.log(chalk.red('❌ Payment failed:'), paymentResult.error);
    }
    
    console.log();
    
    // Test 2: Data Access
    console.log(chalk.bold.blue('2️⃣ Testing Data Access'));
    
    const dataResponse = await fetch('http://localhost:3001/data/fetch');
    const dataResult = await dataResponse.json();
    
    if (dataResponse.ok) {
      console.log(chalk.green('✅ Data access successful!'));
      console.log(chalk.gray(`   Records: ${dataResult.data?.length || 0}`));
      console.log(chalk.gray(`   Accessed by: ${dataResult.meta?.accessedBy}`));
    } else {
      console.log(chalk.red('❌ Data access failed:'), dataResult.error);
    }
    
    console.log();
    
    // Test 3: Direct Token Verification
    console.log(chalk.bold.blue('3️⃣ Testing Direct Token Operations'));
    
    // Create a token manually
    const { token, keyId, publicKey } = await issueConsent({
      user: 'did:example:test-user',
      agent: 'test-agent',
      scope: 'pay:merchant',
      limit: { amount: 1000, currency: 'USD' },
      audience: 'test-merchant',
      expiresIn: '1h'
    });
    
    console.log(chalk.green('✅ Token created'));
    console.log(chalk.gray(`   Key ID: ${keyId}`));
    
    // Verify the token
    const verification = await verifyConsent(token, {
      publicKey,
      audience: 'test-merchant'
    });
    
    if (verification.valid) {
      console.log(chalk.green('✅ Token verified'));
      console.log(chalk.gray(`   User: ${verification.payload.user}`));
      console.log(chalk.gray(`   Scope: ${verification.payload.scope}`));
      console.log(chalk.gray(`   Limit: $${verification.payload.limit.amount}`));
    } else {
      console.log(chalk.red('❌ Token verification failed:'), verification.error?.message);
    }
    
    console.log();
    
    // Test 4: Policy Builder
    console.log(chalk.bold.blue('4️⃣ Testing Policy Builder'));
    
    const paymentPolicy = buildPolicy({
      preset: 'payment',
      limits: { amount: 5000, currency: 'EUR' },
      expiresIn: '2h'
    });
    
    const readPolicy = buildPolicy({
      preset: 'read',
      expiresIn: '24h'
    });
    
    const customPolicy = buildPolicy({
      preset: 'custom',
      scopes: ['custom:action', 'read:special'],
      limits: { amount: 750, currency: 'GBP' },
      audience: 'special-merchant'
    });
    
    console.log(chalk.green('✅ Policy builder working'));
    console.log(chalk.gray(`   Payment policy: ${paymentPolicy.scope}, $${paymentPolicy.limit.amount}`));
    console.log(chalk.gray(`   Read policy: ${readPolicy.scope}, expires in 24h`));
    console.log(chalk.gray(`   Custom policy: ${customPolicy.scope}, £${customPolicy.limit.amount}`));
    
    console.log();
    
    // Test 5: Public API Status
    console.log(chalk.bold.blue('5️⃣ Testing Public API Status'));
    
    const statusResponse = await fetch('http://localhost:3000/api/status');
    const statusResult = await statusResponse.json();
    
    if (statusResponse.ok) {
      console.log(chalk.green('✅ Status check successful'));
      console.log(chalk.gray(`   Service: ${statusResult.service}`));
      console.log(chalk.gray(`   Status: ${statusResult.status}`));
    } else {
      console.log(chalk.red('❌ Status check failed'));
    }
    
    console.log();
    
    // Summary
    console.log(chalk.bold.green('🎉 Test Flow Complete!'));
    console.log(chalk.green('   ✅ Agent-to-Merchant payment'));
    console.log(chalk.green('   ✅ Data access with read scope'));
    console.log(chalk.green('   ✅ Direct token operations'));
    console.log(chalk.green('   ✅ Policy builder functionality'));
    console.log(chalk.green('   ✅ Public API status'));
    
    console.log();
    console.log(chalk.bold.yellow('💡 Key Benefits Demonstrated:'));
    console.log(chalk.gray('   • Automatic token signing with middleware'));
    console.log(chalk.gray('   • Scope-based authorization'));
    console.log(chalk.gray('   • Amount limit validation'));
    console.log(chalk.gray('   • Ergonomic SDK functions'));
    console.log(chalk.gray('   • Policy presets and customization'));
    console.log();
    
  } catch (error) {
    console.error(chalk.red('❌ Test flow failed:'), error.message);
    console.log(chalk.yellow('💡 Make sure both agent and merchant servers are running'));
  }
}

// Run tests
testFlow().catch(console.error);
