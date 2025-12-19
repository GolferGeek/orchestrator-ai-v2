# Registry Pattern: Hard-Coded in Files

## Concept

Instead of maintaining a separate registry file, **all registry information lives in each component's YAML frontmatter**. This creates a **distributed registry** where each file is self-documenting and self-registering.

## Current State

### Commands
**Current frontmatter:**
```yaml
---
description: "Create pull request with progressive validation..."
argument-hint: "[base branch] [title] [description]..."
---
```

**Could add:**
```yaml
---
description: "Create pull request with progressive validation..."
argument-hint: "[base branch] [title] [description]..."
category: "pr-workflow"
uses-skills: ["execution-context-skill", "transport-types-skill", "web-architecture-skill", "api-architecture-skill", "langgraph-architecture-skill", "quality-gates-skill"]
uses-agents: []
related-commands: ["review-pr", "approve-pr"]
---
```

### Agents
**Current frontmatter:**
```yaml
---
name: web-architecture-agent
description: "Build and modify Vue.js web applications..."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: blue
---
```

**Could add:**
```yaml
---
name: web-architecture-agent
description: "Build and modify Vue.js web applications..."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: blue
category: "architecture"
mandatory-skills: ["execution-context-skill", "transport-types-skill", "web-architecture-skill"]
optional-skills: ["web-testing-skill", "web-development-skill"]
related-agents: ["api-architecture-agent", "langgraph-architecture-agent"]
---
```

### Skills
**Current frontmatter:**
```yaml
---
name: web-architecture-skill
description: "Classify web files and validate against Vue.js..."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---
```

**Could add:**
```yaml
---
name: web-architecture-skill
description: "Classify web files and validate against Vue.js..."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "architecture"
type: "classification-validation"
used-by-agents: ["web-architecture-agent", "pr-review-agent"]
related-skills: ["execution-context-skill", "transport-types-skill", "web-testing-skill"]
progressive-disclosure: true
---
```

## Benefits

### 1. **Single Source of Truth**
- Registry info lives in the file itself
- No sync issues
- File is self-documenting

### 2. **Easy to Query**
- Can grep/read all frontmatter
- Can generate registry views programmatically
- Can validate completeness

### 3. **Self-Documenting**
- Each file contains its own registry entry
- No separate registry to maintain
- Changes to component = changes to registry

### 4. **Validation**
- Can validate all components have proper frontmatter
- Can check for missing relationships
- Can verify mandatory skills are referenced

## Implementation

### Option 1: Minimal (Current + Categories)
**Add only `category` field:**
- Commands: `category: "pr-workflow" | "development" | "quality" | "ecosystem"`
- Agents: `category: "architecture" | "builder" | "specialized"`
- Skills: `category: "architecture" | "development" | "testing" | "utility" | "builder"`

**Pros:** Simple, non-breaking  
**Cons:** Limited registry capabilities

### Option 2: Standard (Current + Relationships)
**Add `category` + relationship fields:**
- Commands: `uses-skills`, `uses-agents`, `related-commands`
- Agents: `mandatory-skills`, `optional-skills`, `related-agents`
- Skills: `used-by-agents`, `related-skills`

**Pros:** Full registry capabilities  
**Cons:** More fields to maintain

### Option 3: Full (Current + Everything)
**Add all fields including metadata:**
- Commands: `category`, `uses-skills`, `uses-agents`, `related-commands`, `workflow-steps`
- Agents: `category`, `mandatory-skills`, `optional-skills`, `related-agents`, `workflow-steps`
- Skills: `category`, `type`, `used-by-agents`, `related-skills`, `progressive-disclosure`

**Pros:** Complete registry  
**Cons:** Most maintenance overhead

## Final Schema (Option 2: Standard)

**Decision:** Implement Option 2 (Standard) - Add `category` and relationship fields.

**Why:**
- Enables explicit routing (e.g., `/work-plan --agent=web-architecture-agent`)
- Enables relationship queries (e.g., "which agents use this skill?")
- Enables validation (e.g., "do all architecture agents reference mandatory skills?")
- Not too much overhead
- Self-documenting

## Registry Schema Definition

### Commands Schema

**Required Fields:**
- `description` (existing) - Command description
- `argument-hint` (existing) - Argument hint for user
- `category` (new, required) - Command category

**Optional Fields:**
- `uses-skills` (new, optional) - Array of skill names used by this command
- `uses-agents` (new, optional) - Array of agent names used by this command
- `related-commands` (new, optional) - Array of related command names

**Categories:**
- `pr-workflow` - PR-related commands (create-pr, review-pr, approve-pr)
- `development` - Development workflow (commit, commit-push, worktree, build-plan, work-plan)
- `quality` - Quality assurance (test, monitor, harden)
- `ecosystem` - Ecosystem maintenance (fix-claude, explain-claude)

### Agents Schema

**Required Fields:**
- `name` (existing) - Agent name
- `description` (existing) - Agent description with keywords
- `tools` (existing) - Allowed tools
- `model` (existing) - LLM model
- `color` (existing) - UI color
- `category` (new, required) - Agent category
- `mandatory-skills` (new, required) - Array of mandatory skill names

**Optional Fields:**
- `optional-skills` (new, optional) - Array of optional skill names
- `related-agents` (new, optional) - Array of related agent names

**Categories:**
- `architecture` - Architecture agents (web, api, langgraph)
- `builder` - Builder agents (agent-builder, langgraph-builder, n8n-builder)
- `specialized` - Specialized agents (testing, monitoring, hardening, pr-review, ecosystem)

**Mandatory Skills Rules:**
- All architecture agents MUST include: `execution-context-skill`, `transport-types-skill`, and their domain skill
- Builder agents MUST include: `execution-context-skill`, `transport-types-skill`, and builder skills
- Specialized agents MUST include: `execution-context-skill`, `transport-types-skill`, and their domain skills

### Skills Schema

**Required Fields:**
- `name` (existing) - Skill name
- `description` (existing) - Skill description with keywords
- `allowed-tools` (existing) - Tool restrictions
- `category` (new, required) - Skill category
- `type` (new, required) - Skill type

**Optional Fields:**
- `used-by-agents` (new, optional) - Array of agent names that use this skill
- `related-skills` (new, optional) - Array of related skill names

**Categories:**
- `architecture` - Architecture skills (web, api, langgraph)
- `development` - Development skills (web-dev, api-dev, langgraph-dev)
- `testing` - Testing skills (web-testing, api-testing, langgraph-testing, e2e-testing)
- `utility` - Utility skills (execution-context, transport-types, quality-gates, plan-evaluation, worktree-manager)
- `builder` - Builder skills (skill-builder, agent-builder, context-agent, rag-agent, media-agent, api-agent, external-agent, orchestrator-agent)

**Types:**
- `classification-validation` - Classifies files and validates patterns (architecture skills)
- `prescriptive` - Provides prescriptive building patterns (development skills, builder skills)
- `utility` - Provides utility functions and workflows (utility skills, some testing skills)

## Query Examples

### Find All Commands in Category
```bash
grep -r "category: \"pr-workflow\"" .claude/commands/
```

### Find All Agents Using a Skill
```bash
grep -r "mandatory-skills:.*execution-context-skill" .claude/agents/
```

### Find Related Components
```bash
grep -r "related-commands:.*review-pr" .claude/commands/
```

### Generate Registry View
```bash
# Script that reads all frontmatter and generates JSON/HTML registry
./scripts/generate-registry.sh
```

## Validation

### Check Mandatory Skills
```bash
# Verify all architecture agents reference mandatory skills
for agent in .claude/agents/*-architecture-agent.md; do
  if ! grep -q "execution-context-skill" "$agent"; then
    echo "Missing execution-context-skill in $agent"
  fi
done
```

### Check Relationships
```bash
# Verify related components exist
# (script that checks all related-* fields reference existing components)
```

## Migration Strategy

1. **Add fields incrementally** - Start with `category`, then relationships
2. **Make fields optional** - Don't break existing files
3. **Validate as you go** - Check completeness during PR review
4. **Generate registry views** - Script to read all frontmatter and generate docs

## Example: Enhanced Frontmatter

### Command
```yaml
---
description: "Create pull request with progressive validation..."
argument-hint: "[base branch] [title] [description]..."
category: "pr-workflow"
uses-skills: 
  - "execution-context-skill"
  - "transport-types-skill"
  - "web-architecture-skill"
  - "api-architecture-skill"
  - "langgraph-architecture-skill"
  - "quality-gates-skill"
related-commands:
  - "review-pr"
  - "approve-pr"
---
```

### Agent
```yaml
---
name: web-architecture-agent
description: "Build and modify Vue.js web applications..."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: blue
category: "architecture"
mandatory-skills:
  - "execution-context-skill"
  - "transport-types-skill"
  - "web-architecture-skill"
optional-skills:
  - "web-testing-skill"
  - "web-development-skill"
related-agents:
  - "api-architecture-agent"
  - "langgraph-architecture-agent"
---
```

### Skill
```yaml
---
name: web-architecture-skill
description: "Classify web files and validate against Vue.js..."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "architecture"
type: "classification-validation"
used-by-agents:
  - "web-architecture-agent"
  - "pr-review-agent"
related-skills:
  - "execution-context-skill"
  - "transport-types-skill"
  - "web-testing-skill"
---
```

## Conclusion

**Hard-coding registry info in frontmatter is the right approach:**
- ✅ Single source of truth
- ✅ Self-documenting
- ✅ No sync issues
- ✅ Easy to query
- ✅ Can validate
- ✅ Can generate views

**Recommendation:** Implement Option 2 (Standard) - Add `category` and relationship fields to enable discovery and validation.

