import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { request, verify, decode, AgentOAuthError, type AgentOAuthPayload } from './index.js';
import type { JWK } from 'jose';

describe('AgentOAuth SDK', () => {
  let privateJWK: JWK;
  let publicJWK: JWK;
  let kid: string;
  let mockJWKSServer: { url: string; keys: JWK[] };

  beforeAll(async () => {
    // Generate key pair for tests
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    privateJWK = await exportJWK(privateKey);
    publicJWK = await exportJWK(publicKey);
    kid = 'test-key-1';
    publicJWK.kid = kid;
    publicJWK.use = 'sig';
    publicJWK.alg = 'EdDSA';

    // Mock JWKS server
    mockJWKSServer = {
      url: 'https://test.example/.well-known/jwks.json',
      keys: [publicJWK]
    };
  });

  describe('Token Creation (request)', () => {
    it('should create a valid token', async () => {
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:alice',
        agent: 'test-bot@example',
        scope: 'pay:merchant',
        limit: {
          amount: 1000,
          currency: 'USD'
        },
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: 'test-nonce-12345678'
      };

      const token = await request(payload, privateJWK, kid);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should create token with optional audience', async () => {
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:bob',
        agent: 'payment-bot',
        scope: 'transfer:funds',
        limit: { amount: 5000, currency: 'EUR' },
        aud: 'bank.example',
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'nonce-with-aud-789'
      };

      const token = await request(payload, privateJWK, kid);
      
      expect(token).toBeTruthy();
      // Decode to verify audience is included
      const parts = token.split('.');
      const decodedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );
      expect(decodedPayload.aud).toBe('bank.example');
    });

    it('should reject invalid payload - missing required fields', async () => {
      const invalidPayload = {
        ver: '0.1',
        user: 'did:example:carol',
        // missing: agent, scope, limit, exp, nonce
      } as unknown as AgentOAuthPayload;

      await expect(
        request(invalidPayload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });

    it('should reject invalid payload - wrong version', async () => {
      const invalidPayload = {
        ver: '0.2', // wrong version
        user: 'did:example:dave',
        agent: 'test-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'test-nonce-xyz'
      } as unknown as AgentOAuthPayload;

      await expect(
        request(invalidPayload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });

    it('should reject invalid payload - bad currency format', async () => {
      const invalidPayload = {
        ver: '0.1',
        user: 'did:example:eve',
        agent: 'test-bot',
        scope: 'pay:merchant',
        limit: { amount: 100, currency: 'USDT' }, // must be 3 uppercase letters
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'test-nonce-abc'
      } as AgentOAuthPayload;

      await expect(
        request(invalidPayload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });

    it('should reject invalid payload - bad scope format', async () => {
      const invalidPayload = {
        ver: '0.1',
        user: 'did:example:frank',
        agent: 'test-bot',
        scope: 'invalid scope!', // contains invalid characters
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'test-nonce-def'
      } as AgentOAuthPayload;

      await expect(
        request(invalidPayload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });
  });

  describe('Token Verification (verify)', () => {
    it('should verify a valid token → valid: true', async () => {
      // Create a valid token
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:alice',
        agent: 'verify-test-bot',
        scope: 'pay:merchant',
        limit: { amount: 2000, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'verify-test-nonce-123'
      };

      const token = await request(payload, privateJWK, kid);

      // Mock fetch to return JWKS
      global.fetch = async (url: RequestInfo | URL) => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(token, mockJWKSServer.url);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.user).toBe('did:example:alice');
      expect(result.payload?.agent).toBe('verify-test-bot');
      expect(result.error).toBeUndefined();
    });

    it('should reject expired token → EXPIRED', async () => {
      // Create an expired token
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:bob',
        agent: 'expired-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'EUR' },
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        nonce: 'expired-nonce-456'
      };

      const token = await request(payload, privateJWK, kid);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(token, mockJWKSServer.url);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('EXPIRED');
      expect(result.error).toContain('expired');
    });

    it('should reject token with audience mismatch → INVALID_AUDIENCE', async () => {
      // Create token with specific audience
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:carol',
        agent: 'aud-test-bot',
        scope: 'pay:merchant',
        limit: { amount: 500, currency: 'GBP' },
        aud: 'merchant-a.example',
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'aud-test-nonce-789'
      };

      const token = await request(payload, privateJWK, kid);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      // Verify with different audience
      const result = await verify(token, mockJWKSServer.url, {
        audience: 'merchant-b.example' // mismatch!
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_AUDIENCE');
      expect(result.error).toContain('Audience mismatch');
    });

    it('should accept token with matching audience', async () => {
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:dave',
        agent: 'aud-match-bot',
        scope: 'pay:merchant',
        limit: { amount: 1500, currency: 'USD' },
        aud: 'correct-merchant.example',
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'aud-match-nonce-abc'
      };

      const token = await request(payload, privateJWK, kid);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(token, mockJWKSServer.url, {
        audience: 'correct-merchant.example' // matches!
      });

      expect(result.valid).toBe(true);
      expect(result.payload?.aud).toBe('correct-merchant.example');
    });

    it('should reject tampered token → INVALID_SIGNATURE', async () => {
      // Create a valid token
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:eve',
        agent: 'tamper-test-bot',
        scope: 'pay:merchant',
        limit: { amount: 1000, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'tamper-test-nonce-def'
      };

      const token = await request(payload, privateJWK, kid);

      // Tamper with the token by modifying the payload
      const parts = token.split('.');
      const tamperedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );
      tamperedPayload.limit.amount = 9999999; // increase amount!
      
      const tamperedPayloadBase64 = Buffer.from(
        JSON.stringify(tamperedPayload)
      ).toString('base64url');
      
      const tamperedToken = `${parts[0]}.${tamperedPayloadBase64}.${parts[2]}`;

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(tamperedToken, mockJWKSServer.url);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject token with invalid version', async () => {
      // Create token with wrong version manually
      const wrongPayload = {
        ver: '0.2', // wrong version
        user: 'did:example:frank',
        agent: 'version-test-bot',
        scope: 'pay:merchant',
        limit: { amount: 1000, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'version-test-nonce'
      };

      // Sign it manually (bypass our validation)
      const privateKey = await importJWK(privateJWK, 'EdDSA');
      const token = await new SignJWT(wrongPayload as any)
        .setProtectedHeader({ alg: 'EdDSA', kid, typ: 'JWT' })
        .sign(privateKey);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(token, mockJWKSServer.url);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_VERSION');
      expect(result.error).toContain('version');
    });

    it('should respect clock skew tolerance', async () => {
      // Create token that expired 30 seconds ago
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:grace',
        agent: 'skew-test-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) - 30, // 30s ago
        nonce: 'skew-test-nonce'
      };

      const token = await request(payload, privateJWK, kid);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      // With 60s clock skew, should still be valid
      const result = await verify(token, mockJWKSServer.url, {
        clockSkew: 60
      });

      expect(result.valid).toBe(true);
    });

    it('should reject if beyond clock skew', async () => {
      // Create token that expired 120 seconds ago
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:henry',
        agent: 'skew-fail-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
        nonce: 'skew-fail-nonce'
      };

      const token = await request(payload, privateJWK, kid);

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      // With 60s clock skew, should be rejected
      const result = await verify(token, mockJWKSServer.url, {
        clockSkew: 60
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('EXPIRED');
    });

    it('should handle malformed token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      global.fetch = async () => {
        return new Response(JSON.stringify({ keys: [publicJWK] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const result = await verify(malformedToken, mockJWKSServer.url);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('Token Decoding (decode)', () => {
    it('should decode a valid token without verification', async () => {
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:decode-test',
        agent: 'decode-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'decode-test-nonce'
      };

      const token = await request(payload, privateJWK, kid);
      const { header, payload: decodedPayload } = decode(token);

      expect(header.alg).toBe('EdDSA');
      expect(header.kid).toBe(kid);
      expect(header.typ).toBe('JWT');
      expect(decodedPayload.user).toBe('did:example:decode-test');
      expect(decodedPayload.agent).toBe('decode-bot');
      expect(decodedPayload.ver).toBe('0.1');
    });

    it('should decode expired token without error', async () => {
      const payload: AgentOAuthPayload = {
        ver: '0.1',
        user: 'did:example:expired-decode',
        agent: 'expired-bot',
        scope: 'read:data',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) - 3600, // expired
        nonce: 'expired-decode-nonce'
      };

      const token = await request(payload, privateJWK, kid);
      const { payload: decodedPayload } = decode(token);

      // decode() doesn't check expiration
      expect(decodedPayload.exp).toBeLessThan(Math.floor(Date.now() / 1000));
    });

    it('should throw on malformed token', () => {
      expect(() => decode('not.a.valid.token')).toThrow(AgentOAuthError);
      expect(() => decode('not.a.valid.token')).toThrow(/Failed to decode/);
    });

    it('should throw on invalid input', () => {
      expect(() => decode('')).toThrow(AgentOAuthError);
      expect(() => decode('invalid')).toThrow(/exactly 3 parts/);
    });

    it('should include error code in thrown error', () => {
      try {
        decode('malformed-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentOAuthError);
        expect((error as AgentOAuthError).code).toBe('DECODE_ERROR');
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw AgentOAuthError with consistent structure', async () => {
      const invalidPayload = {
        ver: '0.1',
        // missing required fields
      } as unknown as AgentOAuthPayload;

      try {
        await request(invalidPayload, privateJWK, kid);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentOAuthError);
        expect((error as AgentOAuthError).code).toBe('INVALID_PAYLOAD');
        expect((error as AgentOAuthError).message).toContain('validation');
        expect((error as AgentOAuthError).toJSON()).toEqual({
          code: 'INVALID_PAYLOAD',
          message: expect.any(String),
          details: expect.any(Object)
        });
      }
    });

    it('should include validation errors in details', async () => {
      const invalidPayload = {
        ver: '0.1',
        user: 'test',
        agent: 'test',
        scope: 'test',
        limit: { amount: -100, currency: 'USD' }, // negative amount
        exp: 123,
        nonce: '12345678'
      } as AgentOAuthPayload;

      try {
        await request(invalidPayload, privateJWK, kid);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentOAuthError);
        expect((error as AgentOAuthError).details).toBeDefined();
      }
    });
  });

  describe('Payload Validation', () => {
    it('should validate nonce minimum length', async () => {
      const payload = {
        ver: '0.1',
        user: 'did:example:test',
        agent: 'test-bot',
        scope: 'pay:merchant',
        limit: { amount: 100, currency: 'USD' },
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: '1234567' // only 7 chars, needs 8+
      } as AgentOAuthPayload;

      await expect(
        request(payload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });

    it('should validate limit amount is non-negative', async () => {
      const payload = {
        ver: '0.1',
        user: 'did:example:test',
        agent: 'test-bot',
        scope: 'pay:merchant',
        limit: { amount: -100, currency: 'USD' }, // negative!
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'valid-nonce-123'
      } as AgentOAuthPayload;

      await expect(
        request(payload, privateJWK, kid)
      ).rejects.toThrow(/Payload validation failed/);
    });

    it('should validate scope pattern', async () => {
      const validScopes = [
        'pay:merchant',
        'read:data',
        'write:calendar',
        'transfer:funds',
        'pay_merchant', // underscore ok
        'data.calendar.read' // dots ok
      ];

      for (const scope of validScopes) {
        const payload: AgentOAuthPayload = {
          ver: '0.1',
          user: 'did:example:test',
          agent: 'test-bot',
          scope,
          limit: { amount: 100, currency: 'USD' },
          exp: Math.floor(Date.now() / 1000) + 3600,
          nonce: 'test-nonce-' + Math.random()
        };

        const token = await request(payload, privateJWK, kid);
        expect(token).toBeTruthy();
      }
    });
  });
});
