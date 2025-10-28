#!/usr/bin/env node

/**
 * AgentOAuth Express Quickstart - Agent Side
 * 
 * This demonstrates how an AI agent can automatically sign requests
 * with AgentOAuth tokens using Express middleware.
 */

import express from 'express';
import { signRequests, AgentAuth } from '@agentoauth/agent-express';
import { buildPolicy } from '@agentoauth/sdk';
import chalk from 'chalk';

const app = express();
app.use(express.json());

console.log(chalk.bold.cyan('\n🤖 Starting AgentOAuth Agent Server\n'));

// Configure agent middleware with automatic token signing
app.use('/payments', AgentAuth.payment({
  user: 'did:example:alice',
  agent: 'payment-bot-v1',
  maxAmount: 5000, // Maximum amount this agent can authorize
  onTokenCreated: (token, req) => {
    console.log(chalk.green(`✅ Token created for ${req.method} ${req.url}`));
    console.log(chalk.gray(`   JTI: ${req.agentoauth?.token.split('.')[1] ? 'token-generated' : 'unknown'}`));
  }
}));

// Configure read-only middleware for data access
app.use('/data', AgentAuth.readOnly({
  user: 'did:example:alice',
  agent: 'data-reader-bot'
}));

// Payment endpoint - automatically signed with payment scope
app.post('/payments/send', async (req, res) => {
  console.log(chalk.blue(`💰 Processing payment: $${req.body.amount}`));
  
  try {
    // Token is automatically attached to headers by middleware
    const response = await fetch('http://localhost:3000/api/receive-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization // Auto-signed token
      },
      body: JSON.stringify({
        amount: req.body.amount,
        recipient: req.body.recipient,
        description: req.body.description || 'Agent payment'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(chalk.green(`✅ Payment successful: ${result.transactionId}`));
    } else {
      console.log(chalk.red(`❌ Payment failed: ${result.error}`));
    }
    
    res.json(result);
  } catch (error) {
    console.error(chalk.red(`❌ Payment error: ${error.message}`));
    res.status(500).json({
      error: 'Payment processing failed',
      details: error.message
    });
  }
});

// Data access endpoint - automatically signed with read scope
app.get('/data/fetch', async (req, res) => {
  console.log(chalk.blue(`📊 Fetching data from merchant`));
  
  try {
    const response = await fetch('http://localhost:3000/api/data', {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization // Auto-signed token
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(chalk.green(`✅ Data fetched successfully`));
    } else {
      console.log(chalk.red(`❌ Data fetch failed: ${result.error}`));
    }
    
    res.json(result);
  } catch (error) {
    console.error(chalk.red(`❌ Data fetch error: ${error.message}`));
    res.status(500).json({
      error: 'Data fetch failed',
      details: error.message
    });
  }
});

// Custom signing with manual policy
app.use('/custom', signRequests({
  user: 'did:example:alice',
  agent: 'custom-agent',
  defaultPolicy: buildPolicy({
    preset: 'custom',
    scopes: ['custom:action', 'read:special'],
    limits: { amount: 2500, currency: 'USD' },
    expiresIn: '2h'
  })
}));

app.post('/custom/action', async (req, res) => {
  console.log(chalk.blue(`🔧 Custom action with policy`));
  
  res.json({
    success: true,
    message: 'Custom action executed',
    tokenInfo: {
      hasToken: !!req.headers.authorization,
      policy: req.agentoauth?.policy
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'agentoauth-agent',
    capabilities: ['payments', 'data-access', 'custom-actions']
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(chalk.bold.green(`🤖 Agent Server running on http://localhost:${PORT}`));
  console.log(chalk.gray('   Payment endpoint: POST /payments/send'));
  console.log(chalk.gray('   Data endpoint: GET /data/fetch'));
  console.log(chalk.gray('   Custom endpoint: POST /custom/action'));
  console.log(chalk.gray('   Health check: GET /health\n'));
  
  console.log(chalk.bold.yellow('🚀 Ready to process requests with automatic token signing!'));
  console.log(chalk.gray('   Try: curl -X POST http://localhost:3001/payments/send -H "Content-Type: application/json" -d \'{"amount": 150, "recipient": "merchant-123"}\''));
  console.log();
});
