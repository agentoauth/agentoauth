import { TestFixture, TestResult } from './types.js';

export async function executeTest(fixture: TestFixture, baseUrl: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Execute based on test type
    switch (fixture.category) {
      case 'valid':
      case 'invalid-signature':
      case 'expired':
      case 'audience':
        return await executeVerifyTest(fixture, baseUrl, startTime);
        
      case 'revoked':
        return await executeRevokeTest(fixture, baseUrl, startTime);
        
      case 'replay':
        return await executeReplayTest(fixture, baseUrl, startTime);
        
      default:
        throw new Error(`Unknown test category: ${fixture.category}`);
    }
  } catch (error) {
    return {
      id: fixture.id,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

async function executeVerifyTest(fixture: TestFixture, baseUrl: string, startTime: number): Promise<TestResult> {
  const response = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: fixture.token,
      audience: fixture.audience
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Validate against expected result
  const passed = validateResult(result, fixture.expectedResult);
  
  return {
    id: fixture.id,
    passed,
    error: passed ? undefined : `Expected ${JSON.stringify(fixture.expectedResult)}, got ${JSON.stringify(result)}`,
    duration: Date.now() - startTime,
    actual: result
  };
}

async function executeRevokeTest(fixture: TestFixture, baseUrl: string, startTime: number): Promise<TestResult> {
  if (!fixture.jti) {
    throw new Error('Revoke test requires jti field');
  }
  
  // First verify the token works
  const verifyResponse = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: fixture.token })
  });
  
  const verifyResult = await verifyResponse.json();
  
  if (!verifyResult.valid) {
    throw new Error(`Token should be valid before revocation: ${verifyResult.error}`);
  }
  
  // Revoke the token
  const revokeResponse = await fetch(`${baseUrl}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jti: fixture.jti })
  });
  
  if (!revokeResponse.ok) {
    throw new Error(`Revoke request failed: HTTP ${revokeResponse.status}`);
  }
  
  // Verify it's now revoked
  const verifyAfterResponse = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: fixture.token })
  });
  
  const verifyAfterResult = await verifyAfterResponse.json();
  
  // Validate against expected result
  const passed = validateResult(verifyAfterResult, fixture.expectedResult);
  
  return {
    id: fixture.id,
    passed,
    error: passed ? undefined : `Expected ${JSON.stringify(fixture.expectedResult)}, got ${JSON.stringify(verifyAfterResult)}`,
    duration: Date.now() - startTime,
    actual: verifyAfterResult
  };
}

async function executeReplayTest(fixture: TestFixture, baseUrl: string, startTime: number): Promise<TestResult> {
  // First use of the token should work
  const firstResponse = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: fixture.token })
  });
  
  const firstResult = await firstResponse.json();
  
  if (!firstResult.valid) {
    throw new Error(`First token use should be valid: ${firstResult.error}`);
  }
  
  // Second use should be detected as replay
  const secondResponse = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: fixture.token })
  });
  
  const secondResult = await secondResponse.json();
  
  // Validate against expected result (should be REPLAY)
  const passed = validateResult(secondResult, fixture.expectedResult);
  
  return {
    id: fixture.id,
    passed,
    error: passed ? undefined : `Expected ${JSON.stringify(fixture.expectedResult)}, got ${JSON.stringify(secondResult)}`,
    duration: Date.now() - startTime,
    actual: secondResult
  };
}

/**
 * Validates actual result against expected result
 */
function validateResult(actual: any, expected: any): boolean {
  // Check valid flag
  if (actual.valid !== expected.valid) {
    return false;
  }
  
  // If invalid, check error code
  if (!expected.valid && expected.code) {
    if (actual.code !== expected.code) {
      return false;
    }
  }
  
  // If valid, check payload fields if specified
  if (expected.valid && expected.payload) {
    for (const [key, value] of Object.entries(expected.payload)) {
      if (actual.payload?.[key] !== value) {
        return false;
      }
    }
  }
  
  return true;
}
