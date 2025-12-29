# Agent Structure Checklist

## Quick Reference

When creating any agent, use this checklist to ensure proper structure and best practices.

## Required Frontmatter

- [ ] `name` field (lowercase with hyphens, e.g., `codebase-monitoring-agent`)
- [ ] `description` field (max 1024 characters, includes trigger keywords)
- [ ] `tools` field (list of allowed tools, e.g., `Read, Write, Edit, Bash, Grep, Glob`)
- [ ] `model` field (optional, default is `sonnet`)
- [ ] `color` field (optional, hex color code)

## Required Sections

- [ ] **Purpose** - Clear description of what the agent does
- [ ] **Critical Cross-Cutting Skills (MANDATORY)** - Must include:
  - [ ] execution-context-skill (MANDATORY)
  - [ ] transport-types-skill (MANDATORY)
  - [ ] Domain-specific skill(s) (MANDATORY for architecture agents)
- [ ] **Workflow** - Step-by-step process
- [ ] **Decision Logic** - When to use which skills
- [ ] **Error Handling** - How to handle violations
- [ ] **Related Skills and Agents** - Cross-references

## Mandatory Skills Pattern

**All agents MUST reference:**
- [ ] execution-context-skill - ExecutionContext flow validation
- [ ] transport-types-skill - A2A protocol compliance
- [ ] Domain-specific skill(s) - For domain expertise

**Pattern:**
```markdown
## Critical Cross-Cutting Skills (MANDATORY)

**These skills MUST be referenced for every [task type]:**

1. **execution-context-skill** - ExecutionContext flow validation
   - [Agent-specific requirements]

2. **transport-types-skill** - A2A protocol compliance
   - [Agent-specific requirements]

**Domain-Specific Skill:**
3. **[domain]-skill** - [Domain] expertise
   - [Agent-specific requirements]
```

## Description Quality Checklist

- [ ] Includes what the agent does
- [ ] Includes when to use the agent
- [ ] Contains trigger keywords
- [ ] Is specific, not vague
- [ ] Is ≤1024 characters
- [ ] Follows existing agent description patterns

## Workflow Checklist

- [ ] Clear step-by-step process
- [ ] References skills explicitly
- [ ] Includes Before/During/After patterns (for architecture agents)
- [ ] Includes validation checkpoints
- [ ] Uses actionable language

## Decision Logic Checklist

- [ ] When to use execution-context-skill
- [ ] When to use transport-types-skill
- [ ] When to use domain-specific skills
- [ ] Clear decision criteria

## Error Handling Checklist

- [ ] ExecutionContext violation handling
- [ ] A2A protocol violation handling
- [ ] Domain-specific error handling
- [ ] References to skills for fixes

## Integration Checklist

- [ ] References related skills
- [ ] References related agents
- [ ] Cross-references are accurate
- [ ] Integration patterns are clear

## Testing Checklist

- [ ] Agent loads when trigger keywords are used
- [ ] All referenced skills exist
- [ ] Workflow is clear and actionable
- [ ] Examples demonstrate correct usage
- [ ] Error handling is comprehensive

## Agent Type-Specific Checklists

### Architecture Agents

- [ ] Uses AGENT-TEMPLATE.md structure
- [ ] References domain-architecture-skill
- [ ] Includes Before/During/After workflow
- [ ] Includes file classification patterns
- [ ] Includes domain-specific patterns

### Specialized Agents

- [ ] References multiple domain skills
- [ ] Includes operation-specific workflow
- [ ] Includes decision logic for skill selection
- [ ] Includes error handling for domain errors

### Builder Agents

- [ ] References builder skills
- [ ] Includes routing logic
- [ ] Includes coordination workflow
- [ ] Includes registration process

## Related

- **`SKILL.md`** - Main agent builder documentation
- **`ARCHITECTURE_AGENT_TEMPLATE.md`** - Template for architecture agents
- **`SPECIALIZED_AGENT_TEMPLATE.md`** - Template for specialized agents
- **`BUILDER_AGENT_TEMPLATE.md`** - Template for builder agents

