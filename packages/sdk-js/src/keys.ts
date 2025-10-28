import { readFile, access } from 'fs/promises';
import { importJWK } from 'jose';

/**
 * Auto-detect and load keys from multiple sources
 */
export async function loadKeys(options: {
  privateKey?: string | object;
  publicKey?: string | object;
  keyFile?: string;
  jwksUrl?: string;
} = {}): Promise<{ privateKey?: any; publicKey?: any; jwks?: any }> {
  // 1. Direct key objects
  if (options.privateKey && options.publicKey) {
    return {
      privateKey: typeof options.privateKey === 'string' 
        ? await importJWK(JSON.parse(options.privateKey))
        : await importJWK(options.privateKey as any),
      publicKey: typeof options.publicKey === 'string'
        ? await importJWK(JSON.parse(options.publicKey))
        : await importJWK(options.publicKey as any)
    };
  }
  
  // 2. Environment variables
  if (process.env.AGENTOAUTH_PRIVATE_KEY && process.env.AGENTOAUTH_PUBLIC_KEY) {
    return {
      privateKey: await importJWK(JSON.parse(process.env.AGENTOAUTH_PRIVATE_KEY)),
      publicKey: await importJWK(JSON.parse(process.env.AGENTOAUTH_PUBLIC_KEY))
    };
  }
  
  // 3. File-based auto-detection
  const possiblePaths = [
    'keys/private.jwk',
    'keys/public.jwk',
    '.agentoauth/private.jwk',
    '.agentoauth/public.jwk',
    options.keyFile
  ].filter(Boolean) as string[];
  
  for (const path of possiblePaths) {
    try {
      await access(path);
      const keyData = JSON.parse(await readFile(path, 'utf-8'));
      
      if (keyData.kty) {
        // Single key file
        return keyData.d 
          ? { privateKey: await importJWK(keyData) }
          : { publicKey: await importJWK(keyData) };
      } else if (keyData.keys) {
        // JWKS format
        return { jwks: keyData };
      }
    } catch {
      // Continue to next path
    }
  }
  
  // 4. JWKS URL
  if (options.jwksUrl) {
    const response = await fetch(options.jwksUrl);
    const jwks = await response.json();
    return { jwks };
  }
  
  throw new Error('No keys found. Provide keys via options, environment variables, or key files.');
}

/**
 * Save keys to files
 */
export async function saveKeys(options: {
  privateKey?: any;
  publicKey?: any;
  jwks?: any;
  directory?: string;
}) {
  const { writeFile, mkdir } = await import('fs/promises');
  const dir = options.directory || 'keys';
  
  // Ensure directory exists
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
  
  if (options.privateKey) {
    await writeFile(`${dir}/private.jwk`, JSON.stringify(options.privateKey, null, 2));
  }
  
  if (options.publicKey) {
    await writeFile(`${dir}/public.jwk`, JSON.stringify(options.publicKey, null, 2));
  }
  
  if (options.jwks) {
    await writeFile(`${dir}/jwks.json`, JSON.stringify(options.jwks, null, 2));
  }
}

/**
 * Load key from environment variable or file
 */
export async function loadKey(source: string): Promise<any> {
  // Try as environment variable first
  if (process.env[source]) {
    return await importJWK(JSON.parse(process.env[source]));
  }
  
  // Try as file path
  try {
    const keyData = JSON.parse(await readFile(source, 'utf-8'));
    return await importJWK(keyData);
  } catch (error) {
    throw new Error(`Failed to load key from ${source}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Auto-detect private key from common sources
 */
export async function loadPrivateKey(): Promise<any> {
  const sources = [
    () => process.env.AGENTOAUTH_PRIVATE_KEY ? JSON.parse(process.env.AGENTOAUTH_PRIVATE_KEY) : null,
    () => process.env.PRIVATE_KEY ? JSON.parse(process.env.PRIVATE_KEY) : null,
    async () => {
      try {
        return JSON.parse(await readFile('keys/private.jwk', 'utf-8'));
      } catch {
        return null;
      }
    },
    async () => {
      try {
        return JSON.parse(await readFile('.agentoauth/private.jwk', 'utf-8'));
      } catch {
        return null;
      }
    }
  ];
  
  for (const source of sources) {
    try {
      const keyData = await source();
      if (keyData) {
        return await importJWK(keyData);
      }
    } catch {
      // Continue to next source
    }
  }
  
  throw new Error('No private key found. Set AGENTOAUTH_PRIVATE_KEY environment variable or create keys/private.jwk file.');
}

/**
 * Auto-detect public key from common sources
 */
export async function loadPublicKey(): Promise<any> {
  const sources = [
    () => process.env.AGENTOAUTH_PUBLIC_KEY ? JSON.parse(process.env.AGENTOAUTH_PUBLIC_KEY) : null,
    () => process.env.PUBLIC_KEY ? JSON.parse(process.env.PUBLIC_KEY) : null,
    async () => {
      try {
        return JSON.parse(await readFile('keys/public.jwk', 'utf-8'));
      } catch {
        return null;
      }
    },
    async () => {
      try {
        return JSON.parse(await readFile('.agentoauth/public.jwk', 'utf-8'));
      } catch {
        return null;
      }
    }
  ];
  
  for (const source of sources) {
    try {
      const keyData = await source();
      if (keyData) {
        return await importJWK(keyData);
      }
    } catch {
      // Continue to next source
    }
  }
  
  throw new Error('No public key found. Set AGENTOAUTH_PUBLIC_KEY environment variable or create keys/public.jwk file.');
}
