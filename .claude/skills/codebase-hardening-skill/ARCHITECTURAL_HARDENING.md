# Architectural Hardening Patterns

## Purpose

This document provides patterns for addressing architectural decisions and refactorings.

## Architectural Hardening Process

### 1. Understand Current State

**Analyze Current Implementation:**
- Review current architecture
- Identify architectural issues
- Understand dependencies
- Assess impact of changes

### 2. Design Solution

**Create Architectural Solution:**
- Design target architecture
- Identify abstraction layers
- Plan dependency injection
- Design migration strategy

### 3. Check Test Adequacy

**Verify Tests Are Adequate:**
- Check unit test coverage
- Check integration test coverage
- Check E2E test coverage
- Assess test quality

**If Adequate:**
- Implement refactoring incrementally
- Run tests after each phase
- Verify behavior unchanged

**If Inadequate:**
- Document refactoring plan
- Specify test requirements
- Do NOT implement yet

## Example: Supabase Separation

### Current State

**Problem:**
- Supabase used directly for auth, database, storage
- Tightly coupled throughout codebase
- No abstraction layer
- Difficult to test or switch providers

### Target State

**Solution:**
- Separate concerns using dependency injection
- Create interfaces for each concern
- Implement Supabase providers
- Allow switching implementations

### Implementation Plan

#### Phase 1: Create Interfaces (No Breaking Changes)

**Create Abstraction Interfaces:**
```typescript
// apps/api/src/auth/interfaces/auth.service.interface.ts
export interface IAuthService {
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

// apps/api/src/database/interfaces/database.service.interface.ts
export interface IDatabaseService {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
}

// apps/api/src/storage/interfaces/storage.service.interface.ts
export interface IStorageService {
  upload(file: File, path: string): Promise<string>;
  download(path: string): Promise<Blob>;
  delete(path: string): Promise<void>;
}
```

**Benefits:**
- No breaking changes
- Establishes contracts
- Enables testing

#### Phase 2: Implement Providers (Parallel to Existing)

**Implement Supabase Providers:**
```typescript
// apps/api/src/auth/providers/supabase-auth.service.ts
@Injectable()
export class SupabaseAuthService implements IAuthService {
  constructor(private supabase: SupabaseClient) {}

  async login(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signIn({ email, password });
    if (error) throw error;
    return data.user;
  }

  // ... other methods
}

// Similar for DatabaseService and StorageService
```

**Benefits:**
- Parallel to existing code
- Can test independently
- No impact on existing code

#### Phase 3: Migrate Services (Incremental)

**Update Dependency Injection:**
```typescript
// apps/api/src/auth/auth.module.ts
@Module({
  providers: [
    {
      provide: 'IAuthService',
      useClass: SupabaseAuthService,
    },
    AuthService,
  ],
})
export class AuthModule {}

// apps/api/src/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    @Inject('IAuthService') private authService: IAuthService
  ) {}

  async login(email: string, password: string): Promise<User> {
    return await this.authService.login(email, password);
  }
}
```

**Benefits:**
- Incremental migration
- Can test each service independently
- Low risk

#### Phase 4: Remove Direct Usage (Cleanup)

**Remove Direct Supabase Imports:**
- Update all usages to use interfaces
- Remove old implementations
- Clean up unused code

**Benefits:**
- Clean architecture
- Easy to switch providers
- Better testability

### Test Requirements

**Required Test Coverage:**
- Unit tests for all interfaces and implementations
- Integration tests for services with different providers
- E2E tests for complete flows with real services

**If Tests Adequate:**
- Implement refactoring incrementally
- Run tests after each phase
- Verify behavior unchanged

**If Tests Inadequate:**
- Document refactoring plan
- Specify test requirements
- Do NOT implement yet

## Other Architectural Patterns

### Pattern 1: Service Layer Separation

**Issue:** Business logic mixed with controllers

**Solution:**
- Extract business logic to services
- Controllers only handle HTTP
- Services handle business logic

### Pattern 2: Repository Pattern

**Issue:** Direct database access in services

**Solution:**
- Create repository interfaces
- Implement database repositories
- Use dependency injection

### Pattern 3: Event-Driven Architecture

**Issue:** Tight coupling between services

**Solution:**
- Implement event system
- Use events for communication
- Decouple services

## Related

- **`codebase-hardening-skill/SKILL.md`** - Main skill definition
- **`TEST_ADEQUACY.md`** - Test adequacy determination
- **`DOCUMENTATION_PATTERNS.md`** - Issue documentation patterns

