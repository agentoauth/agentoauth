import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Import minimal decode functionality to avoid Node.js dependencies
// Note: For alpha, we'll do basic token parsing instead of full SDK import
import { decode } from '@agentoauth/sdk/dist/decode.js';
import { verifyApiKey, loadApiKeyPublicKey } from './auth.js';
import { RateLimiter } from './rate-limit.js';
import { AuditLogger } from './audit.js';
import { loadPublicKeys } from './keys.js';

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  AUDIT_LOGS_R2?: R2Bucket;
  API_KEY_PUBLIC_KEY: string;
  AUDIT_SALT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for browser usage
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'online',
    service: 'agentoauth-hosted-verifier',
    version: '0.6.0-alpha',
    timestamp: new Date().toISOString(),
    endpoints: {
      verify: 'POST /verify',
      jwks: 'GET /.well-known/jwks.json',
      usage: 'GET /usage',
      terms: 'GET /terms'
    },
    verification: 'Structural validation only - Full signature verification in beta',
    notice: 'Alpha service - No SLA - Development use only'
  });
});

// JWKS endpoint (public keys for token verification)
app.get('/.well-known/jwks.json', async (c) => {
  try {
    const jwks = await loadPublicKeys();
    
    c.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return c.json(jwks);
  } catch (error) {
    console.error('JWKS error:', error);
    return c.json({
      error: 'Failed to load public keys',
      code: 'JWKS_ERROR'
    }, 500);
  }
});

// Terms of service endpoint
app.get('/terms', (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>AgentOAuth Hosted Verifier - Terms of Service</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .notice { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7; }
    .highlight { background: #74b9ff; color: white; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>AgentOAuth Hosted Verifier - Terms of Service</h1>
  
  <div class="notice">
    <strong>⚠️ ALPHA SERVICE NOTICE</strong><br>
    This is an experimental alpha service. By using this service, you acknowledge:
    <ul>
      <li>No SLA or uptime guarantees</li>
      <li>Service may be discontinued at any time</li>
      <li>For pilot and development use only</li>
      <li>Not suitable for production workloads</li>
    </ul>
  </div>
  
  <h2>1. Service Description</h2>
  <p>The AgentOAuth Hosted Verifier provides token verification for AgentOAuth protocol implementations. This is a free pilot service for development and testing purposes.</p>
  
  <h2>2. Rate Limits and Quotas</h2>
  <ul>
    <li><span class="highlight">Free Tier:</span> 1,000 verifications/day, 10,000/month</li>
    <li>Requests exceeding quota will be rejected with HTTP 429</li>
    <li>Service is subject to fair use policies</li>
  </ul>
  
  <h2>3. Privacy and Data Handling</h2>
  <ul>
    <li><strong>Privacy-First:</strong> We hash personally identifiable information (PIIs)</li>
    <li><strong>No Token Storage:</strong> We do not store complete tokens or sensitive payload data</li>
    <li><strong>Audit Logs:</strong> We maintain privacy-preserving audit logs for service operation</li>
    <li><strong>No Data Sharing:</strong> We do not share your data with third parties</li>
  </ul>
  
  <h2>4. API Keys</h2>
  <p>API keys are required for all requests. Keep your keys secure and contact us if compromised.</p>
  
  <h2>5. Limitation of Liability</h2>
  <p><strong>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES. WE ARE NOT LIABLE FOR ANY DAMAGES ARISING FROM USE OF THE SERVICE.</strong></p>
  
  <h2>6. Contact</h2>
  <p>Questions? Contact: <a href="mailto:alpha@agentoauth.org">alpha@agentoauth.org</a></p>
  
  <hr>
  <p><small>Last updated: January 2025 | AgentOAuth Hosted Verifier Alpha v0.6.0</small></p>
</body>
</html>`;

  return c.html(html);
});

// Main verification endpoint with API key auth
app.post('/verify', async (c) => {
  const startTime = Date.now();
  let statusCode = 200;
  let errorCode: string | undefined;
  let orgId = '';
  let orgName = '';
  let tokenPayload: any = undefined;
  
  try {
    // 1. Extract API key
    const apiKeyHeader = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (!apiKeyHeader) {
      statusCode = 401;
      return c.json({
        error: 'API key required',
        code: 'MISSING_API_KEY',
        suggestion: 'Include X-API-Key header or Authorization: Bearer <api-key>',
        docs: 'https://verifier.agentoauth.org/terms'
      }, 401);
    }
    
    // 2. Verify API key
    const publicKey = await loadApiKeyPublicKey(c.env.API_KEY_PUBLIC_KEY);
    const apiKeyResult = await verifyApiKey(apiKeyHeader, publicKey);
    
    if (!apiKeyResult.valid) {
      statusCode = 401;
      errorCode = 'INVALID_API_KEY';
      return c.json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        details: apiKeyResult.error,
        suggestion: 'Check your API key format and expiration'
      }, 401);
    }
    
    orgId = apiKeyResult.payload!.sub;
    orgName = apiKeyResult.payload!.name;
    
    // 3. Check rate limits
    const rateLimiter = new RateLimiter(c.env.RATE_LIMIT_KV);
    const limitResult = await rateLimiter.checkLimit(
      apiKeyResult.payload!.sub, 
      apiKeyResult.payload!.quotas
    );
    
    if (!limitResult.allowed) {
      statusCode = 429;
      errorCode = 'QUOTA_EXCEEDED';
      
      c.header('X-RateLimit-Limit', limitResult.limit.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', limitResult.resetTime.toString());
      
      return c.json({
        error: limitResult.error,
        code: 'QUOTA_EXCEEDED',
        suggestion: 'Upgrade your plan or wait for quota reset',
        resetTime: limitResult.resetTime
      }, 429);
    }
    
    // 4. Extract and verify token
    const body = await c.req.json();
    const { token, audience } = body;
    
    if (!token) {
      statusCode = 400;
      errorCode = 'MISSING_TOKEN';
      return c.json({
        error: 'Token required',
        code: 'MISSING_TOKEN',
        suggestion: 'Include token in request body'
      }, 400);
    }
    
    // 5. Verify AgentOAuth token (simplified for Workers environment)
    let verificationResult;
    
    try {
      // For now, decode and validate token structure
      // In production, this would do full signature verification
      const { header, payload } = decode(token);
      
      // Basic validation
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp < now) {
        verificationResult = {
          valid: false,
          error: { 
            message: 'Token has expired', 
            code: 'EXPIRED',
            suggestion: 'Generate a new token with a longer expiration time'
          }
        };
      } else if (audience && payload.aud !== audience) {
        verificationResult = {
          valid: false,
          error: { 
            message: `Audience mismatch: expected ${audience}, got ${payload.aud}`, 
            code: 'AUDIENCE_MISMATCH',
            suggestion: 'Check the audience field in your token matches the expected value'
          }
        };
      } else if (!payload.ver || (payload.ver !== '0.1' && payload.ver !== '0.2')) {
        verificationResult = {
          valid: false,
          error: { 
            message: `Unsupported token version: ${payload.ver}`, 
            code: 'UNSUPPORTED_VERSION',
            suggestion: 'Use a supported AgentOAuth token version (0.1 or 0.2)'
          }
        };
      } else {
        // Token structure is valid
        verificationResult = {
          valid: true,
          payload: payload
        };
      }
    } catch (error) {
      verificationResult = {
        valid: false,
        error: { 
          message: 'Token decode failed', 
          code: 'INVALID_TOKEN',
          suggestion: 'Check that the token is a valid AgentOAuth token format'
        }
      };
    }
    
    // 6. Add rate limit headers
    c.header('X-RateLimit-Limit', limitResult.limit.toString());
    c.header('X-RateLimit-Remaining', limitResult.remaining.toString());
    c.header('X-RateLimit-Reset', limitResult.resetTime.toString());
    
    // Store token payload for audit logging
    tokenPayload = verificationResult.valid ? verificationResult.payload : undefined;
    
    // 7. Return result
    if (verificationResult.valid) {
      statusCode = 200;
      return c.json({
        valid: true,
        payload: verificationResult.payload,
        verifiedBy: 'agentoauth.org',
        timestamp: new Date().toISOString()
      });
    } else {
      statusCode = 400;
      errorCode = verificationResult.error?.code;
      return c.json({
        valid: false,
        error: verificationResult.error?.message,
        code: verificationResult.error?.code,
        suggestion: verificationResult.error?.suggestion
      }, 400);
    }
    
  } catch (error) {
    console.error('Verification error:', error);
    statusCode = 500;
    errorCode = 'SERVER_ERROR';
    
    return c.json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      suggestion: 'Please try again later'
    }, 500);
  } finally {
    // 8. Log for audit (privacy-first) - always log, even on errors
    if (orgId) {
      try {
        const auditLogger = new AuditLogger(c.env.AUDIT_LOGS_R2, c.env.AUDIT_SALT);
        const responseTime = Date.now() - startTime;
        
        await auditLogger.logVerification({
          orgId,
          orgName,
          request: c.req.raw,
          statusCode,
          responseTime,
          tokenPayload,
          errorCode
        });
      } catch (auditError) {
        // Don't let audit failures break the response
        console.error('Audit logging failed:', auditError);
      }
    }
  }
});

// Usage endpoint for API key holders
app.get('/usage', async (c) => {
  try {
    const apiKey = c.req.header('X-API-Key');
    if (!apiKey) {
      return c.json({ 
        error: 'API key required',
        code: 'MISSING_API_KEY'
      }, 401);
    }
    
    const publicKey = await loadApiKeyPublicKey(c.env.API_KEY_PUBLIC_KEY);
    const apiKeyResult = await verifyApiKey(apiKey, publicKey);
    
    if (!apiKeyResult.valid) {
      return c.json({ 
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      }, 401);
    }
    
    const rateLimiter = new RateLimiter(c.env.RATE_LIMIT_KV);
    const usage = await rateLimiter.getUsage(apiKeyResult.payload!.sub);
    
    return c.json({
      organization: {
        id: apiKeyResult.payload!.sub,
        name: apiKeyResult.payload!.name,
        tier: apiKeyResult.payload!.tier
      },
      quotas: apiKeyResult.payload!.quotas,
      usage: {
        daily: { ...usage.daily, limit: apiKeyResult.payload!.quotas.daily },
        monthly: { ...usage.monthly, limit: apiKeyResult.payload!.quotas.monthly }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Usage endpoint error:', error);
    return c.json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    availableEndpoints: [
      'GET /health - Service health check',
      'GET /.well-known/jwks.json - Public keys for verification', 
      'POST /verify - Verify AgentOAuth tokens (requires API key)',
      'GET /usage - Check API key usage (requires API key)',
      'GET /terms - Terms of service'
    ],
    docs: 'https://verifier.agentoauth.org/terms'
  }, 404);
});

export default app;
