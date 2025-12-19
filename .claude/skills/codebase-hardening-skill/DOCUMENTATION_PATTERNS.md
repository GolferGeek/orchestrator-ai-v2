# Documentation Patterns

## Purpose

This document provides patterns for documenting issues when tests are inadequate for safe fixes.

## When to Document

**Document Instead of Fixing If:**
- Tests are inadequate (see TEST_ADEQUACY.md)
- Fix requires architectural refactoring
- Fix requires significant test coverage
- Fix affects multiple systems

## Issue Documentation Structure

### Basic Structure

```markdown
# Issue #[id]: [Issue Title]

## Problem
[Detailed problem description]

## Proposed Solution
[Detailed solution approach]

## Required Test Coverage
- Unit tests: [requirements]
- Integration tests: [requirements]
- E2E tests: [requirements]

## Implementation Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Related Files
- [file1.ts]
- [file2.ts]
```

### Example: Architectural Issue

```markdown
# Issue #1: Supabase Tight Coupling in Auth Service

## Problem
The `AuthService` is tightly coupled to Supabase, making it difficult to switch authentication providers or test with different implementations. The service directly imports and uses Supabase client throughout the codebase.

**Location:** `apps/api/src/auth/auth.service.ts` (lines 45-60)

**Impact:**
- Cannot easily switch authentication providers
- Difficult to test with different implementations
- Violates dependency inversion principle

## Proposed Solution
1. Create `IAuthService` interface
2. Implement `SupabaseAuthService` that implements `IAuthService`
3. Use NestJS dependency injection to inject `IAuthService`
4. Migrate all usages to use `IAuthService` interface
5. Remove direct Supabase usage

## Required Test Coverage
- Unit tests: Test `IAuthService` interface and implementations
- Integration tests: Test auth flow with different providers
- E2E tests: Test login/logout flows with real services

## Implementation Steps
1. Create `IAuthService` interface in `apps/api/src/auth/interfaces/`
2. Create `SupabaseAuthService` implementation
3. Update NestJS module to provide `IAuthService`
4. Migrate `AuthService` to use `IAuthService`
5. Update all usages to inject `IAuthService`
6. Remove direct Supabase imports
7. Add tests for new interface and implementations

## Related Files
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/supabase/supabase.service.ts`
- `apps/api/src/auth/auth.module.ts`
```

### Example: Security Issue

```markdown
# Issue #2: Missing Input Validation in User Service

## Problem
The `UserService.createUser()` method does not validate user input, allowing potentially malicious data to be stored in the database.

**Location:** `apps/api/src/users/user.service.ts` (lines 20-35)

**Impact:**
- Security vulnerability (potential injection attacks)
- Data integrity issues
- Potential data corruption

## Proposed Solution
1. Add input validation using class-validator
2. Create DTOs with validation decorators
3. Validate all user input before processing
4. Sanitize user input
5. Add error handling for validation failures

## Required Test Coverage
- Unit tests: Test validation logic
- Integration tests: Test user creation with invalid data
- E2E tests: Test user creation flow with validation

## Implementation Steps
1. Install class-validator and class-transformer
2. Create `CreateUserDto` with validation decorators
3. Update `UserService.createUser()` to use DTO
4. Add validation pipe to controller
5. Add error handling
6. Add tests for validation

## Related Files
- `apps/api/src/users/user.service.ts`
- `apps/api/src/users/user.controller.ts`
- `apps/api/src/users/dto/create-user.dto.ts`
```

## Refactoring Documentation Structure

### Basic Structure

```markdown
# Refactoring: [Name]

## Current State
[Description of current implementation]

## Target State
[Description of desired implementation]

## Required Test Coverage
[Test requirements for refactoring]

## Implementation Phases
1. Phase 1: [Description]
2. Phase 2: [Description]
3. Phase 3: [Description]

## Related Issues
- Issue #[id]: [Description]
- Issue #[id]: [Description]
```

### Example: Supabase Separation

```markdown
# Refactoring: Supabase Separation

## Current State
Supabase is used directly throughout the codebase for authentication, database, and storage. Services directly import and use Supabase client, creating tight coupling.

## Target State
Supabase concerns are separated using dependency injection. Services use interfaces (`IAuthService`, `IDatabaseService`, `IStorageService`) that are implemented by Supabase providers. This allows switching implementations without changing service code.

## Required Test Coverage
- Unit tests: Test all interfaces and implementations
- Integration tests: Test services with different providers
- E2E tests: Test complete flows with real services

## Implementation Phases
1. **Phase 1: Create Interfaces** (No breaking changes)
   - Create `IAuthService`, `IDatabaseService`, `IStorageService` interfaces
   - Document interface contracts

2. **Phase 2: Implement Providers** (Parallel to existing)
   - Implement `SupabaseAuthService`, `SupabaseDatabaseService`, `SupabaseStorageService`
   - Add tests for providers

3. **Phase 3: Migrate Services** (Incremental)
   - Migrate services one by one to use interfaces
   - Update dependency injection configuration
   - Add tests for migrated services

4. **Phase 4: Remove Direct Usage** (Cleanup)
   - Remove direct Supabase imports
   - Update all usages to use interfaces
   - Remove old implementations

## Related Issues
- Issue #1: Supabase Tight Coupling in Auth Service
- Issue #2: Supabase Tight Coupling in Database Service
- Issue #3: Supabase Tight Coupling in Storage Service
```

## Documentation Location

**Where to Store:**
- Create `.monitor/issues/` directory
- Store as markdown files: `issue-{id}.md`
- Reference in monitoring artifact

**Integration:**
- Link from monitoring artifact
- Reference in refactorings section
- Include in hardening reports

## Related

- **`codebase-hardening-skill/SKILL.md`** - Main skill definition
- **`TEST_ADEQUACY.md`** - Test adequacy determination
- **`ARCHITECTURAL_HARDENING.md`** - Architectural improvement patterns

