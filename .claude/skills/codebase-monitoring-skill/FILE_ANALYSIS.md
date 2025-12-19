# File Analysis Patterns

## Purpose

This document provides detailed patterns for analyzing individual files during codebase monitoring.

## Analysis Steps

### 1. Purpose Analysis

**Goal:** Understand what the file does

**Process:**
1. Read file content
2. Identify main exports/classes/functions
3. Understand file's role in system
4. Determine file's responsibility

**Questions to Answer:**
- What is this file's primary purpose?
- What does it export/provide?
- How does it fit into the system?
- What is its responsibility?

**Example:**
```typescript
// File: apps/api/src/auth/auth.service.ts
// Purpose: Authentication service
// Exports: AuthService class
// Role: Handles user authentication and authorization
// Responsibility: Validate credentials, manage sessions, handle auth flows
```

### 2. Job Performance Evaluation

**Goal:** Assess if file is doing its job well

**Evaluation Criteria:**
- Code quality (readability, maintainability)
- Best practices compliance
- Error handling
- Separation of concerns
- Performance considerations

**Indicators of Good Performance:**
- ✅ Clean, readable code
- ✅ Follows patterns and conventions
- ✅ Proper error handling
- ✅ Good separation of concerns
- ✅ Efficient implementation

**Indicators of Poor Performance:**
- ❌ Code smells (long methods, deep nesting)
- ❌ Violations of patterns
- ❌ Poor error handling
- ❌ Tight coupling
- ❌ Inefficient code

**Code Smell Detection:**
- Long methods (>50 lines)
- Deep nesting (>4 levels)
- High cyclomatic complexity
- God objects/classes
- Feature envy
- Data clumps

### 3. Issue Detection

**Architectural Issues:**
- Pattern violations (e.g., store making API calls)
- Misplaced files (e.g., service in components folder)
- Missing abstractions (e.g., direct Supabase usage)
- Incorrect layer usage (e.g., component with business logic)

**Security Issues:**
- Vulnerable dependencies
- Unsafe data handling
- Missing authentication/authorization
- Exposed secrets or credentials
- SQL injection risks
- XSS vulnerabilities

**Performance Issues:**
- Inefficient algorithms (O(n²) when O(n) possible)
- Unnecessary re-renders
- Missing caching
- Large bundle sizes
- Memory leaks
- Blocking operations

**Maintainability Issues:**
- Code duplication
- Complex logic
- Poor naming
- Missing documentation
- High coupling
- Low cohesion

**Testing Issues:**
- Missing test file
- Low test coverage
- Poor test quality
- Test maintenance issues
- Missing edge case tests

### 4. Urgency Assessment

**High Urgency:**
- Security vulnerabilities (immediate risk)
- Data loss risks (critical data at risk)
- Critical bugs (breaking functionality)
- Breaking changes (affects other systems)

**Medium Urgency:**
- Maintainability issues (affects future development)
- Architectural problems (affects system structure)
- Code smells (affects code quality)
- Performance concerns (affects user experience)

**Low Urgency:**
- Style issues (cosmetic only)
- Minor optimizations (small impact)
- Documentation gaps (affects understanding)
- Code cleanup (improves maintainability)

### 5. Test Coverage Analysis

**Check Test File:**
- Does test file exist? (`.spec.ts`, `.test.ts`, etc.)
- Is test file in correct location?
- Are tests comprehensive?

**Coverage Metrics:**
- Lines: Percentage of lines covered
- Branches: Percentage of branches covered
- Functions: Percentage of functions covered
- Statements: Percentage of statements covered

**Coverage Thresholds:**
- **Adequate**: Lines ≥75%, Branches ≥70%, Functions ≥75%
- **Critical Paths**: Lines ≥85%, Branches ≥80%, Functions ≥85%

**Test Quality:**
- Are tests meaningful? (not just "should be defined")
- Do tests cover edge cases?
- Are tests maintainable?
- Do tests follow E2E principles? (if E2E tests)

### 6. File Necessity Check

**Is File Used?**
- Search for imports across codebase
- Check if file is exported
- Verify file is included in build
- Identify orphaned files

**Dead Code Detection:**
- Unused exports
- Unused functions/classes
- Unreachable code
- Commented-out code

**Pattern:**
```bash
# Search for file imports
grep -r "from.*auth.service" apps/
grep -r "import.*AuthService" apps/

# Check if exported
grep "export.*AuthService" apps/api/src/auth/auth.service.ts
```

### 7. Location Validation

**Is File in Correct Location?**
- Check file location against architecture
- Verify file is in correct directory
- Identify misplaced files

**Location Rules:**
- Components: `apps/web/src/components/` or `apps/web/src/views/`
- Services: `apps/api/src/services/` or `apps/web/src/services/`
- Stores: `apps/web/src/stores/`
- Controllers: `apps/api/src/controllers/` or `apps/api/src/*/*.controller.ts`
- Modules: Appropriate module directories

**Misplaced File Detection:**
- Service file in components folder
- Component file in services folder
- Test file in wrong location
- Configuration file in source folder

## File Analysis Output

**Structure:**
```json
{
  "monitoredDate": "2025-01-XX...",
  "lastChanged": "2025-01-XX...",
  "purpose": "Authentication service",
  "jobPerformance": "good" | "fair" | "poor",
  "issues": [
    {
      "id": 1,
      "type": "architectural",
      "severity": "high",
      "urgency": "high",
      "description": "Tightly coupled to Supabase",
      "location": "line 45-60",
      "refactoring": "supabase-separation"
    }
  ],
  "testCoverage": {
    "lines": 85,
    "branches": 80,
    "functions": 90,
    "adequate": true
  },
  "necessity": "required" | "optional" | "unused",
  "location": "correct" | "should-move"
}
```

## Related

- **`codebase-monitoring-skill/SKILL.md`** - Main skill definition
- **`HIERARCHY_ANALYSIS.md`** - Folder-level analysis
- **`ISSUE_CLASSIFICATION.md`** - Issue detection patterns

