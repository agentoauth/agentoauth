#!/usr/bin/env node

/**
 * AgentOAuth Express Quickstart - Merchant Side
 * 
 * This demonstrates how a merchant can validate AgentOAuth tokens
 * using Express middleware with different protection levels.
 */

import express from 'express';
import { requireAuth, requireScope, parseAuth, MerchantAuth, getUser, hasRequestScope, getTokenLimits } from '@agentoauth/merchant-express';  
import chalk from 'chalk';

const app = express();
app.use(express.json());

console.log(chalk.bold.cyan('\n🏪 Starting AgentOAuth Merchant Server\n'));

// Public endpoint - no auth required, but parses if present
app.get('/api/status', parseAuth(), (req, res) => {
  const user = getUser(req);
  
  console.log(chalk.blue(`📊 Status check ${req.agentoauth?.valid ? '(authenticated)' : '(anonymous)'}`));
  
  res.json({
    status: 'online',
    service: 'agentoauth-merchant',
    timestamp: new Date().toISOString(),
    authenticated: req.agentoauth?.valid || false,
    user: user.user,
    agent: user.agent
  });
});

// Payment processing - requires payment scope and validates amounts
app.post('/api/receive-payment', MerchantAuth.payment({ maxAmount: 10000 }), (req, res) => {
  const { payload } = req.agentoauth;
  const user = getUser(req);
  const limits = getTokenLimits(req);
  
  console.log(chalk.green(`💰 Payment received: $${req.body.amount}`));
  console.log(chalk.gray(`   From: ${user.user} via ${user.agent}`));
  console.log(chalk.gray(`   Token limit: $${limits.amount} ${limits.currency}`));
  
  // Additional business logic
  if (req.body.amount > limits.amount) {
    console.log(chalk.red(`❌ Amount exceeds token limit`));
    return res.status(403).json({
      error: 'Amount exceeds authorization limit',
      limit: limits.amount,
      requested: req.body.amount
    });
  }
  
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(chalk.green(`✅ Transaction approved: ${transactionId}`));
  
  res.json({
    success: true,
    transactionId,
    amount: req.body.amount,
    currency: limits.currency,
    recipient: req.body.recipient,
    description: req.body.description,
    authorizedBy: user.user,
    agent: user.agent,
    jti: user.jti,
    timestamp: new Date().toISOString()
  });
});

// Data access - requires read scope  
app.get('/api/data', MerchantAuth.readOnly(), (req, res) => {
  const user = getUser(req);
  
  console.log(chalk.blue(`📊 Data access by ${user.user}`));
  
  res.json({
    data: [
      { id: 1, value: 'Sample data 1', timestamp: new Date().toISOString() },
      { id: 2, value: 'Sample data 2', timestamp: new Date().toISOString() },
      { id: 3, value: 'Sample data 3', timestamp: new Date().toISOString() }
    ],
    meta: {
      accessedBy: user.user,
      agent: user.agent,
      timestamp: new Date().toISOString()
    }
  });
});

// Admin endpoint - requires admin scope
app.post('/api/admin/revoke', MerchantAuth.admin(), (req, res) => {
  const user = getUser(req);
  
  console.log(chalk.yellow(`🔐 Admin action by ${user.user}: Token revocation`));
  
  res.json({
    success: true,
    action: 'token_revoked',
    jti: req.body.jti,
    revokedBy: user.user,
    timestamp: new Date().toISOString()
  });
});

// Custom middleware example - multiple scopes required
app.get('/api/special', [
  requireAuth(),
  (req, res, next) => {
    // Custom validation
    if (!hasRequestScope(req, 'read:special') && !hasRequestScope(req, 'admin:manage')) {
      return res.status(403).json({
        error: 'Requires either read:special or admin:manage scope',
        code: 'INSUFFICIENT_SCOPE'
      });
    }
    next();
  }
], (req, res) => {
  const user = getUser(req);
  
  console.log(chalk.magenta(`✨ Special access by ${user.user}`));
  
  res.json({
    message: 'You have access to special data!',
    user: user.user,
    scopes: req.agentoauth?.payload?.scope
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(chalk.red(`❌ Server error: ${err.message}`));
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'SERVER_ERROR',
    suggestion: 'Please try again later'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    suggestion: 'Check the API documentation'
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(chalk.bold.green(`🏪 Merchant Server running on http://localhost:${PORT}`));
  console.log(chalk.gray('   Public: GET /api/status'));
  console.log(chalk.gray('   Payment: POST /api/receive-payment (requires pay:merchant)'));
  console.log(chalk.gray('   Data: GET /api/data (requires read:data)'));
  console.log(chalk.gray('   Admin: POST /api/admin/revoke (requires admin:manage)'));
  console.log(chalk.gray('   Special: GET /api/special (requires read:special or admin:manage)\n'));
  
  console.log(chalk.bold.yellow('🛡️  Ready to validate AgentOAuth tokens!'));
  console.log(chalk.gray('   All protected endpoints automatically validate tokens'));
  console.log();
});
