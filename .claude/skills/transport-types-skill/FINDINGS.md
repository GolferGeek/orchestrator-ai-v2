# Transport Types & A2A Compliance Deep Dive - Findings

**Date:** 2025-01-18  
**Subconversation:** 2 of 11  
**Status:** ✅ Complete

## Summary

Completed deep dive into transport types and A2A protocol compliance. Created `transport-types-skill` to enforce strict adherence to A2A protocol contracts.

## Key Findings

### 1. Transport Types Structure

**Package:** `@orchestrator-ai/transport-types`  
**Location:** `apps/transport-types/`

**Components:**
- **JSON-RPC 2.0 Base Types**: `request/json-rpc.types.ts`
- **A2A Task Request/Response**: `request/task-request.types.ts`, `response/task-response.types.ts`
- **Mode-Specific Types**: `modes/plan.types.ts`, `modes/build.types.ts`, `modes/converse.types.ts`, `modes/hitl.types.ts`
- **ExecutionContext**: `core/execution-context.ts`
- **SSE Streaming**: `streaming/sse-events.types.ts`
- **Enums**: `shared/enums.ts` (AgentTaskMode, JsonRpcErrorCode, A2AErrorCode)

### 2. A2A Protocol Structure

**Base:** JSON-RPC 2.0
- All requests: `{ jsonrpc: "2.0", method, id, params }`
- Success responses: `{ jsonrpc: "2.0", id, result }`
- Error responses: `{ jsonrpc: "2.0", id, error: { code, message, data? } }`

**A2A Extension:**
- `params` contains `TaskRequestParams` with ExecutionContext, mode, payload, userMessage
- `result` contains `TaskResponse` with success, mode, payload (content + metadata)

### 3. Mode-Specific Payloads

**Plan Mode:**
- Actions: `create`, `read`, `list`, `edit`, `rerun`, `set_current`, `delete_version`, `merge_versions`, `copy_version`, `delete`
- Each action has specific payload structure (e.g., `PlanCreatePayload`, `PlanReadPayload`)

**Build Mode:**
- Same actions as Plan mode
- Each action has specific payload structure (e.g., `BuildCreatePayload`, `BuildReadPayload`)

**Converse Mode:**
- No actions - just conversational interaction
- Payload: `ConverseModePayload` with optional `temperature`, `maxTokens`, `stop`

**HITL Mode:**
- Actions: `resume`, `status`, `history`, `pending`
- Each action has specific payload structure (e.g., `HitlResumePayload`, `HitlStatusPayload`)

### 4. When Transport Types Apply

**✅ MUST Use Transport Types:**
- All agent-to-agent calls (frontend → backend agent endpoints)
- All A2A protocol endpoints (`/agent-to-agent/:orgSlug/:agentSlug/tasks`)
- All mode-specific operations (plan, build, converse, hitl)
- All external agent calls (calling other A2A-compatible agents)
- All SSE streaming events (task progress, agent chunks)

**❌ DON'T Use Transport Types:**
- Non-A2A endpoints (e.g., `/api/conversations`, `/api/users` - regular REST endpoints)
- Front-end data fetching (e.g., getting conversation list, user profile)
- Internal service-to-service calls (within backend, not A2A protocol)
- Database queries (direct database access)

**Key Distinction:** If it's an **agent call** (converse, plan, build, hitl), it MUST use transport types. If it's just **data retrieval** for the UI, it can use regular REST.

### 5. Common Violations

1. **Custom Fields**: Adding fields to payloads not defined in transport types
2. **Missing Required Fields**: Missing ExecutionContext, jsonrpc version, payload action
3. **Wrong JSON-RPC Structure**: Custom response formats instead of JSON-RPC
4. **Using Transport Types for Non-A2A**: Using A2A types for regular REST endpoints
5. **Modifying Transport Types**: Changing transport types without coordinating with frontend/backend
6. **Type Assertions**: Unsafe type assertions bypassing validation
7. **Wrong Mode/Action**: Using build actions in plan mode, etc.
8. **Missing Metadata**: Incomplete response metadata (missing provider, model, usage)

### 6. .well-known/agent.json Discovery

**Purpose:** Allows other A2A systems to discover agent capabilities

**Endpoint:** `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`

**Key Fields:**
- `protocol: "google/a2a"` (required for A2A compliance)
- `capabilities`: Array of supported modes
- `endpoints`: Object with endpoint paths
- `metadata`: Agent-specific information

**Important:** Discovery is **separate from execution**. Discovery uses agent cards, execution uses transport types.

## Skill Created

**Location:** `.claude/skills/transport-types-skill/`

**Files:**
1. `SKILL.md` - Main skill definition with principles, patterns, anti-patterns
2. `VIOLATIONS.md` - Detailed examples of violations and fixes
3. `ENFORCEMENT.md` - Strategy for enforcing transport type compliance
4. `DISCOVERY.md` - Details on .well-known/agent.json discovery
5. `FINDINGS.md` - This document

## Integration Points

This skill integrates with:
- **Execution Context Skill** (Subconversation 1) - Ensures ExecutionContext is included in all A2A requests
- **Quality Gates Skill** - Validates transport types during PR review
- **Codebase Hardening** (Subconversation 9) - Systematic audit of transport type violations
- **Direct Commit Skill** - Validates transport types before committing

## Next Steps

1. **Subconversation 3**: LangGraph Prescriptive Building Pattern
2. **Subconversation 4**: N8N Prescriptive Building Pattern

## User's Key Requirements Met

✅ **Understanding of Transport Types**: Deep dive completed, structure documented  
✅ **A2A Protocol Compliance**: JSON-RPC 2.0 structure documented and enforced  
✅ **Mode-Specific Payloads**: All modes (plan, build, converse, hitl) documented  
✅ **When to Use**: Clear distinction between A2A (transport types) and non-A2A (regular REST)  
✅ **Violation Detection**: Common violations identified and documented  
✅ **Fix Guidance**: Detailed examples of how to fix violations  
✅ **Enforcement Strategy**: Multi-level enforcement approach defined  
✅ **Discovery Mechanism**: .well-known/agent.json documented  

## Notes

- Transport types are the **contract** between frontend and backend - never modify without coordination
- All agent calls MUST follow A2A protocol - this is non-negotiable
- Non-A2A endpoints (data retrieval) don't need transport types - this is intentional
- .well-known/agent.json is for discovery, transport types are for execution - they're separate but both required
- TypeScript compile-time checking is the primary enforcement mechanism
- Runtime validation at API boundaries provides additional safety

