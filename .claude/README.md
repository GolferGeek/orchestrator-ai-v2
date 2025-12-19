# Claude Code Skills, Agents, and Commands

**Status:** Clean slate - rebuilding with focused, high-value Skills

## Current Structure

```
.claude/
├── agents/
│   └── pr-review-agent.md          # Good PR review pattern (to be enhanced)
├── skills/
│   ├── worktree-manager-skill/      # Mature, well-documented
│   ├── quality-gates-skill/         # Foundation for PR workflow
│   ├── supabase-management-skill/  # Critical for database sync
│   └── meta-skill/                  # Documentation about Skills
└── [reference docs]
```

## What Was Archived

All experimental and overlapping content has been moved to `.claude-archive/`. See that directory's README for details.

## Rebuild Plan

We're rebuilding with a focused approach:

1. **Core Domain Skills** (Subconversations 1-2)
   - ✅ `execution-context-skill/` - The critical "capsule" that flows through the system (COMPLETE)
   - ✅ `transport-types-skill/` - A2A compliance and transport types (COMPLETE)

2. **Architecture Agents** (Subconversations 5-7)
   - ✅ `web-architecture-agent.md` - Autonomous web app specialist (Vue, stores, services, components)
   - ✅ `api-architecture-agent.md` - Autonomous API specialist (NestJS, runners, controllers, LLM service, Observability)
   - ✅ `langgraph-architecture-agent.md` - Autonomous LangGraph specialist (workflows, HITL, services, LLM service, Observability)
   
   **Architecture Skills** (Supporting - classification & validation):
   - ✅ `web-architecture-skill/` - Classify web files, validate against web specs
   - ✅ `api-architecture-skill/` - Classify API files, validate against API specs (includes LLM_SERVICE.md and OBSERVABILITY.md)
   - ✅ `langgraph-architecture-skill/` - Classify LangGraph files, validate against LangGraph specs (includes LLM_SERVICE.md and OBSERVABILITY.md)

3. **Development Skills** (Subconversations 3-4)
   - ✅ `langgraph-development-skill/` - Prescriptive LangGraph patterns (used by langgraph-agent)
   - ✅ `n8n-development-skill/` - Prescriptive N8N patterns (used by n8n workflows)

4. **Codebase Monitoring & Hardening** (Subconversation 9)
   - ✅ `codebase-monitoring-agent.md` - Analyzes files hierarchically, evaluates health, identifies issues
   - ✅ `codebase-monitoring-skill/` - Monitoring patterns (file analysis, hierarchy analysis, issue classification, report generation)
   - ✅ `codebase-hardening-agent.md` - Reviews reports, determines test adequacy, auto-fixes or documents issues
   - ✅ `codebase-hardening-skill/` - Hardening patterns (test adequacy, auto-fix, documentation, architectural hardening)
   - ✅ `/monitor` - Run codebase monitoring analysis (incremental or full)
   - ✅ `/harden` - Run codebase hardening on specific issues

5. **Agent Builder System** (Subconversation 8)
   - ✅ `agent-builder-agent.md` - Main orchestrator (determines agent type, routes to builders)
   - ✅ **Agent Type Skills** (one per agent type):
     - ✅ `context-agent-skill/` - How to build context agents
     - ✅ `rag-agent-skill/` - How to build RAG agents
     - ✅ `media-agent-skill/` - How to build media agents
     - ✅ `api-agent-skill/` - How to build API agents (determines LangGraph vs N8N)
     - ✅ `external-agent-skill/` - How to build external agents
     - ✅ `orchestrator-agent-skill/` - How to build orchestrator agents (if needed)
   - ✅ **API Agent Sub-Builders** (framework-specific):
     - ✅ `langgraph-api-agent-builder.md` - Builds LangGraph API agents
     - ✅ `n8n-api-agent-builder.md` - Builds N8N API agents
     - Future: `crewai-api-agent-builder.md`, etc. (extensible pattern)

6. **Builder Skills** (Subconversations 10-11)
   - ✅ `skill-builder-skill/` - Guide creation of new Claude Code Skills (templates, patterns, validation)
   - ✅ `agent-builder-skill/` - Guide creation of new Claude Code Agents (templates, patterns, mandatory skills validation)

6. **Testing System** (Subconversation 12)
   - ✅ `testing-agent.md` - Autonomous testing specialist (runs, generates, fixes tests)
   - ✅ `web-testing-skill/` - Web app testing patterns (Vue 3, Vitest, Cypress)
   - ✅ `api-testing-skill/` - API app testing patterns (NestJS, Jest)
   - ✅ `langgraph-testing-skill/` - LangGraph app testing patterns (Jest)
   - ✅ `/test` - Run tests, generate tests, fix tests, check coverage

7. **Commands**
   - ✅ `/commit` - Commit changes (no push)
   - ✅ `/commit-push` - Commit and push changes
   - ✅ `/review-pr` - Review pull requests systematically
   - ✅ `/build-plan` - Build structured, machine-readable plan from PRD(s)
   - ✅ `/work-plan` - Create and execute work plan from task, PRD, or plan file
   - ✅ `/test` - Run tests, generate tests, fix tests, check coverage
   - ✅ `/monitor` - Run codebase monitoring analysis (incremental or full)
   - ✅ `/harden` - Run codebase hardening on specific issues
   - ✅ `/fix-claude` - Fix or improve Claude Code ecosystem components (meta-meta)
   - ✅ `/approve-pr` - Approve pull request quickly (without full review)
   - ✅ `/create-pr` - Create PR with progressive validation

## Principles

- **Focused**: 12-15 high-value Skills (not 50+ commands)
- **Prescriptive**: Clear patterns that prevent mistakes
- **Progressive**: Skills only load what's needed
- **Maintainable**: Easy to update and extend
- **Effective**: Actually prevents common mistakes
- **Self-Improving**: Hardening system finds and fixes issues

## Progress

**Completed:**
- ✅ Subconversation 1: Execution Context Deep Dive - `execution-context-skill/` created
- ✅ Subconversation 2: Transport Types & A2A Compliance - `transport-types-skill/` created
- ✅ Subconversation 3: LangGraph Prescriptive Building Pattern - `langgraph-development-skill/` created
- ✅ Subconversation 4: N8N Prescriptive Building Pattern - `n8n-development-skill/` created

**Next:**
- ✅ Subconversation 5: Web App Architecture (Agent + Skill) - `web-architecture-agent.md` and `web-architecture-skill/` created
- ✅ Subconversation 6: API Architecture (Agent + Skill) - `api-architecture-agent.md` and `api-architecture-skill/` created
- ✅ Subconversation 7: LangGraph Architecture (Agent + Skill) - `langgraph-architecture-agent.md` and `langgraph-architecture-skill/` created (includes LLM service and Observability patterns)
- ✅ Subconversation 8: Agent Builder System (Agent + Skills + Builders) - `agent-builder-agent.md`, agent type skills, and framework builders created
- ✅ Subconversation 9: Codebase Monitoring & Hardening - Monitoring and hardening systems created
- ✅ Subconversation 10: Skill Builder Skill - `skill-builder-skill/` created with templates and patterns
- ✅ Subconversation 11: Agent Builder Skill - `agent-builder-skill/` created with templates and patterns
- ✅ Subconversation 12: Testing System (Agent + Skills + Command) - `testing-agent.md`, app-specific testing skills, `e2e-testing-skill/`, and `/test` command created
- ✅ Meta-Meta: Claude Code Ecosystem Agent - `claude-code-ecosystem-agent.md` and `/fix-claude` command created for ecosystem self-improvement

**Architecture Pattern:**
- **Agents** = Autonomous domain specialists that do substantial work
- **Skills** = Classification & validation helpers (used by agents)
- **Development Skills** = Prescribed patterns for specific operations
- **Discovery**: Agents auto-discover via descriptions, or explicitly specified in commands
- **Mandatory Skills**: All architecture agents MUST explicitly reference execution-context-skill and transport-types-skill

**Next Steps:**

See the plan: `.cursor/plans/claude_code_skills_cleanup_&_rebuild_plan_*.plan.md`

We'll work through 11 subconversations to understand the codebase and build these Skills systematically.

**Documentation:**
- `HIERARCHY.md` - Complete hierarchy of all components with relationships
- `ARCHITECTURE-PATTERN.md` - Agents vs Skills distinction
- `AGENT-BUILDER-ARCHITECTURE.md` - Agent creation system
- `AGENT-TEMPLATE.md` - Template for creating architecture agents
- `COMPLIANCE_REVIEW.md` - Comprehensive compliance review of all components
- `SCENARIOS.md` - Teaching scenarios for interns and clients (26 scenarios)
- `ENHANCEMENT_PLAN.md` - Plan for optional enhancements (examples, `/create-pr`, framework builders, E2E examples)
- `RETROSPECTIVE.md` - Complete retrospective on the rebuild effort
- `REGISTRY_PATTERN.md` - Registry pattern documentation (distributed registry in YAML frontmatter)
- `scripts/validate-registry.sh` - Validation script for registry completeness
- `scripts/query-registry.sh` - Query script for registry relationships and views

