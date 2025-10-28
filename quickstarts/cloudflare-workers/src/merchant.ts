/**
 * AgentOAuth Cloudflare Worker - Merchant Side
 * 
 * This worker demonstrates how a merchant can validate AgentOAuth tokens
 * and process authorized requests from AI agents.
 */

import { verifyConsent, hasScope } from '@agentoauth/sdk';

interface Env {
  AGENTOAUTH_PUBLIC_KEY?: string;
}

interface PaymentRequest {
  amount: number;
  currency?: string;
  recipient: string;
  description?: string;
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
      // Public health check - no auth required
      if (url.pathname === '/health' && request.method === 'GET') {
        return Response.json({
          status: 'online',
          service: 'agentoauth-merchant-worker',
          version: '0.5.0',
          capabilities: ['token-validation', 'payment-processing', 'data-serving'],
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Public status - parses auth if present but doesn't require it
      if (url.pathname === '/status' && request.method === 'GET') {
        const authResult = await extractAndVerifyToken(request);
        
        return Response.json({
          status: 'online',
          authenticated: authResult.valid,
          user: authResult.payload?.user,
          agent: authResult.payload?.agent,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Payment processing - requires payment scope
      if (url.pathname === '/receive-payment' && request.method === 'POST') {
        const authResult = await extractAndVerifyToken(request);
        
        if (!authResult.valid) {
          return Response.json({
            error: authResult.error?.message || 'Authentication required',
            code: authResult.error?.code || 'MISSING_TOKEN',
            suggestion: authResult.error?.suggestion || 'Provide a valid Bearer token'
          }, { 
            status: 401,
            headers: corsHeaders 
          });
        }

        // Check payment scope
        if (!hasScope(authResult.payload.scope, 'pay:merchant')) {
          return Response.json({
            error: 'Payment scope required',
            code: 'INSUFFICIENT_SCOPE',
            suggestion: 'Request a token with pay:merchant scope',
            requiredScope: 'pay:merchant',
            actualScope: authResult.payload.scope
          }, { 
            status: 403,
            headers: corsHeaders 
          });
        }

        const payment: PaymentRequest = await request.json();

        // Validate amount against token limit
        if (payment.amount > authResult.payload.limit.amount) {
          return Response.json({
            error: 'Amount exceeds authorization limit',
            code: 'AMOUNT_EXCEEDED',
            suggestion: 'Request a token with a higher limit or reduce the amount',
            limit: authResult.payload.limit.amount,
            requested: payment.amount
          }, { 
            status: 403,
            headers: corsHeaders 
          });
        }

        // Process payment
        const transactionId = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return Response.json({
          success: true,
          transactionId,
          amount: payment.amount,
          currency: payment.currency || authResult.payload.limit.currency,
          recipient: payment.recipient,
          description: payment.description,
          authorizedBy: authResult.payload.user,
          agent: authResult.payload.agent,
          jti: authResult.payload.jti,
          processedAt: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Data serving - requires read scope
      if (url.pathname === '/data' && request.method === 'GET') {
        const authResult = await extractAndVerifyToken(request);
        
        if (!authResult.valid) {
          return Response.json({
            error: authResult.error?.message || 'Authentication required',
            code: authResult.error?.code || 'MISSING_TOKEN'
          }, { 
            status: 401,
            headers: corsHeaders 
          });
        }

        // Check read scope
        if (!hasScope(authResult.payload.scope, 'read:data')) {
          return Response.json({
            error: 'Read scope required',
            code: 'INSUFFICIENT_SCOPE',
            suggestion: 'Request a token with read:data scope',
            requiredScope: 'read:data',
            actualScope: authResult.payload.scope
          }, { 
            status: 403,
            headers: corsHeaders 
          });
        }

        // Return sample data
        return Response.json({
          data: [
            { id: 1, value: 'Cloudflare Workers data 1', timestamp: new Date().toISOString() },
            { id: 2, value: 'AgentOAuth verified data 2', timestamp: new Date().toISOString() },
            { id: 3, value: 'Edge-computed data 3', timestamp: new Date().toISOString() }
          ],
          meta: {
            accessedBy: authResult.payload.user,
            agent: authResult.payload.agent,
            location: 'Cloudflare Edge',
            timestamp: new Date().toISOString()
          }
        }, { headers: corsHeaders });
      }

      // Admin operations - requires admin scope
      if (url.pathname === '/admin/revoke' && request.method === 'POST') {
        const authResult = await extractAndVerifyToken(request);
        
        if (!authResult.valid) {
          return Response.json({
            error: 'Authentication required',
            code: 'MISSING_TOKEN'
          }, { 
            status: 401,
            headers: corsHeaders 
          });
        }

        // Check admin scope
        if (!hasScope(authResult.payload.scope, 'admin:manage')) {
          return Response.json({
            error: 'Admin scope required',
            code: 'INSUFFICIENT_SCOPE',
            suggestion: 'Request a token with admin:manage scope'
          }, { 
            status: 403,
            headers: corsHeaders 
          });
        }

        const body = await request.json() as { jti: string };
        
        // In a real implementation, you'd store revoked JTIs in KV or Durable Objects
        return Response.json({
          success: true,
          action: 'token_revoked',
          jti: body.jti,
          revokedBy: authResult.payload.user,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // 404 for unknown endpoints
      return Response.json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        availableEndpoints: [
          'GET /health - Public health check',
          'GET /status - Public status (parses auth)',
          'POST /receive-payment - Process payment (requires pay:merchant)',
          'GET /data - Serve data (requires read:data)',
          'POST /admin/revoke - Revoke token (requires admin:manage)'
        ]
      }, { 
        status: 404,
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Merchant worker error:', error);

      return Response.json({
        error: 'Internal server error',
        code: 'MERCHANT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your request format and try again'
      }, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};

/**
 * Extract and verify token from request
 */
async function extractAndVerifyToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: { 
        code: 'MISSING_TOKEN', 
        message: 'No Bearer token provided',
        suggestion: 'Include Authorization: Bearer <token> header'
      }
    };
  }
  
  const token = authHeader.slice(7);
  
  // In a real implementation, you'd load the public key from environment or KV
  const result = await verifyConsent(token, {
    // Note: For this demo, tokens are self-contained with key generation
    // In production, you'd configure a JWKS URL or public key
  });
  
  return {
    valid: result.valid,
    payload: result.payload,
    token,
    error: result.error
  };
}
