#!/usr/bin/env node

/**
 * AgentOAuth Demo - Merchant Server
 * 
 * This script simulates a merchant that accepts payments with AgentOAuth authorization.
 * It verifies tokens and checks authorization before processing payments.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { decode } from '@agentoauth/sdk';
import chalk from 'chalk';
import crypto from 'crypto';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// In-memory transaction storage
const transactions = [];

// Mock JWKS for demo (in production, this would be a real endpoint)
// For demo, we'll accept the token and decode it to verify locally
const verifyTokenLocal = async (token) => {
  try {
    // Decode token (doesn't verify signature in this simple demo)
    const { header, payload } = decode(token);
    
    // In a real scenario, you would use verify() with actual JWKS:
    // const result = await verify(token, 'https://issuer/.well-known/jwks.json');
    
    // For demo purposes, we simulate successful verification
    // and check the authorization claims
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        valid: false,
        error: 'Token expired',
        code: 'EXPIRED'
      };
    }

    // Check version
    if (payload.ver !== '0.2' && payload.ver !== '0.1') {
      return {
        valid: false,
        error: `Unsupported version: ${payload.ver}`,
        code: 'INVALID_VERSION'
      };
    }
    
    // Warn about v0.1 tokens (missing jti)
    if (payload.ver === '0.1') {
      console.warn('⚠️  v0.1 token detected (no jti) - upgrade recommended');
    }

    return {
      valid: true,
      payload
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      code: 'INVALID_SIGNATURE'
    };
  }
};

// Payment endpoint
app.post('/api/payment', async (c) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(chalk.blue(`\n📥 [${requestId}] Payment request received`));
  
  try {
    const body = await c.req.json();
    const { authToken, amount, currency, description } = body;

    // Validate request
    if (!authToken) {
      console.log(chalk.red(`❌ [${requestId}] Missing authToken`));
      return c.json({
        success: false,
        error: 'Missing authToken field',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      console.log(chalk.red(`❌ [${requestId}] Invalid amount`));
      return c.json({
        success: false,
        error: 'Invalid amount: must be a positive number',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    if (!currency || typeof currency !== 'string') {
      console.log(chalk.red(`❌ [${requestId}] Invalid currency`));
      return c.json({
        success: false,
        error: 'Invalid currency: must be a string',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    console.log(chalk.gray(`   Amount: $${amount.toFixed(2)} ${currency}`));
    console.log(chalk.gray(`   Description: ${description || '(none)'}`));

    // Verify token
    console.log(chalk.blue(`🔐 [${requestId}] Verifying authorization token...`));
    
    const tokenHash = crypto.createHash('sha256')
      .update(authToken)
      .digest('hex')
      .substring(0, 16);
    
    console.log(chalk.gray(`   Token hash: ${tokenHash}`));

    const verifyResult = await verifyTokenLocal(authToken);

    if (!verifyResult.valid) {
      console.log(chalk.red(`❌ [${requestId}] Token verification failed: ${verifyResult.error}`));
      return c.json({
        success: false,
        error: `Token verification failed: ${verifyResult.error}`,
        code: verifyResult.code
      }, 401);
    }

    const payload = verifyResult.payload;
    console.log(chalk.green(`✅ [${requestId}] Token verified`));
    console.log(chalk.gray(`   User: ${payload.user}`));
    console.log(chalk.gray(`   Agent: ${payload.agent}`));
    console.log(chalk.gray(`   Scope: ${payload.scope}`));

    // Check authorization scope
    if (payload.scope !== 'pay:merchant') {
      console.log(chalk.red(`❌ [${requestId}] Invalid scope: ${payload.scope}`));
      return c.json({
        success: false,
        error: `Invalid scope: expected 'pay:merchant', got '${payload.scope}'`,
        code: 'INVALID_SCOPE'
      }, 403);
    }

    // Check audience (if present)
    if (payload.aud && payload.aud !== 'merchant-demo') {
      console.log(chalk.red(`❌ [${requestId}] Audience mismatch: ${payload.aud}`));
      return c.json({
        success: false,
        error: `Audience mismatch: expected 'merchant-demo', got '${payload.aud}'`,
        code: 'INVALID_AUDIENCE'
      }, 403);
    }

    // Check amount limit
    if (amount > payload.limit.amount) {
      console.log(chalk.red(`❌ [${requestId}] Amount exceeds limit`));
      console.log(chalk.gray(`   Requested: $${amount.toFixed(2)}`));
      console.log(chalk.gray(`   Authorized: $${payload.limit.amount.toFixed(2)}`));
      return c.json({
        success: false,
        error: 'Amount exceeds authorized limit',
        code: 'LIMIT_EXCEEDED',
        details: {
          requested: amount,
          authorized: payload.limit.amount
        }
      }, 403);
    }

    // Check currency matches
    if (currency !== payload.limit.currency) {
      console.log(chalk.red(`❌ [${requestId}] Currency mismatch`));
      return c.json({
        success: false,
        error: `Currency mismatch: expected ${payload.limit.currency}, got ${currency}`,
        code: 'CURRENCY_MISMATCH'
      }, 403);
    }

    // Process payment (simulated)
    const transactionId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();
    
    const transaction = {
      transactionId,
      authorizedBy: payload.user,
      agent: payload.agent,
      amount,
      currency,
      description,
      timestamp,
      tokenHash
    };

    transactions.push(transaction);

    console.log(chalk.green(`✅ [${requestId}] Payment processed successfully`));
    console.log(chalk.gray(`   Transaction ID: ${transactionId}`));

    const remainingLimit = payload.limit.amount - amount;

    return c.json({
      success: true,
      transactionId,
      authorizedBy: payload.user,
      agent: payload.agent,
      amount,
      currency,
      description,
      timestamp,
      remainingLimit
    });

  } catch (error) {
    console.error(chalk.red(`❌ [${requestId}] Server error:`), error.message);
    return c.json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    }, 500);
  }
});

// Transactions list endpoint
app.get('/api/transactions', (c) => {
  return c.json({
    count: transactions.length,
    transactions: transactions.map(t => ({
      ...t,
      tokenHash: undefined // Don't expose token hashes in list
    }))
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'merchant-demo',
    version: '0.1.0',
    transactionCount: transactions.length
  });
});

// Start server
const port = Number(process.env.PORT) || 4000;

console.log(chalk.bold.magenta('\n💰 AgentOAuth Merchant Server\n'));
console.log(chalk.gray('━'.repeat(50)));
console.log(chalk.gray(`Service: Merchant Payment Processor`));
console.log(chalk.gray(`Port: ${port}`));
console.log(chalk.gray(`Audience: merchant-demo`));
console.log(chalk.gray('━'.repeat(50)));

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(chalk.green(`\n✅ Merchant server listening on http://localhost:${info.port}`));
  console.log(chalk.gray(`   Payment endpoint: POST /api/payment`));
  console.log(chalk.gray(`   Transactions: GET /api/transactions`));
  console.log(chalk.gray(`   Health: GET /health`));
  console.log(chalk.yellow('\n⏳ Waiting for payment requests...\n'));
});

