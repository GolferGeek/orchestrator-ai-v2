# Issue Classification Patterns

## Purpose

This document provides patterns for detecting and classifying issues during codebase monitoring.

## Issue Types

### Architectural Issues

**Pattern:**
- Violations of architectural patterns
- Misplaced files
- Missing abstractions
- Incorrect layer usage

**Examples:**
- Store making API calls (should use service)
- Component with business logic (should use service)
- Service in components folder (should be in services)
- Direct Supabase usage (should use abstraction)

**Detection:**
- Check file location against architecture
- Check for pattern violations
- Check for missing abstractions
- Check layer boundaries

### Security Issues

**Pattern:**
- Vulnerable dependencies
- Unsafe data handling
- Missing authentication/authorization
- Exposed secrets

**Examples:**
- Hardcoded API keys
- SQL injection risks
- XSS vulnerabilities
- Missing input validation
- Exposed sensitive data

**Detection:**
- Check for hardcoded secrets
- Check for unsafe SQL queries
- Check for unescaped user input
- Check for missing auth checks

### Performance Issues

**Pattern:**
- Inefficient algorithms
- Unnecessary re-renders
- Missing caching
- Large bundle sizes

**Examples:**
- O(n²) algorithms when O(n) possible
- Missing React.memo or computed properties
- Missing caching for expensive operations
- Large dependencies

**Detection:**
- Check algorithm complexity
- Check for unnecessary re-renders
- Check for missing caching
- Check bundle sizes

### Maintainability Issues

**Pattern:**
- Code duplication
- Complex logic
- Poor structure
- Missing documentation

**Examples:**
- Duplicated code blocks
- High cyclomatic complexity
- Long methods
- Missing JSDoc comments

**Detection:**
- Check for code duplication
- Calculate cyclomatic complexity
- Check method/function lengths
- Check for documentation

### Testing Issues

**Pattern:**
- Missing tests
- Low test coverage
- Poor test quality
- Test maintenance issues

**Examples:**
- No test file for service
- Coverage below thresholds
- Tests that don't verify behavior
- Outdated tests

**Detection:**
- Check for test file existence
- Check test coverage metrics
- Review test quality
- Check test maintenance

## Urgency Classification

### High Urgency

**Criteria:**
- Security vulnerabilities
- Data loss risks
- Critical bugs
- Breaking functionality

**Examples:**
- SQL injection vulnerability
- Exposed API keys
- Data corruption risk
- Critical feature broken

### Medium Urgency

**Criteria:**
- Maintainability issues
- Architectural problems
- Performance concerns
- Code smells

**Examples:**
- Tight coupling to Supabase
- Code duplication
- Performance bottlenecks
- Complex logic

### Low Urgency

**Criteria:**
- Style issues
- Minor optimizations
- Documentation gaps
- Code cleanup

**Examples:**
- Inconsistent naming
- Minor performance improvements
- Missing comments
- Code formatting

## Severity Classification

### High Severity

**Impact:**
- Major impact on system
- Affects multiple components
- Difficult to fix
- Requires significant refactoring

**Examples:**
- Architectural violations affecting entire system
- Security vulnerabilities affecting all users
- Performance issues affecting user experience

### Medium Severity

**Impact:**
- Moderate impact
- Affects specific components
- Moderate effort to fix
- Requires some refactoring

**Examples:**
- Code duplication in specific areas
- Performance issues in specific features
- Maintainability problems in modules

### Low Severity

**Impact:**
- Minor impact
- Affects individual files
- Easy to fix
- Requires minimal changes

**Examples:**
- Style issues
- Minor code smells
- Documentation gaps

## Issue Entry Structure

**Required Fields:**
```json
{
  "id": 1,
  "type": "architectural" | "security" | "performance" | "maintainability" | "testing" | "documentation" | "style",
  "severity": "high" | "medium" | "low",
  "urgency": "high" | "medium" | "low",
  "description": "Detailed issue description",
  "location": "line 45-60" | "file path",
  "refactoring": "refactoring-name" | null,
  "relatedFiles": ["file1.ts", "file2.ts"]
}
```

## Refactoring Grouping

**Group Related Issues:**
- Issues with same `refactoring` tag are grouped
- Refactorings have names (e.g., "supabase-separation")
- Refactorings have priority and estimated effort

**Example:**
```json
{
  "refactorings": {
    "supabase-separation": {
      "name": "Supabase Separation",
      "description": "Separate Supabase concerns using dependency injection",
      "issues": [1, 2, 3],
      "priority": "high",
      "estimatedEffort": "large"
    }
  }
}
```

## Related

- **`codebase-monitoring-skill/SKILL.md`** - Main skill definition
- **`FILE_ANALYSIS.md`** - File-level analysis
- **`HIERARCHY_ANALYSIS.md`** - Folder-level analysis

