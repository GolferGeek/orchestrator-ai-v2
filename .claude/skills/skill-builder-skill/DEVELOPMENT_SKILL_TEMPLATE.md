# Development Skill Template

## Purpose

This template provides a structure for creating development skills that provide prescriptive patterns for building code.

## Directory Structure

```
development-skill/
├── SKILL.md                    # Main skill definition
├── PATTERNS.md                 # Design patterns
├── CONSTRUCTS.md               # Language constructs
├── VIOLATIONS.md               # Common violations
└── templates/                  # Code templates (optional)
    └── example.ts
```

## SKILL.md Template

```markdown
---
name: [domain]-development-skill
description: "Prescriptive [domain] patterns for building [domain] code. Use when building [domain] features, creating [domain] components, or working with [domain] code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# [Domain] Development Skill

Prescriptive patterns for building [domain] code following best practices and architectural decisions.

## Purpose

This skill provides prescriptive patterns for:
1. **Building [Domain] Code**: Step-by-step patterns for creating [domain] features
2. **Following Best Practices**: Ensure code follows [domain] conventions
3. **Avoiding Common Mistakes**: Prevent violations and anti-patterns
4. **Integration**: Integrate with [related systems]

## When to Use

- **Building Features**: When creating new [domain] features
- **Following Patterns**: When ensuring code follows [domain] patterns
- **Code Review**: When reviewing [domain] code for compliance
- **Refactoring**: When refactoring [domain] code

## Core Principles

### 1. [Principle Name]

**[Description]**

**Pattern:**
- [Pattern detail 1]
- [Pattern detail 2]

### 2. [Another Principle]

**[Description]**

## Patterns

See [PATTERNS.md](PATTERNS.md) for detailed design patterns.

## Constructs

See [CONSTRUCTS.md](CONSTRUCTS.md) for language construct usage.

## Violations

See [VIOLATIONS.md](VIOLATIONS.md) for common violations and fixes.

## Related

- **`execution-context-skill/`** - ExecutionContext validation (MANDATORY)
- **`transport-types-skill/`** - A2A compliance validation (MANDATORY)
- **`[domain]-architecture-skill/`** - For file classification
- **`[domain]-architecture-agent.md`** - Uses this skill
```

## PATTERNS.md Template

```markdown
# Patterns

## Purpose

This document provides prescriptive design patterns for [domain] development.

## Pattern Categories

### 1. [Pattern Category]

**Pattern Name:**
- **When to Use:** [When this pattern applies]
- **How to Implement:** [Step-by-step implementation]
- **Example:**
```[language]
[code example]
```

### 2. [Another Category]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`CONSTRUCTS.md`** - Language constructs
```

## CONSTRUCTS.md Template

```markdown
# Constructs

## Purpose

This document describes how to use [domain] language constructs correctly.

## Construct Categories

### 1. [Construct Type]

**Usage:**
- [Usage pattern 1]
- [Usage pattern 2]

**Example:**
```[language]
[code example]
```

### 2. [Another Construct]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`PATTERNS.md`** - Design patterns
```

## VIOLATIONS.md Template

```markdown
# Violations

## Purpose

This document lists common [domain] development violations and their fixes.

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
- **`PATTERNS.md`** - Design patterns
```

## Examples

### Example: langgraph-development-skill

**Files:**
- `SKILL.md` - Main skill definition
- `PATTERNS.md` - LangGraph patterns (StateGraph, nodes, edges, HITL)
- `CONSTRUCTS.md` - LangGraph constructs (StateGraph, State, Node, Edge)
- `VIOLATIONS.md` - Common LangGraph violations
- `HITL.md` - HITL-specific patterns

### Example: n8n-development-skill

**Files:**
- `SKILL.md` - Main skill definition
- `PATTERNS.md` - N8N patterns (Helper LLM, webhook status, workflows)
- `VIOLATIONS.md` - Common N8N violations
- `WORKFLOWS.md` - Workflow patterns
- `HELPER_LLM.md` - Helper LLM pattern

## Related

- **`SKILL.md`** - Main skill builder documentation
- **`MULTI_FILE_PATTERNS.md`** - Multi-file patterns guide

