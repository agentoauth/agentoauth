/**
 * Minimal JWT decode for Cloudflare Workers
 * 
 * This is a simplified version that doesn't use ajv (which requires Function() constructor)
 * Only decodes the payload without validation
 */

export function decode(token: string): { header: any; payload: any; signature: string } {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format: must have 3 parts separated by dots');
  }

  const [headerB64, payloadB64, signature] = parts;

  try {
    // Decode base64url
    const base64urlDecode = (str: string): string => {
      // Convert base64url to base64
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      // Decode base64
      return atob(base64);
    };

    const headerJson = base64urlDecode(headerB64);
    const payloadJson = base64urlDecode(payloadB64);

    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    return { header, payload, signature };
  } catch (error) {
    throw new Error(`Failed to decode token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

