/**
 * In-memory storage implementation for budget tracking
 */

import type { PolicyStorage } from '../policy/engine.js';

/**
 * Simple in-memory storage
 * Note: Not suitable for production - use Redis instead
 */
export class MemoryStorage implements PolicyStorage {
  private storage: Map<string, number> = new Map();
  
  getBudget(key: string): number | null {
    return this.storage.get(key) || null;
  }
  
  incrementBudget(key: string, amount: number): void {
    const current = this.storage.get(key) || 0;
    this.storage.set(key, current + amount);
  }
  
  clear(): void {
    this.storage.clear();
  }
  
  size(): number {
    return this.storage.size;
  }
}

