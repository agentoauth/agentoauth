import { Request, Response, NextFunction } from 'express';
import { verifyConsent, hasScope } from '@agentoauth/sdk';

export interface MerchantAuthOptions {
  jwksUrl?: string;
  publicKey?: any;
  audience?: string;
  required?: boolean;
  onAuthSuccess?: (payload: any, req: Request) => void;
  onAuthFailure?: (error: any, req: Request) => void;
}

declare global {
  namespace Express {
    interface Request {
      agentoauth?: {
        valid: boolean;
        payload?: any;
        token?: string;
        error?: any;
      };
    }
  }
}

/**
 * Middleware that requires valid AgentOAuth token
 */
export function requireAuth(options: MerchantAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authResult = await extractAndVerify(req, options);
    
    if (!authResult.valid) {
      const error = authResult.error || { code: 'MISSING_TOKEN', message: 'No authorization token provided' };
      
      options.onAuthFailure?.(error, req);
      
      return res.status(401).json({
        error: error.message,
        code: error.code,
        suggestion: error.suggestion
      });
    }
    
    req.agentoauth = authResult;
    options.onAuthSuccess?.(authResult.payload, req);
    next();
  };
}

/**
 * Middleware that parses auth but doesn't require it
 */
export function parseAuth(options: MerchantAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    req.agentoauth = await extractAndVerify(req, options);
    next();
  };
}

/**
 * Scope-specific middleware
 */
export function requireScope(scope: string, options: MerchantAuthOptions = {}) {
  return [
    requireAuth(options),
    (req: Request, res: Response, next: NextFunction) => {
      const payload = req.agentoauth?.payload;
      
      if (!payload || !hasScope(payload.scope, scope)) {
        return res.status(403).json({
          error: `Required scope '${scope}' not found`,
          code: 'INSUFFICIENT_SCOPE',
          suggestion: 'Request a token with the required scope',
          requiredScope: scope,
          actualScope: payload?.scope
        });
      }
      
      next();
    }
  ];
}

/**
 * Amount limit middleware
 */
export function requireAmountLimit(maxAmount: number, options: MerchantAuthOptions = {}) {
  return [
    requireAuth(options),
    (req: Request, res: Response, next: NextFunction) => {
      const payload = req.agentoauth?.payload;
      const requestAmount = req.body?.amount || 0;
      
      if (!payload) {
        return res.status(401).json({
          error: 'No valid token found',
          code: 'MISSING_TOKEN'
        });
      }
      
      if (requestAmount > payload.limit?.amount) {
        return res.status(403).json({
          error: 'Amount exceeds authorization limit',
          code: 'AMOUNT_EXCEEDED',
          suggestion: 'Request a token with a higher limit or reduce the amount',
          limit: payload.limit?.amount,
          requested: requestAmount
        });
      }
      
      if (requestAmount > maxAmount) {
        return res.status(403).json({
          error: 'Amount exceeds merchant maximum',
          code: 'MERCHANT_LIMIT_EXCEEDED',
          suggestion: 'Reduce the requested amount',
          merchantLimit: maxAmount,
          requested: requestAmount
        });
      }
      
      next();
    }
  ];
}

/**
 * Pre-configured middleware for different use cases
 */
export class MerchantAuth {
  /**
   * Payment processing middleware
   */
  static payment(options: MerchantAuthOptions & { maxAmount?: number } = {}) {
    const { maxAmount = 10000, ...authOptions } = options;
    
    return [
      requireScope('pay:merchant', authOptions),
      requireAmountLimit(maxAmount, authOptions)
    ];
  }
  
  /**
   * Read-only API middleware
   */
  static readOnly(options: MerchantAuthOptions = {}) {
    return requireScope('read:data', options);
  }
  
  /**
   * Admin API middleware
   */
  static admin(options: MerchantAuthOptions = {}) {
    return requireScope('admin:manage', options);
  }
}

/**
 * Extract and verify token from request
 */
async function extractAndVerify(req: Request, options: MerchantAuthOptions) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: { code: 'MISSING_TOKEN', message: 'No Bearer token provided' }
    };
  }
  
  const token = authHeader.slice(7);
  
  const result = await verifyConsent(token, {
    audience: options.audience,
    jwksUrl: options.jwksUrl,
    publicKey: options.publicKey
  });
  
  return {
    valid: result.valid,
    payload: result.payload,
    token,
    error: result.error
  };
}

/**
 * Utility to extract user info from authenticated request
 */
export function getUser(req: Request): { user?: string; agent?: string; jti?: string } {
  const payload = req.agentoauth?.payload;
  
  if (!payload) {
    return {};
  }
  
  return {
    user: payload.user,
    agent: payload.agent,
    jti: payload.jti
  };
}

/**
 * Utility to check if request has specific scope
 */
export function hasRequestScope(req: Request, scope: string): boolean {
  const payload = req.agentoauth?.payload;
  
  if (!payload || !payload.scope) {
    return false;
  }
  
  return hasScope(payload.scope, scope);
}

/**
 * Utility to get token limits
 */
export function getTokenLimits(req: Request): { amount?: number; currency?: string } {
  const payload = req.agentoauth?.payload;
  
  return payload?.limit || {};
}
