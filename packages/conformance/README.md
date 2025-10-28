# @agentoauth/conformance

Comprehensive conformance test suite for AgentOAuth implementations.

## Overview

This package provides a complete test framework to validate AgentOAuth protocol implementations against the official specification. It includes test fixtures for all scenarios, cross-language test vectors, and automated badge generation.

## Features

- 🧪 **Comprehensive Test Coverage** - 20+ test cases covering all error scenarios
- 🌐 **Cross-Language Support** - JSON canonicalization test vectors for any language
- 📊 **Automated Reporting** - Generates badges and detailed conformance reports
- 🔄 **CI/CD Integration** - Ready for automated testing pipelines
- 📋 **OpenAPI Compliant** - Tests against formal API specification

## Installation

```bash
cd packages/conformance
pnpm install
pnpm build
```

## Usage

### Test Against Local API

```bash
pnpm test:local
```

This will test against `http://localhost:3000` by default.

### Test Against Remote Deployment

```bash
BASE_URL=https://your-api.example.com pnpm test:remote
```

### Programmatic Usage

```typescript
import { ConformanceRunner } from '@agentoauth/conformance';

const runner = new ConformanceRunner('https://api.example.com');
const result = await runner.run();

console.log(`Pass rate: ${result.summary.passRate}%`);
```

## Test Categories

### 📋 Valid Tokens
- **basic-valid-token**: Standard v0.2 token with all required fields
- **with-audience**: Token with audience field verification
- **v01-token-legacy**: Backward compatibility with v0.1 tokens
- **minimal-valid-scope**: Minimal scope format validation
- **complex-scope-format**: Complex scope with special characters

### ❌ Invalid Signatures  
- **tampered-payload**: Modified payload with original signature
- **wrong-key-signature**: Token signed with different key
- **corrupted-signature**: Signature with corrupted bytes
- **missing-signature**: Token without signature part

### ⏰ Expired Tokens
- **clearly-expired-token**: Token expired 1 hour ago
- **epoch-zero-expired**: Token expired at Unix epoch
- **recently-expired**: Recently expired (clock skew test)
- **v01-expired-token**: Expired legacy token

### 👥 Audience Mismatch
- **audience-mismatch**: Different audience than expected
- **missing-audience-field**: No audience when required
- **empty-audience-field**: Empty audience string
- **case-sensitive-audience**: Case sensitivity validation

### 🚫 Revocation Tests
- **basic-revoke-test**: Token revocation workflow
- **revoke-with-audience**: Revoked token with audience
- **revoke-high-value-token**: High-value token revocation

### 🔄 Replay Attack Detection
- **basic-replay-test**: Second use detection
- **replay-with-audience**: Replay with audience field
- **replay-payment-token**: Financial transaction replay
- **unique-nonce-replay**: JTI-based replay protection

## Test Vectors

The conformance suite includes cross-language test vectors for JSON canonicalization:

```bash
# Validate your canonicalization implementation
node -e "
import { validateCanonicalization } from './dist/vectors.js';
import vectors from './fixtures/test-vectors.json';
validateCanonicalization(vectors.vectors);
"
```

### Vector Categories

- **basic-payload**: Standard v0.2 payload
- **minimal-payload-v02**: Minimal required fields
- **legacy-payload-v01**: v0.1 compatibility
- **complex-scope-payload**: Enterprise scope patterns
- **unicode-content-payload**: Internationalization

## Output Files

After running tests, the following files are generated:

### conformance.json
```json
{
  "target": "http://localhost:3000",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "summary": {
    "total": 23,
    "passed": 23,
    "failed": 0,
    "passRate": 100
  },
  "results": [...]
}
```

### CONFORMANCE.md
Markdown report with badge, summary, and failed test details.

## Badge Integration

Add to your README:

```markdown
![Conformance](https://img.shields.io/badge/conformance-100%25-brightgreen)
```

Colors:
- **Green (90%+)**: `brightgreen`
- **Yellow (75-89%)**: `yellow` 
- **Red (<75%)**: `red`

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Conformance Tests
  run: |
    cd packages/verifier-api
    pnpm gen-key
    pnpm dev &
    API_PID=$!
    
    sleep 5
    
    cd ../conformance
    pnpm test:conformance
    
    kill $API_PID

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: conformance-results
    path: packages/conformance/conformance.json
```

## Adding Custom Tests

Create new test fixtures in `fixtures/<category>.json`:

```json
{
  "description": "Your test category description",
  "tests": [
    {
      "name": "your-test-name",
      "description": "What this test validates",
      "token": "eyJ...",
      "audience": "optional-audience",
      "jti": "optional-jti-for-revoke-tests",
      "expectedResult": {
        "valid": false,
        "code": "EXPECTED_ERROR_CODE"
      }
    }
  ]
}
```

## Cross-Language Implementation

Use test vectors to validate your implementation in any language:

### Python Example
```python
import json
import base64

def canonicalize_json(obj):
    return json.dumps(obj, separators=(',', ':'), sort_keys=True)

def base64url_encode(data):
    return base64.urlsafe_b64encode(data.encode('utf-8')).decode('ascii').rstrip('=')

# Test against vectors
with open('fixtures/test-vectors.json') as f:
    vectors = json.load(f)['vectors']
    
for vector in vectors:
    canonical = canonicalize_json(vector['input'])
    assert canonical == vector['canonicalized']
    
    encoded = base64url_encode(canonical)
    assert encoded == vector['base64url']
```

## API Reference

### ConformanceRunner

```typescript
class ConformanceRunner {
  constructor(baseUrl?: string)
  async run(): Promise<ConformanceResult>
}
```

### Functions

```typescript
function executeTest(fixture: TestFixture, baseUrl: string): Promise<TestResult>
function generateBadge(result: ConformanceResult): Promise<void>
function validateCanonicalization(vectors: TestVector[]): boolean
function generateTestVector(name: string, description: string, input: any): TestVector
```

## Requirements

- **Node.js**: 18+
- **Running verifier-api**: Required for local testing
- **Network access**: Required for remote testing

## Troubleshooting

### Common Issues

**"Failed to connect"**: Ensure verifier-api is running on the specified port.

**"Keys not initialized"**: Run `pnpm gen-key` in verifier-api directory.

**"Test fixtures not found"**: Ensure you're running from the correct directory.

**"Canonicalization mismatch"**: Check your JSON key sorting implementation.

### Debug Mode

```bash
DEBUG=1 pnpm test:local
```

## Contributing

1. Add new test fixtures for edge cases
2. Update test vectors for new payload formats
3. Enhance error reporting and documentation
4. Submit PRs with comprehensive test coverage

## License

MIT AND Apache-2.0

---

**✅ Ready to validate your AgentOAuth implementation? Run the conformance tests!**
