import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify as verifyToken } from '@agentoauth/sdk';
import { generateDemoKeyPair, type KeyPair } from './keys.js';
import { revokeToken, isRevoked, markAsUsed, isUsed, getStats } from './revocation.js';
import crypto from 'node:crypto';

const app = new Hono();

// Request logging middleware
app.use('/*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📨 ${method} ${path}`);
  console.log(`🕐 ${new Date().toISOString()}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`⏱️  Response time: ${duration}ms`);
  console.log(`${'='.repeat(60)}\n`);
});

// Enable CORS for playground (explicit headers)
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  credentials: false
}));

// Store key pair (in-memory for demo)
let keyPair: KeyPair;

// Initialize keys on startup
async function initializeKeys() {
  console.log('🔑 Generating Ed25519 key pair...');
  keyPair = await generateDemoKeyPair();
  console.log('✅ Generated Ed25519 key pair');
  console.log(`   Key ID: ${keyPair.kid}`);
  console.log(`   Public key type: ${keyPair.publicJWK.kty}`);
  console.log(`   Algorithm: ${keyPair.publicJWK.alg}`);
}

// JWKS endpoint
app.get('/.well-known/jwks.json', (c) => {
  if (!keyPair) {
    return c.json({ error: 'Keys not initialized' }, 500);
  }

  return c.json({
    keys: [keyPair.publicJWK]
  });
});

// Verify endpoint with input validation and logging
app.post('/verify', async (c) => {
  console.log('📥 Received /verify request');
  
  let body: any;
  let token: string | undefined;
  
  try {
    // Parse JSON with explicit error handling
    try {
      body = await c.req.json();
    } catch (parseError) {
      console.error('❌ Invalid JSON in request body');
      return c.json({
        valid: false,
        error: 'Invalid JSON in request body',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    // Validate required fields
    token = body?.token;
    const audience = body?.audience;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      console.error('❌ Missing or invalid token in request');
      return c.json({
        valid: false,
        error: 'Missing or invalid token field',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    // Log verification attempt (token hash only for security)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    console.info('🔐 Verification attempt:', {
      tokenHash,
      audience: audience || '(none)',
      timestamp: new Date().toISOString(),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    });

    // Get JWKS URL (use current host)
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    const host = c.req.header('host') || 'localhost:3000';
    const jwksUrl = `${protocol}://${host}/.well-known/jwks.json`;
    console.log('🔑 Using JWKS URL:', jwksUrl);

    // Verify token
    console.log('🔐 Verifying token...');
    const result = await verifyToken(token, jwksUrl, {
      audience: audience || undefined
    });

    // Check revocation (v0.2)
    if (result.valid && result.payload) {
      const jti = result.payload.jti;
      
      if (!jti) {
        console.warn('⚠️  Token missing jti field (v0.1 token?)');
      } else {
        // Check if token is revoked
        if (isRevoked(jti)) {
          console.info('❌ Token REVOKED:', { jti, tokenHash });
          return c.json({
            valid: false,
            error: 'Token has been revoked',
            code: 'REVOKED'
          });
        }
        
        // Check for replay attack
        if (!markAsUsed(jti, result.payload.exp)) {
          console.warn('🚨 REPLAY ATTACK detected:', { jti, tokenHash });
          return c.json({
            valid: false,
            error: 'Token replay detected - token already used',
            code: 'REPLAY'
          });
        }
      }
    }

    // Log result
    if (result.valid) {
      console.info('✅ Verification SUCCESS:', {
        tokenHash,
        jti: result.payload?.jti,
        user: result.payload?.user,
        agent: result.payload?.agent,
        scope: result.payload?.scope
      });
    } else {
      console.info('❌ Verification FAILED:', {
        tokenHash,
        code: result.code,
        error: result.error
      });
    }

    return c.json(result);

  } catch (error) {
    // Log unexpected errors
    const tokenHash = token ? 
      crypto.createHash('sha256').update(token).digest('hex').substring(0, 16) : 
      'unknown';
    
    console.error('❌ Verification error:', {
      tokenHash,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SERVER_ERROR'
    }, 500);
  }
});

// Health check endpoint for CI/monitoring
app.get('/health', (c) => {
  const isHealthy = keyPair !== undefined;
  const stats = getStats();
  
  const health = {
    status: isHealthy ? 'ok' : 'initializing',
    service: 'agentoauth-verifier',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    keyId: keyPair?.kid || null,
    revoked: stats.revokedCount,
    replayCache: stats.replayCacheSize
  };

  console.info('🏥 Health check:', health);

  return c.json(health, isHealthy ? 200 : 503);
});

// Revoke endpoint (v0.2)
app.post('/revoke', async (c) => {
  console.log('📥 Received /revoke request');
  
  try {
    const body = await c.req.json();
    const { jti } = body;
    
    if (!jti || typeof jti !== 'string') {
      console.error('❌ Missing or invalid jti');
      return c.json({
        success: false,
        error: 'Missing or invalid jti field',
        code: 'INVALID_REQUEST'
      }, 400);
    }
    
    console.log(`🚫 Revoking token: ${jti}`);
    
    const wasRevoked = revokeToken(jti);
    
    if (!wasRevoked) {
      console.info('ℹ️  Token already revoked:', jti);
    }
    
    return c.json({
      success: true,
      jti,
      revokedAt: new Date().toISOString(),
      alreadyRevoked: !wasRevoked
    });
    
  } catch (error) {
    console.error('❌ Revocation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SERVER_ERROR'
    }, 500);
  }
});

// Demo token creation endpoint (for testing) with input validation
app.post('/demo/create-token', async (c) => {
  console.log('📥 Received /demo/create-token request');
  
  let body: any;
  
  try {
    // Check if keys are initialized
    if (!keyPair) {
      console.error('❌ Keys not initialized');
      return c.json({
        error: 'Server keys not initialized',
        code: 'SERVER_ERROR'
      }, 503);
    }

    console.log('✅ Keys available, kid:', keyPair.kid);

    // Parse JSON with explicit error handling
    try {
      body = await c.req.json();
      console.log('📦 Request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse JSON body:', parseError);
      return c.json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_REQUEST',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, 400);
    }
    
    // Validate input types
    if (!body || typeof body !== 'object') {
      console.error('❌ Request body must be an object');
      return c.json({
        error: 'Request body must be a JSON object',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    // Validate required fields with type checking
    const errors: string[] = [];
    
    if (!body.user || typeof body.user !== 'string') {
      errors.push('user (string) is required');
    }
    if (!body.agent || typeof body.agent !== 'string') {
      errors.push('agent (string) is required');
    }
    if (!body.scope || typeof body.scope !== 'string') {
      errors.push('scope (string) is required');
    }
    
    if (errors.length > 0) {
      console.error('❌ Validation errors:', errors);
      return c.json({
        error: 'Invalid request parameters',
        code: 'INVALID_REQUEST',
        details: errors,
        received: { 
          user: body.user ? typeof body.user : 'missing',
          agent: body.agent ? typeof body.agent : 'missing',
          scope: body.scope ? typeof body.scope : 'missing'
        }
      }, 400);
    }

    console.log('✅ All required fields present and valid');

    // Import SDK
    console.log('📚 Importing SDK...');
    const { request: createToken } = await import('@agentoauth/sdk');
    console.log('✅ SDK imported');

    const payload = {
      ver: '0.2' as const,
      jti: body.jti || crypto.randomUUID(),
      user: body.user,
      agent: body.agent,
      scope: body.scope,
      limit: body.limit || { amount: 1000, currency: 'USD' },
      aud: body.aud,
      exp: body.exp || Math.floor(Date.now() / 1000) + 3600,
      nonce: body.nonce || crypto.randomUUID()
    };

    console.log('🔐 Creating token with payload:', JSON.stringify(payload, null, 2));

    const token = await createToken(payload, keyPair.privateJWK, keyPair.kid);

    console.log('✅ Token created successfully');
    console.log('📤 Token preview:', token.substring(0, 50) + '...');

    // Log token creation (hash only)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    console.info('🎫 Token created:', {
      tokenHash,
      user: payload.user,
      agent: payload.agent,
      scope: payload.scope,
      timestamp: new Date().toISOString()
    });

    return c.json({
      token,
      payload,
      kid: keyPair.kid
    });

  } catch (error) {
    console.error('❌ Token creation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SERVER_ERROR',
      details: error instanceof Error ? error.message : undefined
    }, 500);
  }
});

// Start server
const port = Number(process.env.PORT) || 3000;

initializeKeys().then(async () => {
  console.log(`🚀 AgentOAuth Verifier API starting on port ${port}...`);
  console.log(`   JWKS: http://localhost:${port}/.well-known/jwks.json`);
  console.log(`   Verify: POST http://localhost:${port}/verify`);
  console.log(`   Demo: POST http://localhost:${port}/demo/create-token`);
  
  // Import and use Hono's Node.js adapter
  const { serve } = await import('@hono/node-server');
  
  serve({
    fetch: app.fetch,
    port
  });
  
  console.log(`✅ Server listening on http://localhost:${port}`);
});

export default {
  port,
  fetch: app.fetch
};

