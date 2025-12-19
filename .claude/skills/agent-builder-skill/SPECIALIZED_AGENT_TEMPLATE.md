# Specialized Agent Template

## Purpose

This template provides a structure for creating specialized agents that focus on specific operations or workflows.

## Agent File Structure

```markdown
---
name: [agent-name]-agent
description: "[What agent does]. Use when [when to use it]. Keywords: [trigger keywords]."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: [color]
---

# [Agent Name] Agent

## Purpose

You are a specialist [domain] agent for Orchestrator AI. Your responsibility is [what agent does].

## Critical Cross-Cutting Skills (MANDATORY)

**These skills MUST be referenced for every [task type]:**

1. **execution-context-skill** - ExecutionContext flow validation
   - [Agent-specific ExecutionContext requirements]
   - [How ExecutionContext is used in this agent's domain]

2. **transport-types-skill** - A2A protocol compliance
   - [Agent-specific A2A requirements]
   - [How A2A is used in this agent's domain]

**Domain-Specific Skills:**
3. **[domain-skill-1]** - [Purpose of skill 1]
4. **[domain-skill-2]** - [Purpose of skill 2]
5. **[domain-skill-3]** - [Purpose of skill 3]

## Workflow

### 1. Before Starting Work

**Load Critical Skills:**
- Load `execution-context-skill` - Understand ExecutionContext requirements
- Load `transport-types-skill` - Understand A2A protocol requirements
- Load `[domain-skill-1]` - Understand [domain] patterns
- Load `[domain-skill-2]` - Understand [domain] patterns
- Load `[domain-skill-3]` - Understand [domain] patterns

**Understand Requirements:**
- Analyze the task requirements
- Identify what needs to be done
- Determine ExecutionContext flow requirements (if applicable)
- Determine A2A call requirements (if applicable)

### 2. [Workflow Step 1]

[Detailed instructions for step 1]

### 3. [Workflow Step 2]

[Detailed instructions for step 2]

### 4. [Workflow Step 3]

[Detailed instructions for step 3]

## Decision Logic

**When to use execution-context-skill:**
- ✅ [Specific situations for this agent]
- ✅ [Another situation]

**When to use transport-types-skill:**
- ✅ [Specific situations for this agent]
- ✅ [Another situation]

**When to use [domain-skill-1]:**
- ✅ [Specific situations]
- ✅ [Another situation]

**When to use [domain-skill-2]:**
- ✅ [Specific situations]
- ✅ [Another situation]

## Error Handling

**If ExecutionContext violation found:**
- Stop and fix immediately
- Reference execution-context-skill for correct pattern
- Ensure ExecutionContext flows correctly before continuing

**If A2A protocol violation found:**
- Stop and fix immediately
- Reference transport-types-skill for correct pattern
- Ensure A2A compliance before continuing

**If [domain] error occurs:**
- [How to handle domain-specific errors]
- Reference [domain-skill] for correct pattern

## Related Skills and Agents

**Skills Used:**
- execution-context-skill (MANDATORY)
- transport-types-skill (MANDATORY)
- [domain-skill-1] (MANDATORY)
- [domain-skill-2] (MANDATORY)
- [domain-skill-3] (MANDATORY)

**Related Agents:**
- `[related-agent-1].md` - [How they relate]
- `[related-agent-2].md` - [How they relate]

## Notes

- Always validate against all mandatory skills before completing work
- ExecutionContext and A2A compliance are non-negotiable
- [Domain] patterns must be followed consistently
- When in doubt, reference the skills for guidance
```

## Examples

### Example: testing-agent

**Key Sections:**
- Purpose: Testing specialist across all apps
- Mandatory Skills: execution-context-skill, transport-types-skill
- Domain Skills: web-testing-skill, api-testing-skill, langgraph-testing-skill, e2e-testing-skill
- Workflow: Run, generate, fix, coverage, setup
- Decision Logic: When to use which testing skill
- Examples: Running tests, generating tests, fixing failures

### Example: codebase-monitoring-agent

**Key Sections:**
- Purpose: Codebase health monitoring specialist
- Mandatory Skills: execution-context-skill, transport-types-skill
- Domain Skills: codebase-monitoring-skill, web-architecture-skill, api-architecture-skill, langgraph-architecture-skill
- Workflow: File discovery, analysis, hierarchical analysis, artifact generation
- Decision Logic: When to use which architecture skill for classification
- Examples: Analyzing files, generating reports, identifying issues

### Example: pr-review-agent

**Key Sections:**
- Purpose: PR review specialist
- Mandatory Skills: execution-context-skill, transport-types-skill
- Domain Skills: quality-gates-skill, architecture skills
- Workflow: Get PR info, read diff, run checks, analyze, generate review
- Decision Logic: When to use which skill for validation
- Examples: Reviewing PRs, generating comments, approving/requesting changes

## Related

- **`SKILL.md`** - Main agent builder documentation
- **`ARCHITECTURE_AGENT_TEMPLATE.md`** - Template for architecture agents
- **`BUILDER_AGENT_TEMPLATE.md`** - Template for builder agents

