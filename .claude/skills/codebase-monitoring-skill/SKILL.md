---
description: Patterns and validation for codebase monitoring. Use when analyzing files, evaluating codebase health, identifying issues, or generating monitoring reports. Keywords: monitoring, file analysis, issue detection, codebase health, hierarchical analysis.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Codebase Monitoring Skill

## Purpose

This skill provides patterns and validation for codebase monitoring. It enables agents to analyze files hierarchically, evaluate codebase health, identify issues, and generate comprehensive monitoring reports.

## When to Use

- **File Analysis**: When analyzing individual files for purpose, performance, and issues
- **Hierarchical Analysis**: When evaluating folder structures and their compliance
- **Issue Detection**: When identifying code smells, violations, and problems
- **Report Generation**: When creating monitoring artifacts

## Core Principles

### 1. File Purpose Analysis

**Understand What File Does:**
- Read file content
- Identify main exports/classes/functions
- Understand file's role in system
- Determine file's responsibility

**Pattern:**
- Component files: UI rendering, user interaction
- Service files: Business logic, API calls
- Store files: State management
- Controller files: Request handling
- Module files: Dependency injection configuration

### 2. Job Performance Evaluation

**Is File Doing Its Job Well?**
- Code quality assessment
- Best practices compliance
- Maintainability evaluation
- Performance considerations

**Indicators:**
- ✅ Clean, readable code
- ✅ Follows patterns and conventions
- ✅ Proper error handling
- ✅ Good separation of concerns
- ❌ Code smells (long methods, deep nesting, etc.)
- ❌ Violations of patterns
- ❌ Poor error handling
- ❌ Tight coupling

### 3. Issue Detection

**Types of Issues to Detect:**

**Architectural Issues:**
- Violations of architectural patterns
- Misplaced files
- Incorrect layer usage
- Missing abstractions

**Security Issues:**
- Vulnerable dependencies
- Unsafe data handling
- Missing authentication/authorization
- Exposed secrets

**Performance Issues:**
- Inefficient algorithms
- Unnecessary re-renders
- Missing caching
- Large bundle sizes

**Maintainability Issues:**
- Code duplication
- Complex logic
- Poor naming
- Missing documentation

**Testing Issues:**
- Missing tests
- Low test coverage
- Poor test quality
- Test maintenance issues

### 4. Urgency Classification

**High Urgency:**
- Security vulnerabilities
- Data loss risks
- Critical bugs
- Breaking changes

**Medium Urgency:**
- Maintainability issues
- Architectural problems
- Code smells
- Performance concerns

**Low Urgency:**
- Style issues
- Minor optimizations
- Documentation gaps
- Code cleanup

### 5. Test Coverage Analysis

**Check Test Completeness:**
- Does test file exist?
- What is the coverage percentage?
- Are critical paths tested?
- Is test quality adequate?

**Coverage Thresholds:**
- Lines: ≥75% (adequate)
- Branches: ≥70% (adequate)
- Functions: ≥75% (adequate)
- Critical paths: ≥85% (required)

### 6. File Necessity Check

**Is File Necessary?**
- Check imports/usages
- Identify dead code
- Check for unused exports
- Verify file is part of build

**Pattern:**
- Search for file imports across codebase
- Check if file is exported
- Verify file is included in build
- Identify orphaned files

### 7. Location Validation

**Should File Be Moved?**
- Check file location against architecture
- Verify file is in correct directory
- Identify misplaced files

**Pattern:**
- Components in `components/` or `views/`
- Services in `services/`
- Stores in `stores/`
- Controllers in `controllers/`
- Modules in appropriate module directories

## Hierarchical Analysis Patterns

### Folder Intent Analysis

**Understand Folder Purpose:**
- What is this folder supposed to contain?
- What is the architectural role?
- What file types are expected?

**Examples:**
- `apps/web/src/components/` - Vue components
- `apps/api/src/services/` - Business logic services
- `apps/api/src/controllers/` - HTTP request handlers

### Intent Compliance

**How Well Is Intent Met?**
- Do files match folder intent?
- Are there misplaced files?
- Is folder organization correct?

**Pattern:**
- Check file types in folder
- Identify files that don't belong
- Assess folder organization quality

### Folder-Level Issues

**Aggregate File-Level Issues:**
- Collect issues from all files in folder
- Identify folder-level problems
- Check for missing patterns/files

## Issue Classification Patterns

### Issue Type Detection

**Architectural:**
- Pattern violations
- Misplaced files
- Missing abstractions
- Incorrect layer usage

**Security:**
- Vulnerable dependencies
- Unsafe operations
- Missing validation
- Exposed secrets

**Performance:**
- Inefficient code
- Missing optimizations
- Resource leaks
- Large bundles

**Maintainability:**
- Code duplication
- Complex logic
- Poor structure
- Missing documentation

**Testing:**
- Missing tests
- Low coverage
- Poor quality
- Maintenance issues

### Urgency Assessment

**High Urgency Indicators:**
- Security vulnerabilities
- Data loss risks
- Critical bugs
- Breaking functionality

**Medium Urgency Indicators:**
- Architectural problems
- Maintainability issues
- Performance concerns
- Code smells

**Low Urgency Indicators:**
- Style issues
- Minor optimizations
- Documentation gaps
- Code cleanup

## Report Generation Patterns

### Artifact Structure

**Required Fields:**
- `scope`: Project or app scope
- `lastMonitorDate`: When files were last analyzed
- `monitorVersion`: Version of monitoring system
- `timestamp`: When artifact was generated
- `hierarchy`: Hierarchical file structure
- `prioritizedIssues`: Sorted issues with IDs
- `refactorings`: Grouped refactoring opportunities

### File Entry Structure

**Required Fields:**
- `monitoredDate`: When file was analyzed
- `lastChanged`: When file was last modified
- `purpose`: What file does
- `jobPerformance`: How well it performs
- `issues`: Array of issues
- `testCoverage`: Test coverage data
- `necessity`: Is file necessary
- `location`: Is location correct

### Issue Entry Structure

**Required Fields:**
- `id`: Unique issue ID
- `type`: Issue type (architectural, security, etc.)
- `severity`: Severity level (high, medium, low)
- `urgency`: Urgency level (high, medium, low)
- `description`: Issue description
- `location`: Where issue is (line numbers, etc.)
- `refactoring`: Refactoring name (if applicable)

## Related

- **`codebase-monitoring-agent.md`** - Uses this skill
- **`execution-context-skill/`** - For ExecutionContext validation
- **`transport-types-skill/`** - For A2A compliance validation
- **Architecture skills** - For file classification

