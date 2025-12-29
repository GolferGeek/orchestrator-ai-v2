# OrchestratorAI Architectural Decisions: Complete Reference

**Date:** 2025-01-27  
**Purpose:** Complete list of architectural decisions for OrchestratorAI for AI Solutions Architect conversations

---

## Table of Contents

1. [Core Architecture Principles](#core-architecture-principles)
2. [Database Architecture](#database-architecture)
3. [Agent Architecture](#agent-architecture)
4. [Protocol Decisions](#protocol-decisions)
5. [Deployment Architecture](#deployment-architecture)
6. [Security Architecture](#security-architecture)
7. [Interview Questions & Answers](#interview-questions--answers)

---

## Core Architecture Principles

### 1. Database as Source of Truth

**Decision:** All agent definitions stored in database, not files.

**Why:**
- Dynamic agent creation (no code deployment)
- User-customizable via UI
- Single source of truth
- Version control through database records

**Trade-offs:**
- ✅ Instant availability
- ✅ User-customizable
- ✅ No deployment needed
- ⚠️ Requires database management

### 2. Multi-Agent Orchestration

**Decision:** Orchestrator agents coordinate specialist agents.

**Why:**
- Complex workflows require coordination
- Specialization improves quality
- Scalable architecture
- Natural delegation pattern

**Trade-offs:**
- ✅ Scalable
- ✅ Specialized agents
- ✅ Complex workflows
- ⚠️ More complex than single agent

### 3. A2A Protocol Standardization

**Decision:** Use JSON-RPC 2.0 + A2A extensions for agent communication.

**Why:**
- Standardized communication
- Interoperability
- Well-supported protocol
- Clear contracts

**Trade-offs:**
- ✅ Standardized
- ✅ Interoperable
- ✅ Well-documented
- ⚠️ Requires protocol compliance

### 4. Progressive Context Structure

**Decision:** Rules → Commands → Skills → Agents context hierarchy.

**Why:**
- Prevents context overload
- Reusable patterns
- Scalable approach
- Clear organization

**Trade-offs:**
- ✅ Organized
- ✅ Reusable
- ✅ Scalable
- ⚠️ Requires discipline

### 5. Inside-the-Firewall First

**Decision:** Designed for self-hosted, inside-the-firewall deployment.

**Why:**
- Data sovereignty
- Regulatory compliance
- Security control
- Customer requirements

**Trade-offs:**
- ✅ Data sovereignty
- ✅ Compliance
- ✅ Security control
- ⚠️ Higher infrastructure costs

---

## Database Architecture

### Four-Database Architecture

**Decision:** Separate databases for different concerns.

**Databases:**

1. **`postgres` (Main Orchestrator AI)**
   - Agents, conversations, tasks
   - Organizations, users
   - Plans, deliverables
   - Connection: `DATABASE_URL`

2. **`rag_data` (RAG Infrastructure)**
   - Collections, documents
   - Vector embeddings
   - Connection: `RAG_DATABASE_URL`

3. **`n8n` (N8N Workflow Automation)**
   - N8N workflows
   - N8N internal connection

4. **`observability` (Observability Events)**
   - Multi-agent events
   - Analytics data
   - Observability service connection

**Why Separate:**
- **Isolation:** Each concern has own lifecycle
- **Performance:** Vector ops don't impact transactions
- **Security:** Service-level access control
- **Backup/Restore:** Independent strategies

**NEVER consolidate these databases.**

### Environment-Specific Databases

**Decision:** Separate databases per environment (dev, staging, production).

**Structure:**
```
orchestrator_ai_dev          → Development
orchestrator_ai_staging      → Staging
orchestrator_ai_production   → Production
```

**Why:**
- Environment isolation
- Independent testing
- Safe production deployment
- Clear separation

---

## Agent Architecture

### Agent Types

**Decision:** Support multiple agent architectures.

**Types:**

1. **Context Agents:**
   - LLM-based
   - Create deliverables
   - Conversational

2. **Conversation-Only Agents:**
   - Chat-based
   - No outputs
   - Pure conversation

3. **Function Agents:**
   - Execute code
   - Deterministic
   - Tool-focused

4. **API Agents:**
   - Delegate to external services
   - n8n integration
   - External APIs

5. **Orchestrator Agents:**
   - Coordinate other agents
   - Multi-agent workflows
   - Project management

**Why Multiple Types:**
- Different use cases
- Right tool for right job
- Flexibility
- Scalability

### Agent Discovery

**Decision:** `.well-known/agent.json` for agent metadata.

**Endpoint:**
```
GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json
```

**Why:**
- Machine-readable metadata
- Agent discovery
- Capability description
- Standardized format

### Agent Execution Modes

**Decision:** Support multiple execution modes.

**Modes:**

1. **`plan`:** Create plans/strategies
2. **`build`:** Execute/build deliverables
3. **`converse`:** Conversational interaction
4. **`orchestrate`:** Coordinate multiple agents

**Why:**
- Different work types
- Clear contracts
- Standardized responses
- Composable workflows

---

## Protocol Decisions

### JSON-RPC 2.0 Base

**Decision:** Use JSON-RPC 2.0 as transport protocol.

**Why:**
- Standardized
- Well-supported
- Language-agnostic
- Clear error handling

**Structure:**
```json
{
  "jsonrpc": "2.0",
  "method": "build",
  "params": { ... },
  "id": "request-123"
}
```

### A2A Extensions

**Decision:** Extend JSON-RPC with A2A-specific structures.

**Extensions:**

1. **TaskRequestParams:**
   - ExecutionContext capsule
   - Task modes
   - Payload structure
   - User messages

2. **TaskResponse:**
   - Success/failure
   - Payload structure
   - Metadata
   - Error handling

**Why:**
- Agent-specific needs
- Standardized agent communication
- Clear contracts
- Interoperability

### ExecutionContext Capsule

**Decision:** Context travels whole, never cherry-picked.

**Why:**
- Consistency
- No context loss
- Single source of truth
- Easier debugging

**Contents:**
- Organization & user IDs
- Conversation & task IDs
- LLM provider/model
- Agent information
- Custom metadata

---

## Deployment Architecture

### Self-Hosted First

**Decision:** Designed for self-hosted, inside-the-firewall deployment.

**Why:**
- Data sovereignty
- Regulatory compliance
- Security control
- Customer requirements

**Deployment Options:**

1. **Development:**
   - Direct Node.js (`npm run dev`)
   - Port: 6100
   - Access: Localhost

2. **Staging:**
   - Direct Node.js or Docker
   - Port: 7100
   - Access: Internal network

3. **Production:**
   - Docker Compose
   - Port: 9000
   - Access: Internal network

### Access Patterns

**Decision:** Support multiple access methods.

**Methods:**

1. **Tailscale (Private):**
   - VPN access
   - Secure
   - Team access

2. **Cloudflare Tunnels (Public):**
   - Public access
   - Secure tunnels
   - Customer demos

3. **Internal Network:**
   - Direct access
   - Inside firewall
   - Production use

**Why:**
- Flexibility
- Security options
- Different use cases
- Customer requirements

---

## Security Architecture

### PII Pseudonymization

**Decision:** Dictionary-based pseudonymization with pattern detection.

**Why:**
- Reversible (can restore originals)
- Maintains data utility
- Organization/agent-scoped
- Auditable

**Process:**
1. Dictionary pseudonymization (names, usernames)
2. Pattern detection (SSN, email, phone)
3. Pattern redaction (high-risk patterns)
4. LLM processing (with pseudonyms)
5. Reverse pseudonymization (restore originals)

### Multi-Provider LLM Support

**Decision:** Support multiple LLM providers with abstraction layer.

**Providers:**
- OpenAI
- Anthropic
- Google
- Local (Ollama)

**Why:**
- Vendor flexibility
- Cost optimization
- Risk mitigation
- Customer choice

**Abstraction:**
- Provider-agnostic interface
- Consistent API
- Easy provider switching
- Cost tracking

### No Fallbacks or Hardcoded Defaults

**Decision:** Explicit configuration required, no silent fallbacks.

**Why:**
- Predictable behavior
- Clear errors
- No surprises
- Better debugging

**Pattern:**
```typescript
// ❌ FORBIDDEN
const provider = config.provider || 'openai';

// ✅ REQUIRED
if (!config.provider) {
  throw new Error('Provider must be explicitly configured');
}
```

---

## Interview Questions & Answers

### High-Level Questions

**Q: What are the key architectural decisions in OrchestratorAI?**
**A:**
**Core Decisions:**

1. **Database as Source of Truth:**
   - All agents in database
   - Dynamic creation
   - No code deployment needed

2. **Multi-Agent Orchestration:**
   - Orchestrator coordinates specialists
   - Scalable architecture
   - Complex workflows

3. **A2A Protocol:**
   - JSON-RPC 2.0 + A2A extensions
   - Standardized communication
   - Interoperability

4. **Four-Database Architecture:**
   - Separate databases per concern
   - Isolation and performance
   - Independent scaling

5. **Inside-the-Firewall First:**
   - Self-hosted deployment
   - Data sovereignty
   - Regulatory compliance

**Q: Why did you choose a four-database architecture?**
**A:**
**Reasons:**

1. **Isolation:**
   - Each concern has own lifecycle
   - Independent scaling
   - Separate backup strategies

2. **Performance:**
   - Vector operations (RAG) don't impact transactions
   - Optimized per database type
   - No cross-database queries

3. **Security:**
   - Service-level access control
   - Principle of least privilege
   - Isolated attack surface

4. **Maintenance:**
   - Independent updates
   - Clear ownership
   - Easier troubleshooting

**NEVER consolidate these databases** - separation is intentional.

**Q: How does the agent architecture work?**
**A:**
**Architecture:**

1. **Agent Types:**
   - Context agents (LLM-based)
   - Conversation-only (chat)
   - Function agents (code execution)
   - API agents (external services)
   - Orchestrator agents (coordination)

2. **Execution Modes:**
   - `plan` - Create plans
   - `build` - Execute/build
   - `converse` - Conversation
   - `orchestrate` - Coordinate

3. **Discovery:**
   - `.well-known/agent.json`
   - Machine-readable metadata
   - Capability description

4. **Communication:**
   - A2A protocol (JSON-RPC 2.0)
   - Standardized requests/responses
   - ExecutionContext capsule

### Mid-Level Technical Questions

**Q: Why did you choose JSON-RPC 2.0 for A2A?**
**A:**
**Reasons:**

1. **Standardization:**
   - Well-established protocol
   - Language-agnostic
   - Tool support

2. **Error Handling:**
   - Standardized error codes
   - Clear error structure
   - Consistent handling

3. **Extensibility:**
   - Easy to extend with A2A structures
   - Backward compatible
   - Future-proof

4. **Interoperability:**
   - Works with any language
   - Standard HTTP transport
   - Easy integration

**A2A Extensions:**
- TaskRequestParams structure
- TaskResponse structure
- ExecutionContext capsule
- Task modes

**Q: How does the ExecutionContext capsule work?**
**A:**
**Key Principle:** Context travels whole, never cherry-picked.

**Why:**
- Consistency across system
- No context loss
- Single source of truth
- Easier debugging

**Contents:**
- Organization & user IDs
- Conversation & task IDs
- LLM provider/model config
- Agent information
- Custom metadata

**Flow:**
```
Frontend → Builds context → API → Agent → Updates context → Returns → Frontend updates store
```

**Benefits:**
- No context loss between calls
- Consistent state
- Easier debugging
- Clear data flow

**Q: Why did you choose dictionary-based pseudonymization?**
**A:**
**Reasons:**

1. **Reversible:**
   - Can restore originals
   - User-facing responses need originals
   - Maintains data utility

2. **Scoped:**
   - Organization/agent-specific dictionaries
   - Isolated pseudonyms
   - Customizable per context

3. **Auditable:**
   - All mappings tracked in database
   - Complete audit trail
   - Compliance support

4. **Pattern Detection:**
   - Also detects SSN, email, phone
   - Redacts high-risk patterns
   - Comprehensive coverage

**Process:**
1. Dictionary pseudonymization (names, usernames)
2. Pattern detection (SSN, email, phone)
3. Pattern redaction (high-risk)
4. LLM processing (with pseudonyms)
5. Reverse pseudonymization (restore originals)

**Q: Why no fallbacks or hardcoded defaults?**
**A:**
**Problems with Fallbacks:**

1. **Silent Failures:**
   - System appears to work
   - Uses wrong configuration
   - Hard to debug

2. **Hidden Dependencies:**
   - Relies on fallbacks
   - May not work in production
   - Unpredictable behavior

3. **Configuration Drift:**
   - Real config gets ignored
   - Fallbacks "work" but wrong
   - Difficult to diagnose

**Solution:**
- Explicit configuration required
- Clear errors when missing
- Fail fast philosophy
- Predictable behavior

**Pattern:**
```typescript
// ❌ FORBIDDEN
const provider = config.provider || 'openai';

// ✅ REQUIRED
if (!config.provider) {
  throw new Error('Provider must be explicitly configured');
}
```

---

## Key Architectural Patterns

### Pattern 1: Agent Runner Pattern

**Decision:** All agents use BaseAgentRunner pattern.

**Why:**
- Consistent execution
- Reusable logic
- Easy to extend
- Clear structure

**Structure:**
```typescript
class BaseAgentRunner {
  async execute(definition, request): Promise<Response> {
    // Common execution logic
  }
}

class ContextAgentRunner extends BaseAgentRunner {
  // Context-specific logic
}
```

### Pattern 2: Store-First Context

**Decision:** Context stored in frontend store, not passed as parameters.

**Why:**
- Single source of truth
- No context loss
- Easier debugging
- Consistent state

**Flow:**
- Frontend: Store context
- API: Gets context from request
- Agent: Uses context
- Response: Returns updated context
- Frontend: Updates store

### Pattern 3: Transport Types

**Decision:** Shared TypeScript types for protocol contracts.

**Why:**
- API and Web use same types
- Type safety
- Protocol compliance
- Easy maintenance

**Location:** `apps/transport-types/`

**Usage:** Always import from `@orchestrator-ai/transport-types`

---

## Key Takeaways

### For AI Architects

1. **Database-Driven:**
   - Agents in database
   - Dynamic creation
   - No deployment needed

2. **Multi-Agent:**
   - Orchestrator coordinates specialists
   - Scalable architecture
   - Complex workflows

3. **Standardized Protocols:**
   - JSON-RPC 2.0 + A2A
   - Interoperability
   - Clear contracts

4. **Security First:**
   - PII pseudonymization
   - Inside-the-firewall
   - Explicit configuration

5. **Progressive Context:**
   - Rules → Commands → Skills → Agents
   - Organized approach
   - Scalable

---

## References

- **Architecture Summary:** `obsidian/Team Vaults/Matt/Product Hardening/14-Final-Architecture-Summary.md`
- **Database Architecture:** `obsidian/docs/archive/general/CLAUDE.md`
- **Agent Vision:** `obsidian/docs/feature/matt/agent-rollout/high-level-vision-prd.md`
- **Orchestration PRD:** `obsidian/docs/feature/matt/orchestration-system-prd.md`
- **A2A Protocol:** `obsidian/efforts/Matt/agent-roles/agent-expertise/agent2agent-protocol.md`

---

**See Also:**
- [A2A-Protocol-Deep-Dive.md](./A2A-Protocol-Deep-Dive.md) - A2A protocol details
- [MCP-Architecture-Deep-Dive.md](./MCP-Architecture-Deep-Dive.md) - MCP protocol details
- [PII-Security-Certifications-Guide.md](./PII-Security-Certifications-Guide.md) - Security details

