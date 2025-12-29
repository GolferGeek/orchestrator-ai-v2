# Architecture Pattern: Agents vs Skills

This document explains the distinction between Agents and Skills in our Claude Code setup.

## Core Distinction

### Agents = Autonomous Domain Specialists
- **Purpose**: Do substantial work autonomously in their domain
- **Capability**: Write significant code, make architectural decisions, handle complex tasks
- **Invocation**: Auto-discovered via description matching, or explicitly specified in commands
- **Examples**: `web-architecture-agent`, `api-architecture-agent`, `langgraph-architecture-agent`

### Skills = Prescribed Patterns & Validation
- **Purpose**: Provide specific patterns, classify files, validate compliance
- **Capability**: Step-by-step guidance, file classification, validation checks
- **Invocation**: Auto-discovered when agents need them, or explicitly referenced
- **Examples**: `execution-context-skill`, `transport-types-skill`, `web-architecture-skill`

## The Workflow

```
Base Agent (gets large task)
  ↓
Recognizes: "This needs web front-end work"
  ↓
Delegates to: web-architecture-agent
  ↓
Web Agent:
  - Has full knowledge of Vue, stores, services, components
  - Understands all architectural decisions
  - Can write substantial code autonomously
  - Uses skills for validation:
    - web-architecture-skill: "What file type? Does it meet specs?"
    - execution-context-skill: "Is ExecutionContext passed correctly?"
    - transport-types-skill: "Is A2A protocol followed?"
  ↓
Returns completed work to base agent
```

## Agent Discovery

### Automatic Discovery (Default)
Agents need **excellent descriptions** with trigger keywords:

```yaml
---
name: web-architecture-agent
description: Build and modify Vue.js web applications. Use when user wants to build web features, modify front-end code, create Vue components, work with stores or services, or build landing pages. Keywords: web, front-end, Vue, component, store, service, landing page, view, composable.
tools: Read, Write, Edit, Bash, Grep, Glob
---
```

**How it works:**
- Claude scans agent descriptions
- Matches task to agent description
- Automatically delegates to matching agent

### Explicit Specification (Commands)
Commands can explicitly specify which agents to use:

```markdown
---
description: "Build a full-stack feature"
---

# Build Full-Stack Feature

**Agent Delegation:**
1. Analyze task requirements
2. Delegate to appropriate agents:
   - `web-architecture-agent` - For Vue components, stores, services
   - `api-architecture-agent` - For API endpoints, services, controllers
   - `langgraph-architecture-agent` - For LangGraph workflows
3. Coordinate between agents as needed
```

## Architecture Components

### Architecture Agents (Autonomous Workers)
- `web-architecture-agent.md` - Full web app specialist
- `api-architecture-agent.md` - Full API specialist
- `langgraph-architecture-agent.md` - Full LangGraph specialist

**Responsibilities:**
- Write substantial code in their domain
- Make architectural decisions
- Understand all patterns and best practices
- Use architecture skills for validation

**CRITICAL: Mandatory Skill References**

All architecture agents **MUST** explicitly reference these cross-cutting skills:

1. **execution-context-skill** - ExecutionContext flow validation (MANDATORY)
2. **transport-types-skill** - A2A protocol compliance (MANDATORY)

These skills must be:
- Referenced in the agent's workflow section
- Checked for every file touched
- Validated before completing any work

**Example Structure:**
```markdown
# Architecture Agent

## Critical Cross-Cutting Skills (MANDATORY)

**Always Reference:**
- `execution-context-skill` - ExecutionContext flow validation
- `transport-types-skill` - A2A protocol compliance

## Workflow

1. Load critical skills (execution-context, transport-types)
2. Load domain skill (web/api/langgraph-architecture)
3. Write code with all skills in mind
4. Validate against all skills before completing
```

### Architecture Skills (Classification & Validation)
- `web-architecture-skill/` - "What file type? Does it meet web specs?"
- `api-architecture-skill/` - "What file type? Does it meet API specs?"
- `langgraph-architecture-skill/` - "What file type? Does it meet LangGraph specs?"

**Responsibilities:**
- Classify files (view, component, store, service, etc.)
- Validate against domain-specific patterns
- Check compliance with architectural decisions
- Used BY agents as they work

### Development Skills (Prescribed Patterns)
- `execution-context-skill/` - How to pass ExecutionContext
- `transport-types-skill/` - How to make A2A calls
- `langgraph-development-skill/` - Prescribed LangGraph patterns
- `n8n-development-skill/` - Prescribed N8N patterns

**Responsibilities:**
- Provide step-by-step guidance for specific operations
- Enforce prescribed patterns
- Used by agents when following specific patterns

## Codebase Hardening

### Hardening Skill
- `codebase-hardening-skill/` - Orchestrates validation across all skills

**Responsibilities:**
- Coordinate validation across all architecture skills
- Check files against multiple skills/subskills
- Validate compliance across domains

### Hardening Agents
- `codebase-audit-agent.md` - Comprehensive audits using all skills
- Sub-agents for specific audit types

**Responsibilities:**
- Perform comprehensive codebase audits
- Use all architecture skills for validation
- Generate audit reports
- Find violations and suggest fixes

## Best Practices

### For Agents
1. **Excellent descriptions**: Include trigger keywords, use cases, domain terms
2. **Clear purpose**: One agent = one domain specialty
3. **Autonomous capability**: Can handle substantial work independently
4. **Mandatory skill references**: Explicitly reference execution-context-skill and transport-types-skill
5. **Skill usage**: Reference architecture skills for validation
6. **Cross-cutting validation**: Always validate ExecutionContext and A2A compliance

### For Skills
1. **Focused scope**: One skill = one specific pattern or validation area
2. **Clear description**: Include trigger keywords for discovery
3. **Progressive disclosure**: Use supporting files for detailed info
4. **Reusable**: Can be used by multiple agents

### For Commands
1. **Explicit agent specification**: When you want control over delegation
2. **Clear workflow**: Document which agents to use and when
3. **Flexible**: Support both explicit and automatic discovery

## Examples

### Example 1: Automatic Discovery
```
User: "Build a new landing page for my organization"

Claude:
1. Scans agent descriptions
2. Finds: "web-architecture-agent" matches "landing page"
3. Delegates to web-architecture-agent
4. Web agent builds landing page using web-architecture-skill for validation
```

### Example 2: Explicit Specification
```
User: "/build-feature Add user authentication with login page and API endpoint"

Command:
1. Analyzes task
2. Explicitly delegates:
   - web-architecture-agent (for login page)
   - api-architecture-agent (for auth endpoint)
3. Coordinates between agents
```

### Example 3: Skill Usage
```
web-architecture-agent (building a component):
1. Writes Vue component code
2. Uses web-architecture-skill: "Is this a component? Does it follow component patterns?"
3. Uses execution-context-skill: "Is ExecutionContext passed correctly?"
4. Uses transport-types-skill: "Are A2A calls made correctly?"
5. Continues working with validated code
```

## Summary

- **Agents** = Do substantial work autonomously
- **Skills** = Classify, validate, provide prescribed patterns
- **Discovery** = Automatic (via descriptions) or explicit (via commands)
- **Usage** = Agents use skills for validation as they work

This pattern provides:
- ✅ Autonomous agents that can handle substantial tasks
- ✅ Prescribed patterns for specific operations
- ✅ Validation and compliance checking
- ✅ Flexible discovery (automatic or explicit)

