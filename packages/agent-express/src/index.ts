import { Request, Response, NextFunction } from 'express';
import { issueConsent, buildPolicy } from '@agentoauth/sdk';

export interface AgentAuthOptions {
  user: string;
  agent: string;
  privateKey?: any;
  keyId?: string;
  defaultPolicy?: any;
  onTokenCreated?: (token: string, req: Request) => void;
}

/**
 * Middleware that automatically signs requests with AgentOAuth tokens
 */
export function signRequests(options: AgentAuthOptions) {
  return async (req: Request & { agentoauth?: any }, res: Response, next: NextFunction) => {
    try {
      // Extract or build policy from request
      const policy = req.body?.policy || options.defaultPolicy || buildPolicy({
        preset: 'payment',
        audience: req.headers['x-merchant-id'] as string
      });
      
      // Issue consent token
      const { token, keyId } = await issueConsent({
        user: options.user,
        agent: options.agent,
        scope: policy.scope,
        limit: policy.limit,
        audience: policy.aud,
        privateKey: options.privateKey,
        keyId: options.keyId
      });
      
      // Add to request headers
      req.headers['authorization'] = `Bearer ${token}`;
      req.agentoauth = { token, keyId, policy };
      
      // Optional callback
      options.onTokenCreated?.(token, req);
      
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to sign request',
        code: 'AGENT_AUTH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Middleware for manual token attachment
 */
export function attachToken(getTokenFn: (req: Request) => Promise<string>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = await getTokenFn(req);
      req.headers['authorization'] = `Bearer ${token}`;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to attach token',
        code: 'TOKEN_ATTACHMENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Pre-configured middleware for different use cases
 */
export class AgentAuth {
  /**
   * Payment agent middleware
   */
  static payment(options: Omit<AgentAuthOptions, 'defaultPolicy'> & { maxAmount?: number }) {
    return signRequests({
      ...options,
      defaultPolicy: buildPolicy({
        preset: 'payment',
        limits: { amount: options.maxAmount || 1000, currency: 'USD' }
      })
    });
  }
  
  /**
   * Read-only agent middleware
   */
  static readOnly(options: Omit<AgentAuthOptions, 'defaultPolicy'>) {
    return signRequests({
      ...options,
      defaultPolicy: buildPolicy({
        preset: 'read'
      })
    });
  }
  
  /**
   * Admin agent middleware
   */
  static admin(options: Omit<AgentAuthOptions, 'defaultPolicy'>) {
    return signRequests({
      ...options,
      defaultPolicy: buildPolicy({
        preset: 'admin'
      })
    });
  }
}

/**
 * Express request augmentation
 */
declare global {
  namespace Express {
    interface Request {
      agentoauth?: {
        token: string;
        keyId: string;
        policy: any;
      };
    }
  }
}
