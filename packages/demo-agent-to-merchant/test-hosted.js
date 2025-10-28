#!/usr/bin/env node

/**
 * AgentOAuth Demo - Test Hosted Verifier
 * 
 * This script tests the merchant with hosted verifier mode
 */

import chalk from 'chalk';

async function testHostedVerifier() {
  console.log(chalk.bold.blue('\n🧪 Testing AgentOAuth Hosted Verifier Integration\n'));
  
  // Check environment
  const useHosted = process.env.USE_HOSTED_VERIFIER === 'true';
  const apiKey = process.env.AGENTOAUTH_API_KEY;
  
  if (!useHosted) {
    console.log(chalk.yellow('⚠️  USE_HOSTED_VERIFIER not set to "true"'));
    console.log(chalk.gray('   Set: export USE_HOSTED_VERIFIER=true'));
  }
  
  if (!apiKey) {
    console.log(chalk.yellow('⚠️  AGENTOAUTH_API_KEY not set'));
    console.log(chalk.gray('   Set: export AGENTOAUTH_API_KEY="ak_your_key_here"'));
  }
  
  if (!useHosted || !apiKey) {
    console.log(chalk.red('\n❌ Environment not configured for hosted verifier'));
    console.log(chalk.blue('\n📋 Setup Instructions:'));
    console.log(chalk.gray('1. export USE_HOSTED_VERIFIER=true'));
    console.log(chalk.gray('2. export AGENTOAUTH_API_KEY="ak_your_generated_key"'));
    console.log(chalk.gray('3. pnpm demo:merchant (in another terminal)'));
    console.log(chalk.gray('4. node test-hosted.js'));
    return;
  }
  
  console.log(chalk.green('✅ Environment configured for hosted verifier'));
  console.log(chalk.gray(`   API Key: ${apiKey.substring(0, 30)}...`));
  
  // Test merchant health
  try {
    console.log(chalk.blue('\n🔍 Testing merchant server...'));
    const healthResponse = await fetch('http://localhost:4000/health');
    const health = await healthResponse.json();
    
    console.log(chalk.green('✅ Merchant server is running'));
    console.log(chalk.gray(`   Verifier Mode: ${health.verifierMode}`));
    console.log(chalk.gray(`   API Key Set: ${health.apiKeySet}`));
    
  } catch (error) {
    console.log(chalk.red('❌ Merchant server not running'));
    console.log(chalk.gray('   Start with: pnpm demo:merchant'));
    return;
  }
  
  // Test hosted verifier directly
  try {
    console.log(chalk.blue('\n🌐 Testing hosted verifier directly...'));
    const verifierResponse = await fetch('https://verifier.agentoauth.org/health');
    const verifierHealth = await verifierResponse.json();
    
    console.log(chalk.green('✅ Hosted verifier is online'));
    console.log(chalk.gray(`   Service: ${verifierHealth.service}`));
    console.log(chalk.gray(`   Version: ${verifierHealth.version}`));
    
  } catch (error) {
    console.log(chalk.red('❌ Hosted verifier unreachable'));
    console.log(chalk.gray(`   Error: ${error.message}`));
  }
  
  // Test API key with usage endpoint
  try {
    console.log(chalk.blue('\n🔑 Testing API key with usage endpoint...'));
    const usageResponse = await fetch('https://verifier.agentoauth.org/usage', {
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    if (usageResponse.ok) {
      const usage = await usageResponse.json();
      console.log(chalk.green('✅ API key is valid'));
      console.log(chalk.gray(`   Organization: ${usage.organization.name}`));
      console.log(chalk.gray(`   Daily Usage: ${usage.usage.daily.used}/${usage.usage.daily.limit}`));
      console.log(chalk.gray(`   Monthly Usage: ${usage.usage.monthly.used}/${usage.usage.monthly.limit}`));
    } else {
      const error = await usageResponse.json();
      console.log(chalk.red('❌ API key validation failed'));
      console.log(chalk.gray(`   Error: ${error.error}`));
    }
    
  } catch (error) {
    console.log(chalk.red('❌ API key test failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
  }
  
  console.log(chalk.bold.green('\n🎯 Next Steps:'));
  console.log(chalk.gray('1. Open browser to: http://localhost:4000'));
  console.log(chalk.gray('2. Run: node agent.js (to generate payments)'));
  console.log(chalk.gray('3. Watch the dashboard update with hosted verification'));
  console.log(chalk.yellow('\n⏳ The dashboard auto-refreshes every 5 seconds'));
}

testHostedVerifier().catch(console.error);
