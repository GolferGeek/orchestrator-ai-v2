# Test Requirements: Authentication Guards

**Component:** JWT Auth Guard & Roles Guard
**Files:**
- `/apps/api/src/auth/guards/jwt-auth.guard.ts`
- `/apps/api/src/auth/guards/roles.guard.ts`

**Priority:** CRITICAL
**Target Coverage:**
- Lines: 90%+
- Branches: 85%+
- Functions: 90%+
- Critical Security Paths: 100%

---

## JWT Auth Guard Test Requirements

### Test File Location
`/apps/api/src/auth/guards/jwt-auth.guard.spec.ts`

### Required Test Suites

#### 1. Token Extraction Tests

**Purpose:** Verify token extraction is secure and handles edge cases

```typescript
describe('Token Extraction', () => {
  describe('Bearer Token Extraction', () => {
    it('should extract valid bearer token from Authorization header')
    it('should return null when Authorization header is missing')
    it('should return null when Authorization header does not start with "Bearer "')
    it('should return null for empty token after "Bearer "')
    it('should trim whitespace from extracted token')
    it('should reject malformed bearer tokens with multiple spaces')
    it('should reject bearer tokens with embedded null bytes')
    it('should reject bearer tokens exceeding maximum length (DoS protection)')
    it('should reject bearer tokens with special control characters')
    it('should handle case-sensitive "Bearer" prefix correctly')
  });

  describe('Query Token Extraction', () => {
    it('should extract token from query.token parameter')
    it('should extract token from query.streamToken parameter')
    it('should prefer query.token over query.streamToken when both present')
    it('should return null when no query parameters present')
    it('should handle empty query token strings')
    it('should handle array query parameters correctly')
    it('should trim whitespace from query tokens')
    it('should reject query tokens exceeding maximum length')
  });
});
```

#### 2. Token Validation Tests

**Purpose:** Verify JWT validation is secure

```typescript
describe('Token Validation', () => {
  describe('Valid JWT Tokens', () => {
    it('should validate and accept valid JWT from Authorization header')
    it('should validate and accept valid JWT from query parameter')
    it('should extract user information from valid token')
    it('should set request.user with validated user data')
    it('should handle JWT with all user fields present')
    it('should handle JWT with minimal user fields')
  });

  describe('Invalid JWT Tokens', () => {
    it('should reject expired JWT tokens')
    it('should reject JWT tokens with invalid signature')
    it('should reject malformed JWT tokens')
    it('should reject JWT tokens with missing required claims')
    it('should reject JWT tokens with future nbf (not before) claim')
    it('should reject JWT tokens with invalid issuer')
    it('should throw UnauthorizedException for invalid tokens')
  });

  describe('Token Edge Cases', () => {
    it('should handle JWT tokens at exact expiration boundary')
    it('should handle JWT tokens with extra whitespace')
    it('should reject JWT tokens with SQL injection attempts')
    it('should reject JWT tokens with XSS payloads')
    it('should handle very long but valid JWT tokens')
  });
});
```

#### 3. API Key Authentication Tests

**Purpose:** Verify test API key auth is secure

```typescript
describe('API Key Authentication', () => {
  describe('Valid API Key', () => {
    it('should authenticate with valid x-test-api-key header')
    it('should create user object with configured test user ID')
    it('should set correct user metadata for API key auth')
    it('should use environment variables for test user configuration')
  });

  describe('Invalid API Key', () => {
    it('should reject invalid API key')
    it('should reject empty API key')
    it('should reject API key with wrong format')
    it('should be resistant to timing attacks')
  });

  describe('API Key Security', () => {
    it('should not log API keys in error messages')
    it('should create audit trail for API key usage')
    it('should rate limit failed API key attempts')
    it('should be disabled when TEST_API_SECRET_KEY not configured')
    it('should reject API key in production environment')
  });

  describe('API Key Priority', () => {
    it('should check API key before JWT validation')
    it('should not fallback to JWT when API key present but invalid')
  });
});
```

#### 4. Stream Token Tests

**Purpose:** Verify stream token handling is secure

```typescript
describe('Stream Token Authentication', () => {
  describe('Valid Stream Tokens', () => {
    it('should validate stream token from query parameter')
    it('should set streamTokenClaims in request')
    it('should strip token from URL and set sanitizedUrl')
    it('should extract user from stream token claims')
  });

  describe('Stream Token Fallback', () => {
    it('should try JWT validation before stream token')
    it('should fallback to stream token when JWT validation fails')
    it('should prefer bearer token over query stream token')
    it('should handle backward compatibility with old stream tokens')
  });

  describe('Stream Token Errors', () => {
    it('should reject invalid stream tokens')
    it('should reject expired stream tokens')
    it('should reject stream tokens with invalid signature')
    it('should throw UnauthorizedException when all auth methods fail')
  });
});
```

#### 5. Public Endpoint Tests

**Purpose:** Verify @Public decorator bypasses authentication

```typescript
describe('Public Endpoints', () => {
  it('should allow access to endpoints marked with @Public')
  it('should not require authentication for public routes')
  it('should respect class-level @Public decorator')
  it('should respect method-level @Public decorator')
  it('should allow method decorator to override class decorator')
});
```

#### 6. Error Handling Tests

**Purpose:** Verify errors don't leak information

```typescript
describe('Error Handling', () => {
  describe('Error Messages', () => {
    it('should return generic error messages to clients')
    it('should not include token values in error messages')
    it('should not leak authentication method details')
    it('should log detailed errors server-side only')
  });

  describe('Authentication Errors', () => {
    it('should throw UnauthorizedException when no auth provided')
    it('should throw UnauthorizedException for invalid tokens')
    it('should handle Supabase service errors gracefully')
    it('should handle network errors during validation')
  });

  describe('Logging Security', () => {
    it('should log authentication attempts without sensitive data')
    it('should log authentication source (header vs query)')
    it('should not log full token values')
  });
});
```

#### 7. Integration Tests

**Purpose:** Verify guard works in full request context

```typescript
describe('Integration Tests', () => {
  it('should work with NestJS execution context')
  it('should integrate with Reflector for metadata')
  it('should work with multiple authentication methods in sequence')
  it('should handle concurrent authentication requests')
  it('should integrate with SupabaseService correctly')
  it('should integrate with StreamTokenService correctly')
});
```

---

## Roles Guard Test Requirements

### Test File Location
`/apps/api/src/auth/guards/roles.guard.spec.ts`

### Required Test Suites

#### 1. Role Authorization Tests

**Purpose:** Verify role-based access control

```typescript
describe('Role Authorization', () => {
  describe('Single Role Requirements', () => {
    it('should grant access when user has required role')
    it('should deny access when user lacks required role')
    it('should check against database roles, not JWT roles')
    it('should handle admin role correctly')
    it('should handle user role correctly')
    it('should handle custom roles correctly')
  });

  describe('Multiple Role Requirements', () => {
    it('should grant access when user has any of multiple required roles')
    it('should deny access when user has none of required roles')
    it('should handle OR logic for multiple roles correctly')
  });

  describe('No Role Requirements', () => {
    it('should allow access when no roles specified')
    it('should allow access for any authenticated user')
  });
});
```

#### 2. User Profile Validation Tests

**Purpose:** Verify user profile loading is secure

```typescript
describe('User Profile Validation', () => {
  describe('Valid User Profiles', () => {
    it('should load user profile from database by user ID')
    it('should cache user profile in request object')
    it('should extract roles from user profile')
    it('should handle user profile with multiple roles')
  });

  describe('Invalid User Profiles', () => {
    it('should throw ForbiddenException when user not found')
    it('should throw ForbiddenException when user ID is invalid UUID')
    it('should reject null or undefined user IDs')
    it('should handle database errors gracefully')
  });

  describe('User Object Validation', () => {
    it('should require user object in request')
    it('should require user.id in request.user')
    it('should reject requests with incomplete user objects')
    it('should validate user came from proper authentication')
  });
});
```

#### 3. Database Security Tests

**Purpose:** Verify database queries are secure

```typescript
describe('Database Security', () => {
  describe('User ID Validation', () => {
    it('should validate UUID format for user ID')
    it('should reject non-UUID user IDs')
    it('should reject SQL injection attempts in user ID')
    it('should handle malformed UUIDs')
  });

  describe('Service Client Usage', () => {
    it('should use service client to bypass RLS')
    it('should document why service client is necessary')
    it('should validate results from service client')
    it('should handle service client errors')
  });

  describe('Query Performance', () => {
    it('should rate limit profile lookups per user')
    it('should handle concurrent profile lookups')
    it('should cache profile lookups appropriately')
  });
});
```

#### 4. Role Bypass Prevention Tests

**Purpose:** Verify roles cannot be bypassed

```typescript
describe('Role Bypass Prevention', () => {
  describe('User Object Injection', () => {
    it('should prevent user object injection from upstream middleware')
    it('should validate user object source')
    it('should reject manually constructed user objects')
  });

  describe('Race Conditions', () => {
    it('should prevent user object modification between guards')
    it('should validate user object hasn't changed')
    it('should handle concurrent role checks')
  });

  describe('Type Confusion', () => {
    it('should validate user.id is a string')
    it('should reject numeric user IDs')
    it('should reject object user IDs')
    it('should reject array user IDs')
  });
});
```

#### 5. Implicit Role Assignment Tests

**Purpose:** Verify implicit role logic is secure

```typescript
describe('Implicit Role Assignment', () => {
  describe('Default User Role', () => {
    it('should assign implicit "user" role when no roles present')
    it('should not assign implicit role when explicit roles exist')
    it('should audit implicit role assignments')
  });

  describe('Role Validation', () => {
    it('should validate roles before checking requirements')
    it('should filter out invalid roles')
    it('should warn about invalid roles in database')
    it('should not silently ignore invalid roles')
  });

  describe('Empty Roles Array', () => {
    it('should handle empty roles array correctly')
    it('should handle null roles correctly')
    it('should handle undefined roles correctly')
  });
});
```

#### 6. Role Decorator Integration Tests

**Purpose:** Verify decorators work correctly

```typescript
describe('Role Decorator Integration', () => {
  describe('@Roles Decorator', () => {
    it('should enforce roles specified by @Roles decorator')
    it('should handle class-level @Roles decorator')
    it('should handle method-level @Roles decorator')
    it('should allow method decorator to override class')
  });

  describe('@AdminOnly Decorator', () => {
    it('should require admin role')
    it('should deny access to non-admin users')
  });

  describe('Multiple Decorators', () => {
    it('should work with @UseGuards decorator')
    it('should integrate with JwtAuthGuard')
    it('should handle multiple guards in sequence')
  });
});
```

#### 7. Error Handling Tests

**Purpose:** Verify error handling is secure

```typescript
describe('Error Handling', () => {
  describe('Permission Errors', () => {
    it('should throw ForbiddenException with clear message')
    it('should include required roles in error message')
    it('should not leak sensitive user information')
  });

  describe('Database Errors', () => {
    it('should handle database connection errors')
    it('should handle database query errors')
    it('should throw ForbiddenException on database errors')
  });

  describe('Logging', () => {
    it('should log role check attempts')
    it('should log failed role checks')
    it('should not log sensitive user data')
  });
});
```

#### 8. Integration Tests

**Purpose:** Verify full request flow

```typescript
describe('Integration Tests', () => {
  it('should work in full NestJS execution context')
  it('should integrate with JWT guard correctly')
  it('should work with controller decorators')
  it('should handle complete request lifecycle')
  it('should work with Supabase service')
  it('should handle concurrent requests')
  it('should maintain security under load')
});
```

---

## Test Implementation Notes

### Mock Setup

Each test suite should properly mock:
- `SupabaseService` for database operations
- `StreamTokenService` for token operations
- `Reflector` for decorator metadata
- `ExecutionContext` for request context
- Environment variables for configuration

### Security Test Guidelines

1. **Test Attack Vectors**: Each vulnerability should have explicit tests
2. **Test Error Paths**: Verify errors don't leak information
3. **Test Edge Cases**: Boundary conditions, race conditions, etc.
4. **Test Integration**: Full request flows, not just unit tests

### Coverage Requirements

- All identified vulnerabilities must have tests
- All code branches must be covered
- All error paths must be tested
- All security-critical paths must have 100% coverage

### Test Quality Criteria

Tests must be:
- **Clear**: Easy to understand what they test
- **Isolated**: Independent of other tests
- **Repeatable**: Same results every time
- **Fast**: Run quickly in CI/CD
- **Comprehensive**: Cover all security scenarios

---

## Success Criteria

Guards can be modified only after:

1. All test suites implemented
2. Coverage meets thresholds:
   - Lines: 90%+
   - Branches: 85%+
   - Functions: 90%+
   - Critical paths: 100%
3. All tests passing
4. Security review of test cases completed
5. Test quality review completed

---

## Next Steps

1. Create test files with describe blocks
2. Implement test cases in priority order
3. Run tests and verify coverage
4. Fix any gaps in coverage
5. Get security review
6. Then and only then, fix vulnerabilities
