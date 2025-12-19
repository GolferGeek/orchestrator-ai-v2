---
description: Guide creation of new Claude Code Agents following best practices and patterns. Use when creating new agents, extending agent capabilities, or packaging domain expertise into autonomous agents. Keywords: create agent, build agent, new agent, agent creation, agent development.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Agent Builder Skill

## Purpose

This skill guides the creation of new Claude Code Agents, ensuring they follow best practices, proper structure, mandatory skill references, and integration patterns. It helps package domain expertise into discoverable, autonomous agents.

## When to Use

- **Creating New Agents**: When building a new agent from scratch
- **Extending Agents**: When adding capabilities to existing agents
- **Refactoring Agents**: When restructuring or improving agents
- **Validating Agents**: When checking if an agent follows best practices

## Core Principles

### 1. Agent Discovery

**Description is Critical:**
- Must include **what the agent does** AND **when to use it**
- Include trigger keywords/phrases
- Be specific, not vague
- Max 1024 characters

**Example Good Description:**
```
"Build and modify Vue.js web applications. Use when user wants to build web features, modify front-end code, create Vue components, work with stores or services, build landing pages, or implement custom UI components. Keywords: web, front-end, Vue, component, store, service, landing page, view, composable, custom UI, conversation window."
```

**Example Bad Description:**
```
"Helps with web code"
```

### 2. Mandatory Skills

**All Agents MUST Reference:**
1. **execution-context-skill** - ExecutionContext flow validation (MANDATORY)
2. **transport-types-skill** - A2A protocol compliance (MANDATORY)
3. **Domain-specific skill** - For domain expertise (MANDATORY for architecture agents)

**Pattern:**
```markdown
## Critical Cross-Cutting Skills (MANDATORY)

**These skills MUST be referenced for every [task type]:**

1. **execution-context-skill** - ExecutionContext flow validation
   - [Specific requirements for this agent]

2. **transport-types-skill** - A2A protocol compliance
   - [Specific requirements for this agent]

**Domain-Specific Skill:**
3. **[domain]-architecture-skill** - [Domain] file classification and validation
   - [Specific requirements]
```

### 3. Agent Types

**Architecture Agents:**
- Domain specialists (web, API, LangGraph)
- Build and modify code in their domain
- Use architecture skills for classification
- Examples: `web-architecture-agent`, `api-architecture-agent`, `langgraph-architecture-agent`

**Specialized Agents:**
- Focused on specific operations
- Use multiple skills for their domain
- Examples: `testing-agent`, `codebase-monitoring-agent`, `codebase-hardening-agent`, `pr-review-agent`

**Builder Agents:**
- Orchestrate creation of other components
- Use builder skills
- Examples: `agent-builder-agent`

### 4. Agent Structure

**Required Sections:**
- Purpose - What the agent does
- Critical Cross-Cutting Skills (MANDATORY) - Must reference execution-context-skill and transport-types-skill
- Workflow - Step-by-step process
- Decision Logic - When to use which skills
- Error Handling - How to handle violations
- Related Skills and Agents - Cross-references

## Agent Creation Workflow

### Step 1: Define Purpose and Scope

**Ask These Questions:**
1. What domain or operation should this agent cover?
2. When should Claude use this agent? (triggers)
3. What expertise or workflows need to be captured?
4. What type of agent is it? (architecture, specialized, builder)
5. What skills does it need? (mandatory + domain-specific)

**Document the answers** for reference during creation.

### Step 2: Choose Agent Type and Structure

**Agent Types:**

**Architecture Agents:**
- Domain specialists for building code
- Use architecture skills for classification
- Follow AGENT-TEMPLATE.md structure
- Examples: `web-architecture-agent`, `api-architecture-agent`, `langgraph-architecture-agent`

**Specialized Agents:**
- Focused on specific operations
- Use multiple skills for their domain
- Examples: `testing-agent`, `codebase-monitoring-agent`, `pr-review-agent`

**Builder Agents:**
- Orchestrate creation workflows
- Use builder skills
- Examples: `agent-builder-agent`

### Step 3: Create Agent File

**Create agent file:**
```bash
touch .claude/agents/<agent-name>.md
```

**Naming Conventions:**
- Use lowercase with hyphens (e.g., `codebase-monitoring-agent`, `pr-review-agent`)
- Be descriptive but concise
- Match existing patterns (e.g., `*-architecture-agent`, `*-agent`)
- For builders: `*-builder-agent` or `*-agent-builder`

### Step 4: Write Agent with YAML Frontmatter

**Required Frontmatter:**
```yaml
---
name: agent-name
description: Brief description of what this agent does and when to use it. Include trigger keywords.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: [color]
---
```

**Frontmatter Requirements:**
- `name`: Required, lowercase with hyphens
- `description`: Required, max 1024 characters
  - Include BOTH what it does AND when to use it
  - Mention key trigger words/phrases
  - Be specific, not vague
- `tools`: Required, list of allowed tools
- `model`: Optional, default is `sonnet`
- `color`: Optional, hex color code

**Agent Structure:**
```markdown
# Agent Name

## Purpose

You are a specialist [domain] agent for Orchestrator AI. Your responsibility is [what agent does].

## Critical Cross-Cutting Skills (MANDATORY)

**These skills MUST be referenced for every [task type]:**

1. **execution-context-skill** - ExecutionContext flow validation
   - [Specific requirements]

2. **transport-types-skill** - A2A protocol compliance
   - [Specific requirements]

**Domain-Specific Skill:**
3. **[domain]-skill** - [Domain] expertise
   - [Specific requirements]

## Workflow

### 1. Before Starting Work

**Load Critical Skills:**
- Load `execution-context-skill` - Understand ExecutionContext requirements
- Load `transport-types-skill` - Understand A2A protocol requirements
- Load `[domain]-skill` - Understand [domain] patterns

### 2. [Workflow Step]

[Detailed instructions]

## Decision Logic

**When to use execution-context-skill:**
- ✅ [Specific situations]

**When to use transport-types-skill:**
- ✅ [Specific situations]

## Error Handling

**If ExecutionContext violation found:**
- Stop and fix immediately
- Reference execution-context-skill for correct pattern

## Related Skills and Agents

**Skills Used:**
- execution-context-skill (MANDATORY)
- transport-types-skill (MANDATORY)
- [domain]-skill (MANDATORY)

**Related Agents:**
- [Other agents that might collaborate]
```

### Step 5: Validate Agent Structure

**Checklist:**
- [ ] YAML frontmatter is valid
- [ ] `name` is lowercase with hyphens
- [ ] `description` is ≤1024 characters and includes triggers
- [ ] `tools` is specified
- [ ] Agent has Purpose section
- [ ] Agent has Critical Cross-Cutting Skills section with execution-context-skill and transport-types-skill
- [ ] Agent has Workflow section
- [ ] Agent has Decision Logic section
- [ ] Agent has Error Handling section
- [ ] Agent has Related Skills and Agents section
- [ ] All referenced skills exist

**Validation Script:**
```bash
# Check YAML frontmatter
head -10 .claude/agents/<agent-name>.md

# Verify structure
grep -E "## (Purpose|Critical Cross-Cutting Skills|Workflow|Decision Logic|Error Handling|Related)" .claude/agents/<agent-name>.md
```

### Step 6: Test Agent Discovery

**Test Triggers:**
- Ask questions matching the agent's description
- Verify Claude loads and uses the agent
- Check that instructions are clear and actionable

**Example Test:**
```
User: "I need to build a Vue component"
→ Should trigger web-architecture-agent

User: "Run tests for the API"
→ Should trigger testing-agent
```

### Step 7: Integrate with Existing Agents

**Cross-References:**
- Reference related agents in "Related Agents" section
- Link to architecture agents if applicable
- Reference execution-context-skill and transport-types-skill (mandatory)

**Integration Pattern:**
```markdown
## Related Skills and Agents

**Skills Used:**
- execution-context-skill (MANDATORY)
- transport-types-skill (MANDATORY)
- [domain]-skill (MANDATORY)

**Related Agents:**
- `web-architecture-agent.md` - For web code
- `api-architecture-agent.md` - For API code
```

## Agent Type Templates

### Architecture Agent Template

See [ARCHITECTURE_AGENT_TEMPLATE.md](ARCHITECTURE_AGENT_TEMPLATE.md) for complete template.

**Key Sections:**
- Purpose - Domain specialist description
- Critical Cross-Cutting Skills (MANDATORY) - execution-context-skill, transport-types-skill, domain-architecture-skill
- Workflow - Before/During/After work patterns
- Domain-Specific Patterns - Domain patterns
- Decision Logic - When to use which skills
- Error Handling - Violation handling
- Related Skills and Agents - Cross-references

### Specialized Agent Template

See [SPECIALIZED_AGENT_TEMPLATE.md](SPECIALIZED_AGENT_TEMPLATE.md) for complete template.

**Key Sections:**
- Purpose - Specialized operation description
- Critical Cross-Cutting Skills (MANDATORY) - execution-context-skill, transport-types-skill
- Domain Skills - Multiple skills for domain expertise
- Workflow - Operation-specific workflow
- Decision Logic - When to use which skills
- Error Handling - Violation handling
- Related Skills and Agents - Cross-references

### Builder Agent Template

See [BUILDER_AGENT_TEMPLATE.md](BUILDER_AGENT_TEMPLATE.md) for complete template.

**Key Sections:**
- Purpose - Builder orchestrator description
- Critical Cross-Cutting Skills (MANDATORY) - execution-context-skill, transport-types-skill
- Builder Skills - Agent type skills
- Workflow - Building workflow
- Decision Logic - Agent type determination
- Error Handling - Building errors
- Related Skills and Agents - Cross-references

## Best Practices

### Description Writing

**Good Examples:**
- ✅ "Build and modify Vue.js web applications. Use when user wants to build web features, modify front-end code, create Vue components, work with stores or services, build landing pages, or implement custom UI components. Keywords: web, front-end, Vue, component, store, service, landing page, view, composable, custom UI, conversation window."
- ✅ "Run tests, generate tests, fix failing tests, analyze test coverage, and set up test infrastructure. Use when user wants to test code, generate tests, fix test failures, check coverage, or set up testing. Keywords: test, testing, coverage, unit test, e2e test, integration test, jest, vitest, cypress, spec, test file."
- ✅ "Analyze codebase files hierarchically, evaluate health, identify issues, and generate monitoring reports. Use when user wants to monitor codebase health, analyze files, identify issues, or generate monitoring reports. Keywords: monitor, monitoring, codebase health, file analysis, issue detection, codebase audit, hierarchical analysis."

**Bad Examples:**
- ❌ "Helps with web code"
- ❌ "Testing stuff"
- ❌ "Monitoring"

### Mandatory Skills Pattern

**Always Include:**
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

### Workflow Organization

- Use clear, actionable language
- Number sequential steps
- Use bullet points for options/lists
- Include code blocks with examples
- Reference skills explicitly
- Keep focused on agent's purpose

### Error Handling

**Always Include:**
```markdown
## Error Handling

**If ExecutionContext violation found:**
- Stop and fix immediately
- Reference execution-context-skill for correct pattern
- Ensure ExecutionContext flows correctly before continuing

**If A2A protocol violation found:**
- Stop and fix immediately
- Reference transport-types-skill for correct pattern
- Ensure A2A compliance before continuing

**If [domain] pattern violation found:**
- Stop and fix immediately
- Reference [domain]-skill for correct pattern
- Ensure [domain] compliance before continuing
```

## Common Patterns

### Pattern 1: Architecture Agent

**Structure:**
- Purpose: Domain specialist
- Mandatory Skills: execution-context-skill, transport-types-skill, domain-architecture-skill
- Workflow: Before/During/After work patterns
- Domain Patterns: Domain-specific patterns
- Examples: `web-architecture-agent`, `api-architecture-agent`, `langgraph-architecture-agent`

### Pattern 2: Specialized Agent

**Structure:**
- Purpose: Specialized operation
- Mandatory Skills: execution-context-skill, transport-types-skill
- Domain Skills: Multiple skills for domain expertise
- Workflow: Operation-specific workflow
- Examples: `testing-agent`, `codebase-monitoring-agent`, `pr-review-agent`

### Pattern 3: Builder Agent

**Structure:**
- Purpose: Builder orchestrator
- Mandatory Skills: execution-context-skill, transport-types-skill
- Builder Skills: Agent type skills
- Workflow: Building workflow
- Examples: `agent-builder-agent`

## Related

- **`AGENT-TEMPLATE.md`** - Architecture agent template
- **`skill-builder-skill/`** - For creating skills used by agents
- **`agent-builder-agent.md`** - Orchestrates agent building
- **Existing agents** - Examples of well-structured agents

