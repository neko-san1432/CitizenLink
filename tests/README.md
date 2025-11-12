# Authentication Testing Suite

This directory contains comprehensive tests for the authentication system as recommended in `AUTHENTICATION_REVIEW.md`.

## Test Structure

```
tests/
├── setup/              # Jest configuration and test setup
├── utils/              # Test utilities and helpers
├── security/           # Security tests
│   ├── authentication-bypass.test.js
│   ├── rate-limiting.test.js
│   ├── csrf-protection.test.js
│   └── session-hijacking.test.js
└── functional/         # Functional tests
    ├── login-flow.test.js
    ├── password-reset.test.js
    └── session-management.test.js
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Security tests
npm test -- tests/security

# Functional tests
npm test -- tests/functional

# Specific test file
npm test -- tests/security/rate-limiting.test.js
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Test Categories

### Security Tests

#### Authentication Bypass Protection
- Tests for missing tokens
- Invalid token formats
- Token manipulation attempts
- SQL injection and XSS in tokens
- Token validation

#### Rate Limiting
- Request limit enforcement
- Time window reset
- Per-IP tracking
- Concurrent request handling
- Rate limit headers
- Different limiters for different endpoints

#### CSRF Protection
- Safe method bypass (GET, HEAD, OPTIONS)
- Unsafe method protection (POST, PUT, DELETE, PATCH)
- Token validation
- Token generation
- Token replay prevention
- Token extraction priority

#### Session Hijacking Prevention
- HttpOnly cookie protection
- Secure cookie flags
- SameSite protection
- Token validation
- Session fixation prevention
- Concurrent sessions
- Cookie path restrictions

### Functional Tests

#### Login Flow
- Valid credentials
- Invalid credentials
- Account status checks (unverified, banned)
- Input validation and sanitization
- Rate limiting integration
- Session creation
- Error handling

#### Password Reset
- Request password reset
- Email enumeration prevention
- Token validation
- Password strength validation
- Token reuse prevention
- Rate limiting

#### Session Management
- Session creation
- Session validation
- Session refresh
- Session invalidation
- Concurrent sessions
- Session tracking
- Session expiration

## Test Utilities

### testHelpers.js
Provides utilities for creating mock requests, responses, and test data:
- `createTestUser()` - Generate test user objects
- `generateMockToken()` - Create mock JWT tokens
- `createMockRequest()` - Create mock Express requests
- `createMockResponse()` - Create mock Express responses
- `createMockNext()` - Create mock next() functions
- `wait()` - Async wait utility
- `makeConcurrentRequests()` - Test concurrent requests

### supabaseMock.js
Mock Supabase client for testing:
- Mock auth methods (signUp, signIn, getUser, etc.)
- Mock database operations
- In-memory storage for testing

## Writing New Tests

### Test Structure
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Specific Scenario', () => {
    it('should do something', async () => {
      // Test implementation
    });
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (Supabase, database)
3. **Cleanup**: Reset mocks and state after each test
4. **Descriptive Names**: Use clear test descriptions
5. **Assertions**: Test both success and failure cases
6. **Edge Cases**: Test boundary conditions and error cases

## Environment Variables

Tests use the following environment variables (set in `testSetup.js`):
- `NODE_ENV=test`
- `SUPABASE_URL` (optional, defaults to test URL)
- `SUPABASE_ANON_KEY` (optional, defaults to test key)
- `SUPABASE_SERVICE_ROLE_KEY` (optional, defaults to test key)
- `CSRF_SECRET` (optional, defaults to test secret)

## Coverage Goals

- **Security Tests**: 100% coverage of security-critical paths
- **Functional Tests**: 90%+ coverage of authentication flows
- **Integration Tests**: Critical paths and edge cases

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- Fast execution (< 30 seconds)
- No external dependencies required
- Deterministic results
- Clear error messages

## Troubleshooting

### Tests Failing
1. Check that all mocks are properly reset
2. Verify environment variables are set
3. Check for timing issues (use `wait()` utility)
4. Ensure test isolation

### Mock Issues
1. Verify mock implementations match real API
2. Check mock return values
3. Ensure mocks are called correctly

### Coverage Issues
1. Run coverage report: `npm run test:coverage`
2. Check uncovered lines in HTML report
3. Add tests for missing coverage

## Related Documentation

- `AUTHENTICATION_REVIEW.md` - Security review and recommendations
- `SECURITY.md` - Security documentation
- `README.md` - Project documentation


