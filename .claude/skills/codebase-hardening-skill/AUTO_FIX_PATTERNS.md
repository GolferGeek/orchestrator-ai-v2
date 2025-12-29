# Auto-Fix Patterns

## Purpose

This document provides safe auto-fix patterns for codebase hardening.

## Safety Principles

**Only Fix If:**
- Tests are adequate (see TEST_ADEQUACY.md)
- Tests can verify the change
- Fix maintains ExecutionContext flow
- Fix maintains A2A compliance
- Fix follows architecture patterns

**Always:**
- Run tests after fix
- Verify behavior unchanged
- Maintain patterns
- Commit with descriptive message

## Pattern 1: Code Smell Fixes

### Long Methods

**Issue:** Method exceeds 50 lines

**Fix:**
- Extract functions for logical sections
- Maintain same behavior
- Run tests to verify

**Example:**
```typescript
// Before: Long method
async function processUser(user: User) {
  // 60 lines of code
}

// After: Extracted functions
async function processUser(user: User) {
  validateUser(user);
  const processed = transformUser(user);
  await saveUser(processed);
}

function validateUser(user: User) { /* ... */ }
function transformUser(user: User) { /* ... */ }
async function saveUser(user: User) { /* ... */ }
```

### Deep Nesting

**Issue:** Nesting exceeds 4 levels

**Fix:**
- Extract nested logic to functions
- Use early returns
- Maintain same behavior

**Example:**
```typescript
// Before: Deep nesting
if (user) {
  if (user.active) {
    if (user.verified) {
      if (user.subscribed) {
        // do something
      }
    }
  }
}

// After: Early returns
if (!user || !user.active || !user.verified || !user.subscribed) {
  return;
}
// do something
```

### Code Duplication

**Issue:** Same code in multiple places

**Fix:**
- Extract common code to function
- Reuse function
- Maintain same behavior

**Example:**
```typescript
// Before: Duplication
function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUserEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// After: Extracted function
function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUserEmail(email: string) {
  return validateEmail(email);
}
```

## Pattern 2: Architecture Fixes

### Misplaced Files

**Issue:** File in wrong directory

**Fix:**
- Move file to correct location
- Update imports
- Maintain ExecutionContext flow
- Maintain A2A compliance

**Example:**
```typescript
// Before: Service in components folder
// apps/web/src/components/user.service.ts

// After: Service in services folder
// apps/web/src/services/user.service.ts
// Update all imports
```

### Layer Violations

**Issue:** Logic in wrong layer

**Fix:**
- Move logic to correct layer
- Maintain ExecutionContext flow
- Follow architecture patterns

**Example:**
```typescript
// Before: Store making API call
// apps/web/src/stores/user.store.ts
async function fetchUser() {
  const response = await fetch('/api/users');
  // ...
}

// After: Service makes API call, store updates state
// apps/web/src/services/user.service.ts
async function fetchUser() {
  const response = await fetch('/api/users');
  return response.json();
}

// apps/web/src/stores/user.store.ts
async function fetchUser() {
  const user = await userService.fetchUser();
  setUser(user);
}
```

### Missing Abstractions

**Issue:** Direct dependency usage

**Fix:**
- Create abstraction interface
- Implement provider
- Use dependency injection
- Maintain ExecutionContext flow

**Example:**
```typescript
// Before: Direct Supabase usage
class AuthService {
  async login(email: string, password: string) {
    return await supabase.auth.signIn({ email, password });
  }
}

// After: Abstraction with dependency injection
interface IAuthService {
  login(email: string, password: string): Promise<User>;
}

class SupabaseAuthService implements IAuthService {
  async login(email: string, password: string) {
    return await supabase.auth.signIn({ email, password });
  }
}

class AuthService {
  constructor(private authService: IAuthService) {}
  async login(email: string, password: string) {
    return await this.authService.login(email, password);
  }
}
```

## Pattern 3: Security Fixes

### Exposed Secrets

**Issue:** Hardcoded API keys

**Fix:**
- Move to environment variables
- Add to .env.example
- Document required variables

**Example:**
```typescript
// Before: Hardcoded key
const API_KEY = 'sk-1234567890';

// After: Environment variable
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
```

### Unsafe Operations

**Issue:** Missing input validation

**Fix:**
- Add input validation
- Sanitize user input
- Validate data types

**Example:**
```typescript
// Before: No validation
function processEmail(email: string) {
  return email.toLowerCase();
}

// After: Validation added
function processEmail(email: string) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
  return email.toLowerCase();
}
```

## Safety Checks

**After Every Fix:**
- ✅ ExecutionContext flow maintained (execution-context-skill)
- ✅ A2A compliance maintained (transport-types-skill)
- ✅ Architecture patterns followed (architecture skills)
- ✅ Tests pass
- ✅ No breaking changes

## Related

- **`codebase-hardening-skill/SKILL.md`** - Main skill definition
- **`TEST_ADEQUACY.md`** - Test adequacy determination
- **`DOCUMENTATION_PATTERNS.md`** - Issue documentation patterns

