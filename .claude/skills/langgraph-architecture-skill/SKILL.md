---
name: langgraph-architecture-skill
description: Classify LangGraph files and validate against LangGraph workflow patterns. Use when working with workflows, state machines, nodes, tools, HITL, checkpoints, or any LangGraph code.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "architecture"
type: "classification-validation"
used-by-agents: ["langgraph-architecture-agent", "langgraph-api-agent-builder", "pr-review-agent"]
related-skills: ["execution-context-skill", "transport-types-skill", "langgraph-testing-skill"]
---

# LangGraph Architecture Skill

## Purpose

This skill enables agents to:
1. **Classify Files**: Identify file types (workflow, state, node, tool, service, controller, module)
2. **Validate Patterns**: Check compliance with LangGraph-specific patterns
3. **Check Architecture**: Ensure workflow/state/node architecture is followed
4. **Validate Decisions**: Check compliance with architectural decisions

## When to Use

- **Classifying Files**: When determining what type of file you're working with
- **Validating Patterns**: When checking if code follows LangGraph patterns
- **Architecture Compliance**: When ensuring workflow/state/node architecture is maintained
- **Code Review**: When reviewing LangGraph code for compliance

## Core Principles

### 1. LangGraph Workflow Pattern

**Workflow Graph** (`*.graph.ts`):
- StateGraph with nodes and edges
- State annotation with ExecutionContext
- Checkpointing for state persistence
- Observability events for progress tracking

**State Annotation** (`*.state.ts`):
- Extends `BaseStateAnnotation` for ExecutionContext fields
- Defines workflow-specific state fields
- Uses `Annotation.Root()` from LangGraph

**Node Functions**:
- Async functions that receive state and return partial state
- Access ExecutionContext from state
- Emit observability events
- Call LLM service when needed

### 2. ExecutionContext in Workflows

- ExecutionContext stored in state annotation
- ExecutionContext flows through all nodes
- ExecutionContext passed to LLM service calls
- ExecutionContext passed to observability events
- Never create ExecutionContext - only receive and pass through

### 3. LLM Service Integration

- LangGraph calls LLM service via HTTP to API endpoint
- Use `LLMHttpClientService` for all LLM calls
- Pass full ExecutionContext in request
- Automatic usage tracking, costing, and PII processing
- See `LLM_SERVICE.md` for details

### 4. Observability Integration

- LangGraph sends observability events via HTTP to API endpoint
- Use `ObservabilityService` for all observability events
- Pass full ExecutionContext in event
- Non-blocking - failures don't break workflow
- See `OBSERVABILITY.md` for details

## File Classification

See `FILE_CLASSIFICATION.md` for detailed file type patterns.

## Architecture Patterns

See `ARCHITECTURE.md` for detailed architecture patterns.

## LangGraph Patterns

See `PATTERNS.md` for LangGraph-specific patterns and best practices.

## LLM Service Patterns

See `LLM_SERVICE.md` for how LangGraph integrates with the LLM service.

## Observability Patterns

See `OBSERVABILITY.md` for how LangGraph integrates with the observability service.

## Database-Driven State for Complex Flows

See `DATABASE_STATE.md` for database-driven state machine patterns for complex, multi-phase workflows.

## Common Violations

See `VIOLATIONS.md` for common violations and their fixes.

## Example Files

- **`WORKFLOW_PATTERNS.md`** - Examples for different workflow patterns (simple linear, conditional branching, database-driven, HITL, parallel processing)

## Related Skills

- **execution-context-skill** - ExecutionContext validation (MANDATORY)
- **transport-types-skill** - A2A protocol validation (MANDATORY)
- **langgraph-development-skill** - Prescriptive LangGraph building patterns

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'langgraph-architecture-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'langgraph-architecture-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```

