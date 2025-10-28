/**
 * AgentOAuth Cloudflare Worker - Agent Side
 * 
 * This worker demonstrates how an AI agent can issue consent tokens
 * and make authorized requests to merchants using AgentOAuth.
 */

import { issueConsent, buildPolicy } from '@agentoauth/sdk';

interface Env {
  AGENTOAUTH_PRIVATE_KEY?: string;
  MERCHANT_API_URL?: string;
}

interface PaymentRequest {
  merchantUrl: string;
  merchant?: string;
  payment: {
    amount: number;
    currency?: string;
    recipient: string;
    description?: string;
  };
  policy?: {
    preset?: 'payment' | 'read' | 'admin';
    maxAmount?: number;
    expiresIn?: string;
    scopes?: string[];
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // Health check endpoint
      if (url.pathname === '/health' && request.method === 'GET') {
        return Response.json({
          status: 'online',
          service: 'agentoauth-agent-worker',
          version: '0.5.0',
          capabilities: ['token-issuance', 'payment-forwarding', 'policy-management'],
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Issue consent token endpoint
      if (url.pathname === '/issue-token' && request.method === 'POST') {
        const body = await request.json() as {
          user: string;
          agent: string;
          scope: string;
          limit: { amount: number; currency: string };
          audience?: string;
          expiresIn?: string;
        };

        const { token, keyId, publicKey } = await issueConsent({
          user: body.user,
          agent: body.agent,
          scope: body.scope,
          limit: body.limit,
          audience: body.audience,
          expiresIn: body.expiresIn || '1h'
        });

        return Response.json({
          success: true,
          token,
          keyId,
          publicKey,
          issuedAt: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Make payment endpoint (issues token and forwards request)
      if (url.pathname === '/make-payment' && request.method === 'POST') {
        const body = await request.json() as PaymentRequest;

        // Build policy for payment
        const policy = buildPolicy({
          preset: body.policy?.preset || 'payment',
          limits: {
            amount: body.policy?.maxAmount || body.payment.amount * 2, // 2x safety margin
            currency: body.payment.currency || 'USD'
          },
          scopes: body.policy?.scopes || ['pay:merchant'],
          expiresIn: body.policy?.expiresIn || '1h',
          audience: body.merchant
        });

        // Issue consent token
        const { token } = await issueConsent({
          user: 'did:worker:agent', // Worker-based agent identity
          agent: 'cf-worker-agent-v1',
          scope: policy.scope!,
          limit: policy.limit!,
          audience: policy.aud,
          expiresIn: body.policy?.expiresIn || '1h'
        });

        // Forward payment request with token
        const paymentResponse = await fetch(body.merchantUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'AgentOAuth-Worker/0.5.0'
          },
          body: JSON.stringify(body.payment)
        });

        const result = await paymentResponse.json();

        return Response.json({
          success: paymentResponse.ok,
          payment: result,
          tokenUsed: !!token,
          agent: 'cf-worker-agent-v1',
          timestamp: new Date().toISOString()
        }, { 
          status: paymentResponse.status,
          headers: corsHeaders 
        });
      }

      // Fetch data endpoint (read-only access)
      if (url.pathname === '/fetch-data' && request.method === 'POST') {
        const body = await request.json() as {
          dataUrl: string;
          merchant?: string;
        };

        // Issue read-only token
        const { token } = await issueConsent({
          user: 'did:worker:agent',
          agent: 'cf-worker-reader-v1',
          scope: 'read:data',
          limit: { amount: 0, currency: 'USD' }, // No financial limit for reads
          audience: body.merchant,
          expiresIn: '24h' // Longer expiry for read operations
        });

        // Fetch data with token
        const dataResponse = await fetch(body.dataUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'AgentOAuth-Worker/0.5.0'
          }
        });

        const result = await dataResponse.json();

        return Response.json({
          success: dataResponse.ok,
          data: result,
          tokenUsed: !!token,
          agent: 'cf-worker-reader-v1',
          timestamp: new Date().toISOString()
        }, { 
          status: dataResponse.status,
          headers: corsHeaders 
        });
      }

      // Policy builder endpoint
      if (url.pathname === '/build-policy' && request.method === 'POST') {
        const body = await request.json() as {
          preset?: 'payment' | 'read' | 'admin';
          limits?: { amount?: number; currency?: string };
          scopes?: string[];
          expiresIn?: string;
          audience?: string;
        };

        const policy = buildPolicy({
          preset: body.preset || 'payment',
          limits: body.limits,
          scopes: body.scopes,
          expiresIn: body.expiresIn,
          audience: body.audience
        });

        return Response.json({
          policy,
          presets: {
            payment: 'For financial transactions (1h expiry, pay:merchant scope)',
            read: 'For data access (24h expiry, read:data scope)',
            admin: 'For admin operations (15m expiry, admin:manage scope)'
          },
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // 404 for unknown endpoints
      return Response.json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        availableEndpoints: [
          'GET /health - Health check',
          'POST /issue-token - Issue consent token',
          'POST /make-payment - Issue token and make payment',
          'POST /fetch-data - Issue token and fetch data',
          'POST /build-policy - Build authorization policy'
        ]
      }, { 
        status: 404,
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Agent worker error:', error);

      return Response.json({
        error: 'Internal server error',
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your request format and try again'
      }, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};
