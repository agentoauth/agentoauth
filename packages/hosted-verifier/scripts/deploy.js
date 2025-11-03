#!/usr/bin/env node

/**
 * Automated Cloudflare Workers Deployment Script
 * 
 * Handles KV creation, secret setup, and deployment automatically
 */

import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Execute a command and return output
 */
function exec(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Set a Cloudflare secret non-interactively
 */
async function setSecret(name, value, env = 'production') {
  console.log(chalk.gray(`  Setting ${name}...`));
  
  const proc = spawn('wrangler', ['secret', 'put', name, '--env', env], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Write secret value to stdin
  proc.stdin.write(value);
  proc.stdin.end();
  
  return new Promise((resolve, reject) => {
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to set secret ${name}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Extract namespace ID from wrangler output
 */
function extractId(output) {
  const match = output.stdout.match(/id = "([^"]+)"/);
  if (!match) {
    throw new Error('Failed to extract namespace ID from output');
  }
  return match[1];
}

/**
 * Update wrangler.toml with KV namespace IDs
 */
async function updateWranglerConfig(prodId, previewId) {
  const configPath = join(projectRoot, 'wrangler.toml');
  let config = await readFile(configPath, 'utf-8');
  
  // Update production namespace IDs
  config = config.replace(
    /id = "5bd6c83129b74f0081cd20ac55c6f6e5"/,
    `id = "${prodId}"`
  );
  config = config.replace(
    /preview_id = "9e574bf949bd435da4b95cf8dd3471ca"/,
    `preview_id = "${previewId}"`
  );
  
  // Update development namespace ID
  config = config.replace(
    /id = "9e574bf949bd435da4b95cf8dd3471ca"  # Preview KV namespace ID/,
    `id = "${previewId}"  # Preview KV namespace ID`
  );
  
  await writeFile(configPath, config, 'utf-8');
}

/**
 * Load secrets from .env.local
 */
async function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  
  if (!existsSync(envPath)) {
    throw new Error(
      `.env.local not found. Please create it from .env.local.example:\n` +
      `  cp .env.local.example .env.local\n` +
      `  # Edit .env.local with your values`
    );
  }
  
  const envContent = await readFile(envPath, 'utf-8');
  const secrets = {};
  
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      secrets[key.trim()] = valueParts.join('=').trim();
    }
  }
  
  // Validate required secrets
  const required = ['API_KEY_PUBLIC_KEY', 'AUDIT_SALT', 'SIGNING_PRIVATE_KEY', 'SIGNING_KID'];
  for (const key of required) {
    if (!secrets[key]) {
      throw new Error(`Missing required secret: ${key} in .env.local`);
    }
  }
  
  return secrets;
}

/**
 * Main deployment function
 */
async function deploy() {
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║    AgentOAuth Verifier - Automated Deployment            ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════╝\n'));
  
  try {
    // Step 0: Install dependencies (ensure wrangler v4)
    console.log(chalk.bold('0️⃣  Installing dependencies...'));
    try {
      await exec('pnpm', ['install']);
      console.log(chalk.green('   ✅ Dependencies installed\n'));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Install manually: pnpm install\n'));
    }
    
    // Step 1: Check authentication
    console.log(chalk.bold('1️⃣  Checking wrangler authentication...'));
    try {
      const whoami = await exec('wrangler', ['whoami']);
      console.log(chalk.green('   ✅ Authenticated\n'));
    } catch (error) {
      console.error(chalk.red('   ❌ Not authenticated'));
      console.log(chalk.yellow('\n   Please run: wrangler login\n'));
      process.exit(1);
    }
    
    // Step 2: Load environment variables
    console.log(chalk.bold('2️⃣  Loading secrets from .env.local...'));
    const secrets = await loadEnv();
    console.log(chalk.green('   ✅ Secrets loaded\n'));
    
    // Step 3: Create KV namespaces
    console.log(chalk.bold('3️⃣  Creating KV namespaces...'));
    
    let kvProdId, kvPreviewId;
    try {
      const kvProd = await exec('wrangler', ['kv', 'namespace', 'create', 'RATE_LIMIT_KV']);
      kvProdId = extractId(kvProd);
      console.log(chalk.gray(`   Production: ${kvProdId}`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Production namespace may already exist, skipping...'));
      kvProdId = null;
    }
    
    try {
      const kvPreview = await exec('wrangler', ['kv', 'namespace', 'create', 'RATE_LIMIT_KV_PREVIEW']);
      kvPreviewId = extractId(kvPreview);
      console.log(chalk.gray(`   Preview: ${kvPreviewId}`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Preview namespace may already exist, skipping...'));
      kvPreviewId = null;
    }
    
    console.log(chalk.green('   ✅ KV namespaces ready\n'));
    
    // Step 4: Update wrangler.toml if IDs were created
    if (kvProdId && kvPreviewId) {
      console.log(chalk.bold('4️⃣  Updating wrangler.toml...'));
      await updateWranglerConfig(kvProdId, kvPreviewId);
      console.log(chalk.green('   ✅ Configuration updated\n'));
    } else {
      console.log(chalk.yellow('4️⃣  Skipping wrangler.toml update (using existing IDs)\n'));
    }
    
    // Step 5: Create R2 bucket (optional)
    console.log(chalk.bold('5️⃣  Creating R2 bucket (optional)...'));
    try {
      await exec('wrangler', ['r2', 'bucket', 'create', 'agentoauth-audit-logs']);
      console.log(chalk.green('   ✅ R2 bucket created\n'));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  R2 bucket may already exist or R2 not enabled, skipping...\n'));
    }
    
    // Step 6: Set secrets
    console.log(chalk.bold('6️⃣  Setting Cloudflare secrets...'));
    
    console.log(chalk.gray(`   Setting API_KEY_PUBLIC_KEY...`));
    console.log(chalk.gray(`     Value: ${secrets.API_KEY_PUBLIC_KEY.substring(0, 50)}...`));
    await setSecret('API_KEY_PUBLIC_KEY', secrets.API_KEY_PUBLIC_KEY);
    
    console.log(chalk.gray(`   Setting AUDIT_SALT...`));
    console.log(chalk.gray(`     Value: ${secrets.AUDIT_SALT}`));
    await setSecret('AUDIT_SALT', secrets.AUDIT_SALT);
    
    console.log(chalk.gray(`   Setting SIGNING_PRIVATE_KEY...`));
    console.log(chalk.gray(`     Value: ${secrets.SIGNING_PRIVATE_KEY.substring(0, 50)}... (private - truncated)`));
    await setSecret('SIGNING_PRIVATE_KEY', secrets.SIGNING_PRIVATE_KEY);
    
    console.log(chalk.gray(`   Setting SIGNING_KID...`));
    console.log(chalk.gray(`     Value: ${secrets.SIGNING_KID}`));
    await setSecret('SIGNING_KID', secrets.SIGNING_KID);
    
    console.log(chalk.green('   ✅ All secrets configured\n'));
    
    // Step 7: Deploy to production
    console.log(chalk.bold('7️⃣  Deploying to Cloudflare Workers...'));
    const deployResult = await exec('wrangler', ['deploy', '--env', 'production']);
    console.log(chalk.gray(deployResult.stdout));
    console.log(chalk.green('   ✅ Deployed successfully\n'));
    
    // Step 8: Verify deployment
    console.log(chalk.bold('8️⃣  Verifying deployment...'));
    
    // Wait a moment for deployment to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      // Try to get the worker URL from deployment output
      const urlMatch = deployResult.stdout.match(/https:\/\/[^\s]+/);
      const workerUrl = urlMatch ? urlMatch[0] : 'https://agentoauth-verifier-prod.workers.dev';
      
      console.log(chalk.gray(`   Testing: ${workerUrl}/health`));
      const health = await fetch(`${workerUrl}/health`);
      const data = await health.json();
      
      console.log(chalk.green('   ✅ Health check passed:'));
      console.log(chalk.gray(`      Version: ${data.version}`));
      console.log(chalk.gray(`      Features: ${data.features.join(', ')}`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Could not verify deployment (may take a few minutes to propagate)'));
    }
    
    console.log(chalk.bold.green('\n🎉 Deployment complete!\n'));
    
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray('  • Test your deployment with TESTING.md scenarios'));
    console.log(chalk.gray('  • Monitor logs: wrangler tail --env production'));
    console.log(chalk.gray('  • Check analytics in Cloudflare Dashboard'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'), error.message);
    process.exit(1);
  }
}

// Run deployment
deploy();

