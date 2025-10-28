/**
 * Test fixture for a single conformance test
 */
export interface TestFixture {
  /** Unique test identifier */
  id: string;
  /** Test name */
  name: string;
  /** Test description */
  description: string;
  /** Test category */
  category: 'valid' | 'invalid-signature' | 'expired' | 'audience' | 'revoked' | 'replay';
  /** JWT token to test */
  token: string;
  /** Expected audience (for audience tests) */
  audience?: string;
  /** Expected verification result */
  expectedResult: {
    valid: boolean;
    payload?: any;
    error?: string;
    code?: string;
  };
  /** JTI for revocation tests */
  jti?: string;
}

/**
 * Result of executing a single test
 */
export interface TestResult {
  /** Test identifier */
  id: string;
  /** Whether the test passed */
  passed: boolean;
  /** Error message if test failed */
  error?: string;
  /** Test execution duration in milliseconds */
  duration: number;
  /** Actual result from API (for debugging) */
  actual?: any;
}

/**
 * Overall conformance test results
 */
export interface ConformanceResult {
  /** Target API base URL */
  target: string;
  /** Test execution timestamp */
  timestamp: string;
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  /** Individual test results */
  results: TestResult[];
}

/**
 * Cross-language test vector for JSON canonicalization
 */
export interface TestVector {
  /** Vector name */
  name: string;
  /** Vector description */
  description: string;
  /** Input object to canonicalize */
  input: any;
  /** Expected canonicalized JSON string */
  canonicalized: string;
  /** Expected base64url-encoded string */
  base64url: string;
  /** Expected signature base (header.payload) */
  signatureBase: string;
}

/**
 * Test category definition
 */
export interface TestCategory {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Array of tests in this category */
  tests: Omit<TestFixture, 'id' | 'category'>[];
}
