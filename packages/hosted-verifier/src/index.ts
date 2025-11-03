import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Import minimal decode functionality to avoid Node.js dependencies
// Note: For alpha, we'll do basic token parsing instead of full SDK import
import { decode } from '@agentoauth/sdk/dist/decode.js';
import { verifyApiKey, loadApiKeyPublicKey } from './auth.js';
import { RateLimiter } from './rate-limit.js';
import { AuditLogger } from './audit.js';
import { loadPublicKeys } from './keys.js';
// Policy evaluation imports
import { evaluatePolicyStateless, hashPolicy, canonicalizePolicy } from './policy/index.js';
import { signReceipt, createReceiptId } from './policy/receipts.js';
import { PolicyState } from './policy-state.js';

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  AUDIT_LOGS_R2?: R2Bucket;
  API_KEY_PUBLIC_KEY: string;
  AUDIT_SALT: string;
  POLICY_STATE: DurableObjectNamespace<PolicyState>;
  SIGNING_PRIVATE_KEY: string;
  SIGNING_KID: string;
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
    status: 'ok',
    service: 'agentoauth-verifier',
    version: '0.7.0',
    build: '2025-11-02',
    features: [
      'act.v0.2', 
      'policy-eval', 
      'stateful-budgets', 
      'receipts', 
      'keyless-free-tier',  // NEW: API key optional
      'ip-rate-limiting'    // NEW: IP-based backstop
    ],
    api_key_optional: true,  // NEW: X-API-Key is optional
    free_tier: {
      enabled: true,
      limits: {
        per_issuer: '1,000/day, 10,000/month',
        per_ip: '60/minute, 1,000/hour'
      }
    },
    endpoints: {
      verify: 'POST /verify',
      simulate: 'POST /simulate',
      revoke: 'POST /revoke',
      receipts: 'GET /receipts/:id',
      lint_policy: 'POST /lint/policy',
      lint_token: 'POST /lint/token',
      jwks: 'GET /.well-known/jwks.json',
      usage: 'GET /usage',
      terms: 'GET /terms'
    }
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
    <li><span class="highlight">Free Tier (No API Key Required):</span>
      <ul>
        <li>1,000 verifications/day per token issuer (iss)</li>
        <li>10,000 verifications/month per token issuer</li>
        <li>60 requests/minute per IP address</li>
        <li>1,000 requests/hour per IP address</li>
      </ul>
    </li>
    <li>API keys are optional - you can start using the service immediately</li>
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

// Main verification endpoint (API key optional for free tier)
app.post('/verify', async (c) => {
  const startTime = Date.now();
  let statusCode = 200;
  let errorCode: string | undefined;
  let tenantId = '';
  let tenantName = '';
  let tier: 'free' | 'pro' | 'enterprise' = 'free';
  let quotas = { daily: 1000, monthly: 10000 }; // Default free tier quotas
  let tokenPayload: any = undefined;
  
  try {
    // 1. Extract and parse request body early (needed for both keyless and API key flows)
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
    
    // 2. Extract API key (OPTIONAL)
    const apiKeyHeader = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
    
    if (apiKeyHeader) {
      // API KEY PROVIDED: Use existing authenticated flow
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
      
      tenantId = apiKeyResult.payload!.sub;
      tenantName = apiKeyResult.payload!.name;
      tier = apiKeyResult.payload!.tier;
      quotas = apiKeyResult.payload!.quotas;
    } else {
      // KEYLESS (FREE TIER): Extract tenant from token issuer
      try {
        const { payload } = decode(token);
        
        if (!payload.iss) {
          statusCode = 400;
          return c.json({
            error: 'Token must have iss (issuer) claim',
            code: 'MISSING_ISSUER',
            suggestion: 'Ensure your token includes an iss claim identifying the token issuer',
            docs: 'https://github.com/agentoauth/agentoauth/blob/main/SPEC.md'
          }, 400);
        }
        
        tenantId = payload.iss; // e.g., "wallet.alice.com"
        tenantName = `Free: ${payload.iss}`;
        tier = 'free';
        // Keep default free tier quotas
      } catch (decodeError) {
        statusCode = 400;
        return c.json({
          error: 'Failed to decode token',
          code: 'INVALID_TOKEN',
          suggestion: 'Ensure token is a valid JWT format'
        }, 400);
      }
    }
    
    // 3. IP-based rate limiting (backstop for all requests, especially keyless)
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
    const rateLimiter = new RateLimiter(c.env.RATE_LIMIT_KV);
    
    const ipLimit = await rateLimiter.checkIPLimit(clientIP, {
      perMinute: 60,
      perHour: 1000
    });
    
    if (!ipLimit.allowed) {
      statusCode = 429;
      errorCode = 'IP_RATE_LIMIT';
      return c.json({
        error: ipLimit.reason,
        code: 'IP_RATE_LIMIT',
        suggestion: 'Slow down your request rate or distribute requests across time',
        resetTime: ipLimit.resetTime
      }, 429);
    }
    
    // 4. Check tenant-specific rate limits (by tenantId from API key or iss)
    const limitResult = await rateLimiter.checkLimit(tenantId, quotas);
    
    if (!limitResult.allowed) {
      statusCode = 429;
      errorCode = 'QUOTA_EXCEEDED';
      
      c.header('X-RateLimit-Limit', limitResult.limit.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', limitResult.resetTime.toString());
      
      return c.json({
        error: limitResult.error,
        code: 'QUOTA_EXCEEDED',
        tier: tier,
        quotas: quotas,
        suggestion: tier === 'free' 
          ? 'Free tier limit reached. Wait for quota reset or contact us for higher tiers.'
          : 'Quota exceeded. Wait for reset or upgrade your plan.',
        resetTime: limitResult.resetTime,
        docs: 'https://verifier.agentoauth.org/terms'
      }, 429);
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
      } else if (!payload.ver || (payload.ver !== '0.1' && payload.ver !== '0.2' && payload.ver !== 'act.v0.2')) {
        verificationResult = {
          valid: false,
          error: { 
            message: `Unsupported token version: ${payload.ver}`, 
            code: 'UNSUPPORTED_VERSION',
            suggestion: 'Use a supported AgentOAuth token version (0.1, 0.2, or act.v0.2)'
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
    
    // 7. Policy evaluation (act.v0.2)
    if (verificationResult.valid && verificationResult.payload?.policy && verificationResult.payload?.policy_hash) {
      try {
        // Verify policy hash
        const computedHash = await hashPolicy(verificationResult.payload.policy);
        if (computedHash !== verificationResult.payload.policy_hash) {
          return c.json({
            decision: 'DENY',
            error: 'Policy hash verification failed',
            code: 'POLICY_HASH_MISMATCH'
          }, 400);
        }
        
        // Check revocation (KV lookup)
        if (verificationResult.payload.jti) {
          const revokedToken = await c.env.RATE_LIMIT_KV.get(`rev:jti:${verificationResult.payload.jti}`);
          if (revokedToken) {
            return c.json({
              decision: 'DENY',
              error: 'Token has been revoked',
              code: 'REVOKED'
            }, 403);
          }
        }
        if (verificationResult.payload.policy?.id) {
          const revokedPolicy = await c.env.RATE_LIMIT_KV.get(`rev:pol:${verificationResult.payload.policy.id}`);
          if (revokedPolicy) {
            return c.json({
              decision: 'DENY',
              error: 'Policy has been revoked',
              code: 'POLICY_REVOKED'
            }, 403);
          }
        }
        
        // Stateless policy checks
        const requestContext = {
          action: body?.action || verificationResult.payload.scope,
          resource: body?.resource ? {
            type: body.resource.type,
            id: body.resource.id
          } : undefined,
          amount: body?.amount,
          currency: body?.currency,
          timestamp: Math.floor(Date.now() / 1000)
        };
        
        const statelessResult = evaluatePolicyStateless(verificationResult.payload.policy, requestContext);
        if (!statelessResult.allowed) {
          return c.json({
            decision: 'DENY',
            reason: statelessResult.reason
          }, 403);
        }
        
        // Stateful checks via Durable Object (for per-period budgets)
        let doDecision = { allowed: true, remaining: undefined };
        if (verificationResult.payload.policy.limits.per_period && requestContext.amount) {
          try {
            const doId = c.env.POLICY_STATE.idFromName(`${verificationResult.payload.iss || 'unknown'}:${verificationResult.payload.policy.id}`);
            const doStub = c.env.POLICY_STATE.get(doId);
            const doResponse = await doStub.fetch(new Request('https://do/apply', {
              method: 'POST',
              body: JSON.stringify({
                method: 'apply',
                body: {
                  policy: verificationResult.payload.policy,
                  context: requestContext,
                  jti: verificationResult.payload.jti,
                  idempotencyKey: body?.idempotency_key
                }
              })
            }));
            doDecision = await doResponse.json();
            
            if (!doDecision.allowed) {
              return c.json({
                decision: 'DENY',
                reason: doDecision.reason
              }, 403);
            }
          } catch (doError) {
            console.error('Durable Object error:', doError);
            // If DO fails, conservatively deny
            return c.json({
              decision: 'DENY',
              error: 'Service temporarily unavailable',
              code: 'VERIFIER_UNAVAILABLE'
            }, 503);
          }
        }
        
        // Sign receipt
        let receiptId: string | undefined;
        let receiptToken: string | undefined;
        try {
          receiptId = createReceiptId();
          const privateKey = JSON.parse(c.env.SIGNING_PRIVATE_KEY);
          receiptToken = await signReceipt({
            id: receiptId,
            policy_id: verificationResult.payload.policy.id,
            decision: 'ALLOW',
            timestamp: Math.floor(Date.now() / 1000),
            remaining: doDecision.remaining
          }, privateKey, c.env.SIGNING_KID);
          
          // Store receipt in KV (400 days TTL)
          await c.env.RATE_LIMIT_KV.put(`rcpt:${receiptId}`, receiptToken, { 
            expirationTtl: 400 * 86400 
          });
        } catch (receiptError) {
          console.error('Receipt signing error:', receiptError);
          // Don't fail verification if receipt fails
        }
        
        // Return ALLOW decision
        const response: any = {
          decision: 'ALLOW',
          policy_hash: verificationResult.payload.policy_hash,
          timestamp: new Date().toISOString()
        };
        
        if (receiptId) {
          response.receipt_id = receiptId;
          c.header('X-ACT-Receipt-Id', receiptId);
        }
        if (doDecision.remaining) {
          response.remaining_budget = doDecision.remaining;
        }
        
        return c.json(response);
      } catch (error) {
        console.error('Policy evaluation error:', error);
        return c.json({
          error: 'Policy evaluation failed',
          code: 'POLICY_ERROR'
        }, 500);
      }
    }
    
    // 8. Return result (legacy tokens without policy)
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
    if (tenantId) {
      try {
        const auditLogger = new AuditLogger(c.env.AUDIT_LOGS_R2, c.env.AUDIT_SALT);
        const responseTime = Date.now() - startTime;
        
        await auditLogger.logVerification({
          orgId: tenantId,  // tenantId can be from API key or iss
          orgName: tenantName,
          request: c.req.raw,
          statusCode,
          responseTime,
          tokenPayload,
          errorCode,
          tier
        });
      } catch (auditError) {
        // Don't let audit failures break the response
        console.error('Audit logging failed:', auditError);
      }
    }
  }
});

// Simulate endpoint - same as verify but no state mutations
app.post('/simulate', async (c) => {
  const startTime = Date.now();
  let statusCode = 200;
  let errorCode: string | undefined;
  
  try {
    // Similar to /verify but call DO with method='simulate'
    const body = await c.req.json();
    const { token } = body;
    
    if (!token) {
      return c.json({
        error: 'Token required',
        code: 'MISSING_TOKEN'
      }, 400);
    }
    
    // Decode token
    const { payload } = decode(token);
    
    // Policy evaluation (same as /verify)
    if (payload?.policy && payload?.policy_hash) {
      // Verify policy hash
      const computedHash = await hashPolicy(payload.policy);
      if (computedHash !== payload.policy_hash) {
        return c.json({
          decision: 'DENY',
          error: 'Policy hash verification failed',
          code: 'POLICY_HASH_MISMATCH'
        }, 400);
      }
      
      // Stateless checks
      const requestContext = {
        action: body?.action || payload.scope,
        resource: body?.resource ? {
          type: body.resource.type,
          id: body.resource.id
        } : undefined,
        amount: body?.amount,
        currency: body?.currency,
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      const statelessResult = evaluatePolicyStateless(payload.policy, requestContext);
      if (!statelessResult.allowed) {
        return c.json({
          decision: 'DENY',
          reason: statelessResult.reason
        }, 403);
      }
      
      // Stateful checks via Durable Object (SIMULATE mode)
      let doDecision = { allowed: true, remaining: undefined };
      if (payload.policy.limits.per_period && requestContext.amount) {
        try {
          const doId = c.env.POLICY_STATE.idFromName(`${payload.iss || 'unknown'}:${payload.policy.id}`);
          const doStub = c.env.POLICY_STATE.get(doId);
          const doResponse = await doStub.fetch(new Request('https://do/simulate', {
            method: 'POST',
            body: JSON.stringify({
              method: 'simulate',
              body: {
                policy: payload.policy,
                context: requestContext
              }
            })
          }));
          doDecision = await doResponse.json();
          
          if (!doDecision.allowed) {
            return c.json({
              decision: 'DENY',
              reason: doDecision.reason
            }, 403);
          }
        } catch (doError) {
          console.error('Durable Object error:', doError);
          return c.json({
            decision: 'DENY',
            error: 'Service temporarily unavailable',
            code: 'VERIFIER_UNAVAILABLE'
          }, 503);
        }
      }
      
      // Return decision (NO receipt signing, NO storage mutations)
      const response: any = {
        decision: 'ALLOW',
        policy_hash: payload.policy_hash,
        timestamp: new Date().toISOString(),
        simulation: true
      };
      
      if (doDecision.remaining) {
        response.remaining_budget = doDecision.remaining;
      }
      
      return c.json(response);
    }
    
    // Legacy tokens
    return c.json({
      decision: 'ALLOW',
      simulation: true
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return c.json({
      error: 'Simulation failed',
      code: 'SIMULATION_ERROR'
    }, 500);
  }
});

// Revoke endpoint
app.post('/revoke', async (c) => {
  try {
    const body = await c.req.json();
    const { jti, policy_id } = body;
    
    if (!jti && !policy_id) {
      return c.json({
        error: 'jti or policy_id required',
        code: 'MISSING_REVOCATION_ID'
      }, 400);
    }
    
    if (jti) {
      // Store revocation (expires with token, assuming 1 year max)
      await c.env.RATE_LIMIT_KV.put(`rev:jti:${jti}`, '1', { expirationTtl: 365 * 86400 });
    }
    
    if (policy_id) {
      // Store policy revocation (long TTL)
      await c.env.RATE_LIMIT_KV.put(`rev:pol:${policy_id}`, '1', { expirationTtl: 365 * 86400 });
    }
    
    return c.json({ revoked: true });
  } catch (error) {
    console.error('Revocation error:', error);
    return c.json({
      error: 'Revocation failed',
      code: 'REVOCATION_ERROR'
    }, 500);
  }
});

// Receipts endpoint
app.get('/receipts/:id', async (c) => {
  try {
    const receiptId = c.req.param('id');
    const receipt = await c.env.RATE_LIMIT_KV.get(`rcpt:${receiptId}`);
    
    if (!receipt) {
      return c.json({ error: 'Receipt not found' }, 404);
    }
    
    return c.text(receipt, 200, {
      'Content-Type': 'application/jwt'
    });
  } catch (error) {
    console.error('Receipt retrieval error:', error);
    return c.json({
      error: 'Receipt retrieval failed',
      code: 'RECEIPT_ERROR'
    }, 500);
  }
});

// Lint policy endpoint
app.post('/lint/policy', async (c) => {
  try {
    const policy = await c.req.json();
    
    // Basic validation (can be enhanced with full schema validation)
    if (!policy.version || !policy.actions || !policy.resources || !policy.limits) {
      return c.json({
        valid: false,
        errors: ['Missing required fields: version, actions, resources, or limits']
      }, 400);
    }
    
    // Canonicalize and hash
    const canonical = canonicalizePolicy(policy);
    const hash = await hashPolicy(policy);
    
    return c.json({
      valid: true,
      policy_hash: hash,
      canonical
    });
  } catch (error) {
    console.error('Lint policy error:', error);
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

// Lint token endpoint
app.post('/lint/token', async (c) => {
  try {
    const { token } = await c.req.json();
    
    if (!token) {
      return c.json({
        valid: false,
        error: 'Token required'
      }, 400);
    }
    
    const { header, payload } = decode(token);
    return c.json({
      valid: true,
      header,
      payload
    });
  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Token parse failed'
    }, 400);
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

// Export Durable Object class for Cloudflare Workers
export { PolicyState } from './policy-state.js';

export default app;
