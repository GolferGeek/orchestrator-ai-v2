# PRD: Claude Code Registry Pattern Implementation

**Date:** 2025-12-19  
**Status:** Draft  
**Priority:** Medium  
**Effort:** Small-Medium (2-3 days)

---

## Overview

Implement a distributed registry pattern for Claude Code components (commands, agents, skills) by enhancing YAML frontmatter with registry metadata. This enables explicit discovery, routing, validation, and relationship queries without maintaining a separate registry file.

## Problem Statement

**Current State:**
- Components discovered via description keywords (implicit)
- No explicit routing capabilities (e.g., `/work-plan --agent=web-architecture-agent`)
- No programmatic relationship queries (e.g., "which agents use this skill?")
- No validation of mandatory skill references
- Registry information scattered across files

**Problem:**
- Hard to discover components programmatically
- Can't explicitly route to specific agents/skills
- Can't validate architectural requirements (e.g., mandatory skills)
- Can't query relationships (e.g., "show all commands using web-architecture-skill")

**Solution:**
- Enhance YAML frontmatter with registry metadata
- Add `category` field for grouping
- Add relationship fields (`uses-skills`, `mandatory-skills`, `related-agents`, etc.)
- Enable explicit routing and validation
- Keep registry info in each file (single source of truth)

## Goals

### Primary Goals
1. **Enable Explicit Routing** - Commands can explicitly route to agents (e.g., `/work-plan --agent=web-architecture-agent`)
2. **Enable Relationship Queries** - Programmatically query which agents use which skills, which commands use which agents, etc.
3. **Enable Validation** - Validate that all architecture agents reference mandatory skills
4. **Maintain Single Source of Truth** - Registry info lives in each file's frontmatter

### Secondary Goals
1. **Improve Discovery** - Better component discovery via categories
2. **Self-Documentation** - Each file contains its own registry entry
3. **No Sync Issues** - No separate registry file to maintain

## Scope

### In Scope
- ✅ Add registry fields to all existing commands (13 commands)
- ✅ Add registry fields to all existing agents (11 agents)
- ✅ Add registry fields to all existing skills (27 skills)
- ✅ Create validation script to check completeness
- ✅ Create query script to generate registry views
- ✅ Update builder skills/templates to include registry fields
- ✅ Document registry pattern usage

### Out of Scope
- ❌ Separate registry file (we're using distributed pattern)
- ❌ Registry UI/dashboard (future enhancement)
- ❌ Automatic registry generation (manual is fine for now)
- ❌ Versioning/migration (future enhancement)

## Technical Plan

### Registry Fields

#### Commands
```yaml
---
description: "..."
argument-hint: "..."
category: "pr-workflow" | "development" | "quality" | "ecosystem"
uses-skills: ["skill-name-1", "skill-name-2"]
uses-agents: ["agent-name-1", "agent-name-2"]
related-commands: ["command-name-1", "command-name-2"]
---
```

**Categories:**
- `pr-workflow` - PR-related commands (create-pr, review-pr, approve-pr)
- `development` - Development workflow (commit, commit-push, worktree, build-plan, work-plan)
- `quality` - Quality assurance (test, monitor, harden)
- `ecosystem` - Ecosystem maintenance (fix-claude, explain-claude)

#### Agents
```yaml
---
name: agent-name
description: "..."
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
color: blue
category: "architecture" | "builder" | "specialized"
mandatory-skills: ["execution-context-skill", "transport-types-skill", "domain-skill"]
optional-skills: ["skill-name-1", "skill-name-2"]
related-agents: ["agent-name-1", "agent-name-2"]
---
```

**Categories:**
- `architecture` - Architecture agents (web, api, langgraph)
- `builder` - Builder agents (agent-builder, langgraph-builder, n8n-builder)
- `specialized` - Specialized agents (testing, monitoring, hardening, pr-review, ecosystem)

#### Skills
```yaml
---
name: skill-name
description: "..."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "architecture" | "development" | "testing" | "utility" | "builder"
type: "classification-validation" | "prescriptive" | "utility"
used-by-agents: ["agent-name-1", "agent-name-2"]
related-skills: ["skill-name-1", "skill-name-2"]
---
```

**Categories:**
- `architecture` - Architecture skills (web, api, langgraph)
- `development` - Development skills (web-dev, api-dev, langgraph-dev)
- `testing` - Testing skills (web-testing, api-testing, langgraph-testing, e2e-testing)
- `utility` - Utility skills (execution-context, transport-types, quality-gates, plan-evaluation, worktree-manager)
- `builder` - Builder skills (skill-builder, agent-builder, context-agent, rag-agent, media-agent, api-agent, external-agent, orchestrator-agent)

**Types:**
- `classification-validation` - Classifies files and validates patterns
- `prescriptive` - Provides prescriptive building patterns
- `utility` - Provides utility functions and workflows

### Implementation Steps

#### Phase 1: Define Registry Schema
1. Document registry fields for commands, agents, skills
2. Define categories and types
3. Create examples for each component type
4. Update `REGISTRY_PATTERN.md` with final schema

#### Phase 2: Update Commands (13 files)
1. Add `category` field to all commands
2. Add `uses-skills` field (list skills used)
3. Add `uses-agents` field (list agents used, if any)
4. Add `related-commands` field (list related commands)

**Files to update:**
- `.claude/commands/commit.md`
- `.claude/commands/commit-push.md`
- `.claude/commands/review-pr.md`
- `.claude/commands/create-pr.md`
- `.claude/commands/approve-pr.md`
- `.claude/commands/build-plan.md`
- `.claude/commands/work-plan.md`
- `.claude/commands/test.md`
- `.claude/commands/monitor.md`
- `.claude/commands/harden.md`
- `.claude/commands/fix-claude.md`
- `.claude/commands/explain-claude.md`
- `.claude/commands/worktree.md`

#### Phase 3: Update Agents (11 files)
1. Add `category` field to all agents
2. Add `mandatory-skills` field (list mandatory skills)
3. Add `optional-skills` field (list optional skills, if any)
4. Add `related-agents` field (list related agents)

**Files to update:**
- `.claude/agents/web-architecture-agent.md`
- `.claude/agents/api-architecture-agent.md`
- `.claude/agents/langgraph-architecture-agent.md`
- `.claude/agents/agent-builder-agent.md`
- `.claude/agents/langgraph-api-agent-builder.md`
- `.claude/agents/n8n-api-agent-builder.md`
- `.claude/agents/testing-agent.md`
- `.claude/agents/pr-review-agent.md`
- `.claude/agents/codebase-monitoring-agent.md`
- `.claude/agents/codebase-hardening-agent.md`
- `.claude/agents/claude-code-ecosystem-agent.md`

#### Phase 4: Update Skills (27 files)
1. Add `category` field to all skills
2. Add `type` field (classification-validation, prescriptive, utility)
3. Add `used-by-agents` field (list agents that use this skill)
4. Add `related-skills` field (list related skills)

**Files to update:**
- Architecture skills (web, api, langgraph)
- Development skills (web-dev, api-dev, langgraph-dev)
- Testing skills (web-testing, api-testing, langgraph-testing, e2e-testing)
- Utility skills (execution-context, transport-types, quality-gates, plan-evaluation, worktree-manager)
- Builder skills (skill-builder, agent-builder, context-agent, rag-agent, media-agent, api-agent, external-agent, orchestrator-agent)

#### Phase 5: Create Validation Script
1. Create `scripts/validate-registry.sh`
2. Check all commands have required fields
3. Check all agents have required fields
4. Check all skills have required fields
5. Validate relationships (e.g., referenced agents/skills exist)
6. Validate mandatory skills (e.g., architecture agents reference execution-context-skill)

#### Phase 6: Create Query Script
1. Create `scripts/query-registry.sh`
2. Query by category (e.g., "show all pr-workflow commands")
3. Query relationships (e.g., "which agents use web-architecture-skill?")
4. Generate registry view (JSON/HTML)
5. Generate relationship graph

#### Phase 7: Update Builder Skills/Templates
1. Update `skill-builder-skill` templates to include registry fields
2. Update `agent-builder-skill` templates to include registry fields
3. Update `AGENT-TEMPLATE.md` to include registry fields
4. Document registry pattern in builder skills

#### Phase 8: Documentation
1. Update `HIERARCHY.md` to reference registry pattern
2. Update `README.md` to mention registry capabilities
3. Update `REGISTRY_PATTERN.md` with final implementation
4. Add registry examples to `SCENARIOS.md`

## Development Roadmap

### Phase 1: Schema Definition (Day 1, Morning)
- Define registry fields
- Define categories and types
- Create examples
- Update `REGISTRY_PATTERN.md`

### Phase 2: Commands (Day 1, Afternoon)
- Update all 13 command files
- Add registry fields to frontmatter
- Validate manually

### Phase 3: Agents (Day 2, Morning)
- Update all 11 agent files
- Add registry fields to frontmatter
- Validate mandatory skills references

### Phase 4: Skills (Day 2, Afternoon)
- Update all 27 skill files
- Add registry fields to frontmatter
- Validate relationships

### Phase 5: Validation Script (Day 3, Morning)
- Create `scripts/validate-registry.sh`
- Test validation on all components
- Fix any issues found

### Phase 6: Query Script (Day 3, Afternoon)
- Create `scripts/query-registry.sh`
- Test queries
- Generate sample registry views

### Phase 7: Builder Updates (Day 3, Evening)
- Update builder skills/templates
- Test with new component creation

### Phase 8: Documentation (Day 3, Evening)
- Update all documentation
- Add examples

## Dependencies

### Prerequisites
- ✅ All existing components (commands, agents, skills)
- ✅ YAML frontmatter structure
- ✅ Builder skills/templates

### External Dependencies
- None

### Internal Dependencies
- `REGISTRY_PATTERN.md` - Registry pattern documentation
- `HIERARCHY.md` - Component relationships (for reference)
- Builder skills - For updating templates

## Risks & Mitigations

### Risk 1: Incomplete Registry Data
**Risk:** Some components missing registry fields  
**Mitigation:** Validation script catches missing fields, PR review checks completeness

### Risk 2: Incorrect Relationships
**Risk:** Relationships point to non-existent components  
**Mitigation:** Validation script validates all relationships reference existing components

### Risk 3: Maintenance Overhead
**Risk:** Registry fields become out of date  
**Mitigation:** Self-documenting (fields in same file), validation script, PR review

### Risk 4: Breaking Changes
**Risk:** Adding fields breaks existing tooling  
**Mitigation:** Make all new fields optional, validate backward compatibility

## Success Criteria

### Must Have
- ✅ All commands have `category` field
- ✅ All agents have `category` and `mandatory-skills` fields
- ✅ All skills have `category` and `type` fields
- ✅ Validation script passes for all components
- ✅ Query script can generate registry views
- ✅ Builder templates include registry fields

### Nice to Have
- ✅ Relationship fields populated for all components
- ✅ Registry view generated (JSON/HTML)
- ✅ Relationship graph generated

## Definition of Done

1. **All Components Updated**
   - All 13 commands have registry fields
   - All 11 agents have registry fields
   - All 27 skills have registry fields

2. **Validation Script Works**
   - Script validates all components
   - Script checks relationships
   - Script validates mandatory skills

3. **Query Script Works**
   - Script can query by category
   - Script can query relationships
   - Script can generate registry views

4. **Builder Templates Updated**
   - Skill builder includes registry fields
   - Agent builder includes registry fields
   - Templates tested with new component creation

5. **Documentation Updated**
   - `REGISTRY_PATTERN.md` updated with final schema
   - `HIERARCHY.md` references registry pattern
   - `README.md` mentions registry capabilities
   - Examples added to `SCENARIOS.md`

6. **Testing Complete**
   - Validation script tested
   - Query script tested
   - Manual verification of all components

## Future Enhancements

### Phase 2 (Future)
- Registry UI/dashboard
- Automatic registry generation
- Versioning/migration support
- Registry search functionality

### Phase 3 (Future)
- Integration with `/explain-claude` command
- Integration with `/fix-claude` command
- Registry-based routing in commands
- Registry-based agent selection

## Related Documents

- `REGISTRY_PATTERN.md` - Registry pattern documentation
- `RETROSPECTIVE.md` - Retrospective mentioning registry pattern
- `HIERARCHY.md` - Component relationships (reference)
- `COMPLIANCE_REVIEW.md` - Component compliance (reference)

## Notes

- **Approach:** Distributed registry (info in each file) vs centralized registry (separate file)
- **Rationale:** Single source of truth, no sync issues, self-documenting
- **Maintenance:** Fields updated when components change (same file)
- **Validation:** Script ensures completeness and correctness
- **Query:** Script enables programmatic access to registry data

---

**Last Updated:** 2025-12-19

