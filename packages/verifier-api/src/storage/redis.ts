/**
 * Redis storage implementation for budget tracking
 * 
 * Requires redis or @redis/client package
 */

import type { PolicyStorage } from '../policy/engine.js';

export interface RedisConfig {
  url: string;
}

/**
 * Redis-based storage for production use
 */
export class RedisStorage implements PolicyStorage {
  private client: any; // RedisClient type
  private initialized = false;
  
  constructor(private config: RedisConfig) {}
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Try to import Redis client
      const { createClient } = await import('redis');
      this.client = createClient({ url: this.config.url });
      await this.client.connect();
      this.initialized = true;
      console.log('✅ Redis storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Redis storage:', error);
      throw new Error('Redis storage initialization failed. Install: pnpm add redis');
    }
  }
  
  async getBudget(key: string): Promise<number | null> {
    await this.initialize();
    
    try {
      const value = await this.client.get(key);
      return value ? parseFloat(value) : null;
    } catch (error) {
      console.error('Redis getBudget error:', error);
      return null;
    }
  }
  
  async incrementBudget(key: string, amount: number): Promise<void> {
    await this.initialize();
    
    try {
      await this.client.incrByFloat(key, amount);
      // Set expiration to cleanup old budget keys (7 days)
      await this.client.expire(key, 7 * 24 * 60 * 60);
    } catch (error) {
      console.error('Redis incrementBudget error:', error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    if (this.client && this.initialized) {
      await this.client.quit();
      this.initialized = false;
    }
  }
}

/**
 * Factory function to create storage
 */
export function createStorage(url?: string): PolicyStorage {
  if (url) {
    return new RedisStorage({ url });
  } else {
    return new (require('./memory.js').MemoryStorage)();
  }
}

