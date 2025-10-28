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

    // Choose verification method
    const verifyResult = USE_HOSTED_VERIFIER ? 
      await verifyTokenHosted(authToken) : 
      await verifyTokenLocal(authToken);

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

// Web UI Dashboard
app.get('/', (c) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>AgentOAuth Merchant Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      background: #f8fafc; 
      color: #334155;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { 
      background: white; 
      padding: 24px; 
      border-radius: 12px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
      margin-bottom: 24px; 
    }
    .status { 
      display: inline-flex; 
      align-items: center; 
      padding: 6px 12px; 
      border-radius: 20px; 
      font-size: 14px; 
      font-weight: 500;
    }
    .status.hosted { background: #dbeafe; color: #1e40af; }
    .status.local { background: #fef3c7; color: #92400e; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .card { 
      background: white; 
      padding: 24px; 
      border-radius: 12px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
    }
    .card h3 { margin-bottom: 16px; color: #1e293b; }
    .metric { margin-bottom: 12px; }
    .metric-label { font-size: 14px; color: #64748b; margin-bottom: 4px; }
    .metric-value { font-size: 24px; font-weight: 600; }
    .transactions { 
      background: white; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
    }
    .transactions-header { 
      padding: 24px; 
      border-bottom: 1px solid #e2e8f0; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .transaction { 
      padding: 16px 24px; 
      border-bottom: 1px solid #f1f5f9; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .transaction:last-child { border-bottom: none; }
    .transaction-details { flex: 1; }
    .transaction-amount { font-weight: 600; color: #059669; }
    .transaction-meta { font-size: 14px; color: #64748b; margin-top: 4px; }
    .empty { text-align: center; padding: 40px; color: #64748b; }
    .refresh-btn { 
      background: #3b82f6; 
      color: white; 
      border: none; 
      padding: 8px 16px; 
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 14px;
    }
    .refresh-btn:hover { background: #2563eb; }
    .api-key { 
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; 
      background: #f1f5f9; 
      padding: 8px 12px; 
      border-radius: 6px; 
      font-size: 12px; 
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 AgentOAuth Merchant Dashboard</h1>
      <p style="margin: 12px 0; color: #64748b;">Real-time payment verification and transaction monitoring</p>
      
      <div style="margin-top: 16px;">
        <strong>Verifier Mode:</strong>
        <span class="status ${USE_HOSTED_VERIFIER ? 'hosted' : 'local'}">
          ${USE_HOSTED_VERIFIER ? '🌐 Hosted (verifier.agentoauth.org)' : '🏠 Local (demo mode)'}
        </span>
      </div>
      
      ${USE_HOSTED_VERIFIER && HOSTED_VERIFIER_API_KEY ? `
        <div style="margin-top: 12px;">
          <div class="metric-label">API Key</div>
          <div class="api-key">${HOSTED_VERIFIER_API_KEY.substring(0, 30)}...</div>
        </div>
      ` : ''}
    </div>

    <div class="grid">
      <div class="card">
        <h3>📊 Transaction Stats</h3>
        <div class="metric">
          <div class="metric-label">Total Transactions</div>
          <div class="metric-value">${transactions.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Volume</div>
          <div class="metric-value">$${transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</div>
        </div>
      </div>

      <div class="card">
        <h3>🔐 Verification Info</h3>
        <div class="metric">
          <div class="metric-label">Service Endpoint</div>
          <div style="font-family: monospace; font-size: 14px;">
            ${USE_HOSTED_VERIFIER ? 'verifier.agentoauth.org' : 'localhost (decode only)'}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Expected Audience</div>
          <div style="font-family: monospace; font-size: 14px;">merchant-demo</div>
        </div>
      </div>
    </div>

    <div class="transactions">
      <div class="transactions-header">
        <h3>💳 Recent Transactions</h3>
        <button class="refresh-btn" onclick="location.reload()">Refresh</button>
      </div>
      
      ${transactions.length === 0 ? `
        <div class="empty">
          <p>No transactions yet</p>
          <p style="margin-top: 8px; font-size: 14px;">Run the agent script to generate payments</p>
        </div>
      ` : transactions.slice(-10).reverse().map(t => `
        <div class="transaction">
          <div class="transaction-details">
            <div><strong>${t.description || 'Payment'}</strong></div>
            <div class="transaction-meta">
              ${t.authorizedBy} → ${t.agent} | ${t.timestamp.split('T')[1].split('.')[0]}
            </div>
          </div>
          <div class="transaction-amount">$${t.amount.toFixed(2)} ${t.currency}</div>
        </div>
      `).join('')}
    </div>
    
    <div style="margin-top: 24px; text-align: center; color: #64748b; font-size: 14px;">
      <p>🔄 Auto-refresh page to see new transactions</p>
      <p style="margin-top: 8px;">
        Test endpoint: <code>POST http://localhost:${port}/api/payment</code>
      </p>
    </div>
  </div>

  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`;
  
  return c.html(html);
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'merchant-demo',
    version: '0.1.0',
    transactionCount: transactions.length,
    verifierMode: USE_HOSTED_VERIFIER ? 'hosted' : 'local',
    apiKeySet: !!HOSTED_VERIFIER_API_KEY
  });
});

// Configuration
const USE_HOSTED_VERIFIER = process.env.USE_HOSTED_VERIFIER === 'true';
const HOSTED_VERIFIER_API_KEY = process.env.AGENTOAUTH_API_KEY;

// Hosted verifier integration
const verifyTokenHosted = async (token) => {
  try {
    const response = await fetch('https://verifier.agentoauth.org/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HOSTED_VERIFIER_API_KEY
      },
      body: JSON.stringify({ 
        token, 
        audience: 'merchant-demo'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return { 
        valid: false, 
        error: errorData.error || 'Hosted verifier error',
        code: errorData.code || 'HOSTED_VERIFIER_ERROR'
      };
    }
    
    const verificationData = await response.json();
    return {
      valid: verificationData.valid,
      payload: verificationData.payload,
      error: verificationData.error,
      code: verificationData.code
    };
  } catch (error) {
    return {
      valid: false,
      error: `Hosted verifier request failed: ${error.message}`,
      code: 'HOSTED_VERIFIER_REQUEST_ERROR'
    };
  }
};

// Start server
const port = Number(process.env.PORT) || 4000;

console.log(chalk.bold.magenta('\n💰 AgentOAuth Merchant Server\n'));
console.log(chalk.gray('━'.repeat(50)));
console.log(chalk.gray(`Service: Merchant Payment Processor`));
console.log(chalk.gray(`Port: ${port}`));
console.log(chalk.gray(`Audience: merchant-demo`));

if (USE_HOSTED_VERIFIER) {
  if (!HOSTED_VERIFIER_API_KEY) {
    console.error(chalk.red('❌ ERROR: AGENTOAUTH_API_KEY required when USE_HOSTED_VERIFIER=true'));
    console.error(chalk.yellow('   Set environment variable: AGENTOAUTH_API_KEY=ak_your_api_key_here'));
    process.exit(1);
  }
  console.log(chalk.blue(`Verifier: 🌐 Hosted (verifier.agentoauth.org)`));
  console.log(chalk.gray(`API Key: ${HOSTED_VERIFIER_API_KEY.substring(0, 20)}...`));
} else {
  console.log(chalk.blue(`Verifier: 🏠 Local (demo mode - decode only)`));
}

console.log(chalk.gray('━'.repeat(50)));

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(chalk.green(`\n✅ Merchant server listening on http://localhost:${info.port}`));
  console.log(chalk.gray(`   🌐 Dashboard: http://localhost:${info.port}`));
  console.log(chalk.gray(`   📡 Payment API: POST /api/payment`));
  console.log(chalk.gray(`   📊 Transactions: GET /api/transactions`));
  console.log(chalk.gray(`   🔍 Health: GET /health`));
  console.log(chalk.yellow('\n⏳ Waiting for payment requests...\n'));
});

