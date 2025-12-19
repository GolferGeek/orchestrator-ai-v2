# Architecture Skill Template

## Purpose

This template provides a structure for creating architecture skills that classify files and validate against architectural patterns.

## Directory Structure

```
architecture-skill/
├── SKILL.md                    # Main skill definition
├── FILE_CLASSIFICATION.md      # File type classification
├── PATTERNS.md                 # Patterns and conventions
├── VIOLATIONS.md               # Common violations
└── ARCHITECTURE.md             # Architecture guidelines
```

## SKILL.md Template

```markdown
---
name: [domain]-architecture-skill
description: "Classify [domain] files and validate against [domain] application patterns. Use when working with [domain keywords], [file types], or any [domain] application code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "architecture"
type: "classification-validation"
used-by-agents: ["[domain]-architecture-agent", "pr-review-agent"]
related-skills: ["execution-context-skill", "transport-types-skill", "[domain]-testing-skill"]
---

# [Domain] Architecture Skill

Classify [domain] files and validate against [domain] application patterns, [architecture type], and architectural decisions.

## Purpose

This skill enables agents to:
1. **Classify Files**: Identify file types ([list file types])
2. **Validate Patterns**: Check compliance with [domain]-specific patterns
3. **Check Architecture**: Ensure [architecture type] is followed
4. **Validate Decisions**: Check compliance with architectural decisions

## When to Use

- **Classifying Files**: When determining what type of file you're working with
- **Validating Patterns**: When checking if code follows [domain] patterns
- **Architecture Compliance**: When ensuring [architecture type] is maintained
- **Code Review**: When reviewing [domain] code for compliance

## Core Principles

### 1. [Architecture Principle Name]

**[Description of principle]**

**Pattern:**
- [Pattern detail 1]
- [Pattern detail 2]
- [Pattern detail 3]

### 2. [Another Principle]

**[Description]**

## File Classification

See [FILE_CLASSIFICATION.md](FILE_CLASSIFICATION.md) for detailed file type classification patterns.

## Patterns

See [PATTERNS.md](PATTERNS.md) for [domain]-specific patterns and conventions.

## Violations

See [VIOLATIONS.md](VIOLATIONS.md) for common violations and their fixes.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for architecture guidelines and decisions.

## Related

- **`execution-context-skill/`** - ExecutionContext validation (MANDATORY for architecture skills)
- **`transport-types-skill/`** - A2A compliance validation (MANDATORY for architecture skills)
- **`[domain]-architecture-agent.md`** - Uses this skill
```

## FILE_CLASSIFICATION.md Template

```markdown
# File Classification

## Purpose

This document provides patterns for classifying [domain] files by type.

## File Types

### [File Type 1]

**Location:** `[path pattern]`
**Purpose:** [Purpose]
**Pattern:** [Pattern description]

**Example:**
```[language]
[code example]
```

### [File Type 2]

[Similar structure]

## Classification Rules

1. [Rule 1]
2. [Rule 2]
3. [Rule 3]

## Related

- **`SKILL.md`** - Main skill definition
- **`PATTERNS.md`** - Patterns and conventions
```

## PATTERNS.md Template

```markdown
# Patterns

## Purpose

This document provides [domain]-specific patterns and conventions.

## Pattern Categories

### 1. [Pattern Category]

**Pattern Name:**
- Description
- When to use
- Example

### 2. [Another Category]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`FILE_CLASSIFICATION.md`** - File type classification
```

## VIOLATIONS.md Template

```markdown
# Violations

## Purpose

This document lists common [domain] architecture violations and their fixes.

## Violation Types

### [Violation Type 1]

**Description:** [What the violation is]
**Fix:** [How to fix it]
**Example:**
```[language]
// ❌ Violation
[violation code]

// ✅ Correct
[correct code]
```

### [Violation Type 2]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`PATTERNS.md`** - Patterns and conventions
```

## ARCHITECTURE.md Template

```markdown
# Architecture

## Purpose

This document describes the [domain] architecture patterns and guidelines.

## Architecture Overview

[High-level architecture description]

## Key Decisions

### Decision 1: [Decision Name]
- **Rationale:** [Why this decision]
- **Impact:** [What it affects]
- **Pattern:** [How to follow it]

### Decision 2: [Another Decision]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`PATTERNS.md`** - Patterns and conventions
```

## Examples

### Example: web-architecture-skill

**Files:**
- `SKILL.md` - Main skill definition
- `FILE_CLASSIFICATION.md` - Classifies Vue components, stores, services, composables, views
- `PATTERNS.md` - Vue 3 Composition API patterns, three-layer architecture
- `VIOLATIONS.md` - Store making API calls, component with business logic
- `ARCHITECTURE.md` - Three-layer architecture (store/service/component)

### Example: api-architecture-skill

**Files:**
- `SKILL.md` - Main skill definition
- `FILE_CLASSIFICATION.md` - Classifies controllers, services, modules, runners
- `PATTERNS.md` - NestJS patterns, dependency injection, mode routing
- `VIOLATIONS.md` - Service in controller, missing dependency injection
- `ARCHITECTURE.md` - NestJS module architecture, LLM service, Observability

## Related

- **`SKILL.md`** - Main skill builder documentation
- **`MULTI_FILE_PATTERNS.md`** - Multi-file patterns guide

