# Utility Skill Template

## Purpose

This template provides a structure for creating utility skills that handle specific operations or workflows.

## Directory Structure

```
utility-skill/
├── SKILL.md                    # Main skill definition
├── REFERENCE.md                # Detailed reference
├── EXAMPLES.md                 # Usage examples
├── TROUBLESHOOTING.md          # Common issues
├── scripts/                    # Executable utilities (optional)
│   ├── validate.sh
│   └── process.py
└── config/                     # Configuration (optional)
    └── schema.yaml
```

## SKILL.md Template

```markdown
---
name: [skill-name]-skill
description: "[What this skill does]. Use when [when to use it]. Keywords: [trigger keywords]."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# [Skill Name] Skill

[Brief description of what this skill does and why it exists].

## Purpose

This skill enables agents to:
1. **[Capability 1]**: [Description]
2. **[Capability 2]**: [Description]
3. **[Capability 3]**: [Description]

## When to Use

- **Trigger 1**: When [specific situation]
- **Trigger 2**: When [specific situation]
- **Trigger 3**: When [specific situation]

## Core Principles

### 1. [Principle Name]

**[Description]**

**Pattern:**
- [Pattern detail 1]
- [Pattern detail 2]

### 2. [Another Principle]

**[Description]**

## Workflow

### 1. Step Name
[Detailed instructions]

### 2. Step Name
[Detailed instructions]

## Reference

See [REFERENCE.md](REFERENCE.md) for detailed reference documentation.

## Examples

See [EXAMPLES.md](EXAMPLES.md) for usage examples.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Related

- **`related-skill/`** - Related skill
- **`related-agent.md`** - Related agent
```

## REFERENCE.md Template

```markdown
# Reference

## Purpose

This document provides detailed reference documentation for [skill name].

## Commands/Operations

### [Command/Operation 1]

**Usage:**
```bash
[command syntax]
```

**Options:**
- `--option1`: [Description]
- `--option2`: [Description]

**Examples:**
```bash
[example 1]
[example 2]
```

### [Command/Operation 2]

[Similar structure]

## Configuration

See [config/schema.yaml](config/schema.yaml) for configuration schema.

## Related

- **`SKILL.md`** - Main skill definition
- **`EXAMPLES.md`** - Usage examples
```

## EXAMPLES.md Template

```markdown
# Examples

## Purpose

This document provides usage examples for [skill name].

## Example 1: [Example Title]

**Scenario:** [What this example demonstrates]

**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

## Example 2: [Another Example]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`REFERENCE.md`** - Detailed reference
```

## TROUBLESHOOTING.md Template

```markdown
# Troubleshooting

## Purpose

This document provides solutions for common issues with [skill name].

## Common Issues

### Issue 1: [Issue Title]

**Symptoms:**
- [Symptom 1]
- [Symptom 2]

**Cause:**
[Cause description]

**Solution:**
[Solution steps]

### Issue 2: [Another Issue]

[Similar structure]

## Related

- **`SKILL.md`** - Main skill definition
- **`REFERENCE.md`** - Detailed reference
```

## Examples

### Example: direct-commit-skill

**Files:**
- `SKILL.md` - Main skill definition
- `REFERENCE.md` - Command reference
- `EXAMPLES.md` - Usage examples
- `TROUBLESHOOTING.md` - Common issues
- `QUALITY_GATES.md` - Quality gate patterns
- `SAFETY_REVIEW.md` - Safety review patterns
- `COMMIT_MESSAGE.md` - Commit message generation
- `ERROR_HANDLING.md` - Error handling patterns

### Example: supabase-management-skill

**Files:**
- `SKILL.md` - Main skill definition
- `REFERENCE.md` - Command reference
- `TROUBLESHOOTING.md` - Common issues
- `scripts/` - Storage script wrappers
- `config/` - Storage path configuration

## Related

- **`SKILL.md`** - Main skill builder documentation
- **`MULTI_FILE_PATTERNS.md`** - Multi-file patterns guide

