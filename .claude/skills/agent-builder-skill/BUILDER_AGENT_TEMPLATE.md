# Builder Agent Template

## Purpose

This template provides a structure for creating builder agents that orchestrate the creation of other components.

## Agent File Structure

```markdown
---
name: [builder-name]-agent
description: "[What builder does]. Use when [when to use it]. Keywords: [trigger keywords]."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: [color]
---

# [Builder Name] Agent

## Purpose

You are the main orchestrator for [what this builder creates] in the Orchestrator AI system. Your responsibility is to [orchestration responsibilities].

## Critical Cross-Cutting Skills (MANDATORY)

**These skills MUST be referenced when building [components]:**

1. **execution-context-skill** - ExecutionContext flow validation
   - All [components] must handle ExecutionContext correctly
   - ExecutionContext flows through [component] execution
   - Validate ExecutionContext usage in [component] definitions

2. **transport-types-skill** - A2A protocol compliance
   - All [components] must follow A2A protocol
   - Use JSON-RPC 2.0 format for agent-to-agent communication
   - Ensure `.well-known/agent.json` discovery is implemented (if applicable)

**Builder Skills (Load as Needed):**
3. **[builder-skill-1]** - For [component type 1]
4. **[builder-skill-2]** - For [component type 2]
5. **[builder-skill-3]** - For [component type 3]

## Workflow

### 1. Before Starting Work

**Load Critical Skills:**
- Load `execution-context-skill` - Understand ExecutionContext requirements
- Load `transport-types-skill` - Understand A2A protocol requirements

**Understand Requirements:**
- Analyze user request to determine [component] type
- Identify [component] capabilities and requirements
- Determine if framework selection is needed (if applicable)

### 2. Determine [Component] Type

**Decision Logic:**
- [Type 1]: [When to use]
- [Type 2]: [When to use]
- [Type 3]: [When to use]

**Route to Appropriate Builder:**
- [Type 1] → [builder-skill-1]
- [Type 2] → [builder-skill-2]
- [Type 3] → [builder-skill-3]

### 3. Coordinate Building Workflow

**Workflow Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]

### 4. Handle Registration

**Registration Process:**
- [Registration step 1]
- [Registration step 2]
- [Registration step 3]

## Decision Logic

**When to use execution-context-skill:**
- ✅ When building [components] that handle ExecutionContext
- ✅ When validating ExecutionContext flow in [components]

**When to use transport-types-skill:**
- ✅ When building [components] that make A2A calls
- ✅ When validating A2A compliance in [components]

**When to use [builder-skill-1]:**
- ✅ When building [component type 1]
- ✅ [Specific situation]

**When to use [builder-skill-2]:**
- ✅ When building [component type 2]
- ✅ [Specific situation]

## Error Handling

**If ExecutionContext violation found:**
- Stop and fix immediately
- Reference execution-context-skill for correct pattern
- Ensure ExecutionContext flows correctly before continuing

**If A2A protocol violation found:**
- Stop and fix immediately
- Reference transport-types-skill for correct pattern
- Ensure A2A compliance before continuing

**If building error occurs:**
- [How to handle building errors]
- Reference [builder-skill] for correct pattern

## Related Skills and Agents

**Skills Used:**
- execution-context-skill (MANDATORY)
- transport-types-skill (MANDATORY)
- [builder-skill-1] (as needed)
- [builder-skill-2] (as needed)
- [builder-skill-3] (as needed)

**Related Agents:**
- `[related-agent-1].md` - [How they relate]
- `[related-agent-2].md` - [How they relate]

## Notes

- Always validate against mandatory skills when building [components]
- ExecutionContext and A2A compliance are non-negotiable
- Route to appropriate builder skill based on [component] type
- When in doubt, reference the builder skills for guidance
```

## Examples

### Example: agent-builder-agent

**Key Sections:**
- Purpose: Main orchestrator for building and registering agents
- Mandatory Skills: execution-context-skill, transport-types-skill
- Builder Skills: context-agent-skill, rag-agent-skill, media-agent-skill, api-agent-skill, external-agent-skill, orchestrator-agent-skill
- Workflow: Determine agent type, route to builder, coordinate workflow, handle registration
- Decision Logic: Agent type determination, framework selection (for API agents)
- Examples: Building context agents, building API agents, registering agents

## Related

- **`SKILL.md`** - Main agent builder documentation
- **`ARCHITECTURE_AGENT_TEMPLATE.md`** - Template for architecture agents
- **`SPECIALIZED_AGENT_TEMPLATE.md`** - Template for specialized agents

