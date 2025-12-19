---
description: "Fix or improve Claude Code ecosystem components (skills, agents, commands) based on issues or feedback. Use when skills aren't being discovered, agents aren't triggering, components need improvement, or patterns need updating."
argument-hint: "[issue description] - Describe the issue: skill not found, agent not triggering, agent did wrong thing, agent did right thing, missing pattern, etc."
category: "ecosystem"
uses-skills: ["skill-builder-skill", "agent-builder-skill"]
uses-agents: ["claude-code-ecosystem-agent"]
related-commands: ["explain-claude"]
---

# /fix-claude Command

## Purpose

Fix or improve Claude Code ecosystem components (skills, agents, commands) based on real-world usage issues or feedback. This command enables the ecosystem to self-improve.

## Usage

```
/fix-claude [issue description]
```

**Arguments:**
- `issue description` (required): Description of the issue or feedback
  - Discovery issues: "skill X not being picked up", "agent Y not triggering"
  - Behavior issues: "agent did Z wrong", "agent did Z right", "we should do more of Z"
  - Pattern issues: "missing pattern for X", "need anti-pattern for Y"

## Examples

```
/fix-claude "the web-architecture-skill is not being picked up when I ask about Vue components"
# Analyzes skill description, adds missing keywords, improves discovery

/fix-claude "the testing-agent created ExecutionContext in a component, that's wrong"
# Adds anti-pattern to web-architecture-skill, updates agent workflow

/fix-claude "the api-architecture-agent did a great job with dependency injection, we should document that pattern"
# Adds good pattern to api-architecture-skill, updates examples

/fix-claude "we need a pattern for handling errors in LangGraph workflows"
# Adds pattern to langgraph-architecture-skill or langgraph-development-skill

/fix-claude "the codebase-monitoring-agent is not triggering when I say 'analyze codebase'"
# Analyzes agent description, adds missing keywords, improves discovery
```

## Workflow

1. **Parse Issue Description**
   - Identify component type (skill, agent, command)
   - Determine issue type (discovery, behavior, pattern)
   - Extract relevant details

2. **Call Ecosystem Agent**
   - Call `claude-code-ecosystem-agent` with issue description
   - Agent analyzes the problem
   - Agent determines fix strategy

3. **Agent Analysis**
   - Reads relevant component file(s)
   - Compares with working components
   - Identifies root cause
   - Determines fix approach

4. **Agent Fix**
   - Updates component file(s)
   - Improves description (if discovery issue)
   - Adds patterns (if behavior/pattern issue)
   - Updates workflow (if workflow issue)
   - Updates documentation

5. **Validation**
   - Verifies fix addresses the issue
   - Checks description includes trigger keywords
   - Validates patterns are clear
   - Ensures cross-references are accurate

6. **Display Summary**
   - Shows what was fixed
   - Explains why the fix works
   - Indicates if testing is needed

## Issue Types

### Discovery Issues

**Pattern:**
- "skill X not being picked up"
- "agent Y not triggering"
- "command Z not working"

**Fix:**
- Analyze description for trigger keywords
- Compare with working components
- Update description with better keywords
- Add missing trigger phrases
- Improve clarity and specificity

### Behavior Issues (Wrong)

**Pattern:**
- "agent did X wrong"
- "agent shouldn't do Y"
- "we should avoid Z"

**Fix:**
- Add anti-pattern to relevant skill
- Update agent workflow to prevent violation
- Add example showing wrong vs right
- Document in VIOLATIONS.md

### Behavior Issues (Right)

**Pattern:**
- "agent did X right"
- "agent did Y well"
- "we should do more of Z"

**Fix:**
- Add good pattern to relevant skill
- Update agent workflow to include pattern
- Add example showing the pattern
- Document in PATTERNS.md

### Pattern Issues

**Pattern:**
- "missing pattern for X"
- "need anti-pattern for Y"
- "should document pattern Z"

**Fix:**
- Identify which skill needs the pattern
- Add pattern to appropriate file
- Update SKILL.md to reference pattern
- Add examples if needed

## Output

**Summary Display:**
- Issue identified
- Component(s) affected
- Fix applied
- Changes made
- Testing recommendations

**Example:**
```
Fix complete!

Issue: web-architecture-skill not being picked up for Vue components
Component: .claude/skills/web-architecture-skill/SKILL.md

Fix Applied:
  ✅ Updated description with missing keywords: "Vue components", "stores", "services"
  ✅ Added trigger phrases: "Vue component", "web component", "front-end code"
  ✅ Improved specificity in description

Changes Made:
  - Updated description field in SKILL.md
  - Added keywords: Vue, component, store, service, composable, view

Testing:
  Try: "I need to create a Vue component"
  Should now trigger web-architecture-skill
```

## Related

- **`claude-code-ecosystem-agent.md`** - Performs the analysis and fixes
- **`skill-builder-skill/`** - For skill creation/updates
- **`agent-builder-skill/`** - For agent creation/updates

