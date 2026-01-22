# Orchestrator AI Architecture

This document provides a comprehensive overview of the Orchestrator AI architecture, designed for developers, architects, and technical evaluators.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Core Components](#core-components)
3. [Security Architecture](#security-architecture)
4. [Agent Execution Model](#agent-execution-model)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Deployment Architecture](#deployment-architecture)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web UI     │  │  Mobile App   │  │   API Client │          │
│  │  (Vue/Ionic) │  │   (Future)    │  │   (Future)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      API Layer (NestJS)             │
          │  ┌──────────────────────────────┐   │
          │  │  Governed Execution Layer    │   │
          │  │  • A2A Protocol              │   │
          │  │  • PII Pseudonymization      │   │
          │  │  • RBAC & Auth               │   │
          │  │  • Organization Context      │   │
          │  │  • Observability             │   │
          │  └──────────────┬───────────────┘   │
          └─────────────────┼───────────────────┘
                            │
          ┌─────────────────┼───────────────────┐
          │                 │                   │
    ┌─────▼─────┐   ┌──────▼──────┐   ┌───────▼──────┐
    │ LangGraph │   │     N8N     │   │ Future       │
    │  Agents   │   │  Workflows   │   │ Frameworks   │
    └───────────┘   └─────────────┘   └──────────────┘
          │                 │                   │
          └─────────────────┼──────────────────┘
                            │
          ┌─────────────────▼───────────────────┐
          │    Infrastructure Layer              │
          │  ┌──────────┐  ┌──────────┐          │
          │  │ Supabase │  │  Ollama   │          │
          │  │(Postgres)│  │ (Local)  │          │
          │  │ pgvector │  │          │          │
          │  └──────────┘  └──────────┘          │
          └──────────────────────────────────────┘
```

## Core Components

### 1. API Layer (NestJS)

**Location**: `apps/api/`

The API layer provides the **governed execution layer** that wraps all agent execution with:

- **A2A Protocol**: Standardized agent-to-agent communication (JSON-RPC 2.0)
- **PII Protection**: Dictionary-based pseudonymization and pattern detection
- **Authentication**: JWT-based authentication with Supabase
- **Authorization**: RBAC with organization-scoped permissions
- **Observability**: Progress streaming, tracing, and monitoring
- **Organization Context**: Multi-tenant isolation

**Key Modules**:
- `auth/` - Authentication and authorization
- `rbac/` - Role-based access control
- `llms/` - LLM provider abstraction and PII handling
- `rag/` - Retrieval-augmented generation
- `agents/` - Agent management and execution
- `marketing/` - Marketing Swarm workflow (example vertical)

### 2. Web UI (Vue 3 + Ionic)

**Location**: `apps/web/`

The web UI provides:
- Agent catalog and management
- Conversation interface
- Workflow execution and monitoring
- Admin panel for configuration
- Specialized UIs for verticals (e.g., Marketing Swarm)

### 3. LangGraph Engine

**Location**: `apps/langgraph/`

NestJS applications that run LangGraph workflows:
- Each workflow is a separate NestJS application
- Webhook endpoints for task execution
- Status tracking and progress streaming
- Automatic wrapping as API agents

### 4. N8N Integration

**Location**: `storage/n8n-workflows/`

Visual workflow builder integration:
- Workflows stored in database
- API wrapper for execution
- Governance layer applied automatically

### 5. Infrastructure Layer

**Supabase (PostgreSQL + pgvector)**:
- User authentication
- Organization and agent data
- RAG document storage
- Vector similarity search
- Row-level security (RLS) policies

**Ollama (Local LLMs)**:
- LLM inference (recommended)
- Embedding generation
- 100% inside-the-firewall execution

## Security Architecture

### Inside-the-Firewall Design

```
┌─────────────────────────────────────────────────────────┐
│              CUSTOMER INFRASTRUCTURE                    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │   API    │  │ Supabase │  │  Ollama  │             │
│  │ (NestJS) │  │(Postgres)│  │ (Local)  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  🔒 ALL DATA STAYS INSIDE THE FIREWALL                 │
└─────────────────────────────────────────────────────────┘
```

### PII Protection Flow

```
User Input
    ↓
Dictionary Pseudonymization (names, usernames)
    ↓
Pattern Detection (SSN, email, phone)
    ↓
Pattern Redaction (high-risk patterns)
    ↓
LLM Processing (with pseudonyms)
    ↓
Response Generation
    ↓
Reverse Pseudonymization (restore originals)
    ↓
User Response (with originals restored)
```

### Organization Isolation

- **Database Level**: RLS policies enforce organization boundaries
- **API Level**: All queries filtered by `organization_slug`
- **Agent Level**: Agents scoped to organizations
- **RAG Level**: Collections isolated by organization

## Agent Execution Model

### Framework-Agnostic Approach

```
┌─────────────────────────────────────────┐
│      Governed Execution Layer           │
│  (PII, Auth, Observability, Context)    │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼────┐
│Lang   │ │  N8N  │ │ Future │
│Graph  │ │       │ │ Frame- │
│       │ │       │ │ works  │
└───────┘ └───────┘ └────────┘
```

**Key Principle**: The API provides governance, agents can be built in any framework.

### A2A Protocol

Agent-to-Agent communication uses JSON-RPC 2.0:

```typescript
{
  "jsonrpc": "2.0",
  "method": "agent.execute",
  "params": {
    "taskId": "uuid",
    "conversationId": "uuid",
    "content": "user message",
    "context": { /* execution context */ }
  },
  "id": "request-id"
}
```

## Data Flow

### Agent Execution Flow

```
1. User Request
   ↓
2. API Layer (Auth, RBAC, PII Pseudonymization)
   ↓
3. Task Creation (Database)
   ↓
4. Agent Runner (Framework-specific adapter)
   ↓
5. Agent Execution (LangGraph/N8N/etc.)
   ↓
6. Progress Streaming (SSE)
   ↓
7. Response (Reverse PII Pseudonymization)
   ↓
8. User Receives Response
```

### RAG Query Flow

```
1. User Query
   ↓
2. Query Embedding (Ollama - local)
   ↓
3. Vector Search (pgvector - local)
   ↓
4. Context Retrieval
   ↓
5. LLM Generation (Ollama - local)
   ↓
6. Response with Citations
```

**All steps run inside the firewall.**

## Technology Stack

### Backend
- **NestJS** - API framework
- **TypeScript** - Type safety
- **Supabase** - Database and auth
- **PostgreSQL** - Relational database
- **pgvector** - Vector similarity search

### Frontend
- **Vue 3** - UI framework
- **Ionic** - Mobile-ready components
- **TypeScript** - Type safety

### Agent Frameworks
- **LangGraph** - Multi-step agentic workflows
- **N8N** - Visual workflow builder
- **Future**: CrewAI, AutoGen, etc.

### LLM Infrastructure
- **Ollama** - Local LLM execution (recommended)
- **OpenAI** - Cloud provider (optional)
- **Anthropic** - Cloud provider (optional)
- **Google** - Cloud provider (optional)

### Observability
- **Helicone** - LLM tracing (optional)
- **LangSmith** - LangChain tracing (optional)
- **Custom** - Built-in progress streaming

## Deployment Architecture

### Development
```
Direct Node.js execution
├── API: localhost:6100
├── Web: localhost:6101
└── Supabase: localhost:6010
```

### Production
```
Docker Compose or Kubernetes
├── API: Port 9000
├── Web: Port 9001
├── Supabase: Self-hosted or Supabase Cloud
└── Ollama: Self-hosted
```

### Access Patterns
- **Tailscale** - VPN access
- **Cloudflare Tunnels** - Public access with secure tunnels
- **Internal Network** - Direct access inside firewall

## Key Architectural Principles

### 1. No Fallbacks or Hardcoded Defaults

**Explicit configuration required** - no silent fallbacks:

```typescript
// ❌ FORBIDDEN
const provider = config.provider || 'openai';

// ✅ REQUIRED
if (!config.provider || !config.model) {
  throw new Error('LLM provider and model must be explicitly configured');
}
```

### 2. Framework-Agnostic Execution

The API is the governed execution layer. Agents can be built in any framework and wrapped with governance.

### 3. Inside-the-Firewall First

Designed for self-hosted deployment with local LLM execution as the default and recommended approach.

### 4. Security by Design

- PII protection built-in
- Organization isolation at every layer
- RBAC with fine-grained permissions
- Audit logging throughout

## Extension Points

### Adding a New Agent Framework

1. Create adapter in `apps/api/src/agents/runners/`
2. Implement `AgentRunner` interface
3. Register in agent execution service
4. Agents built in that framework automatically get governance

### Adding a New LLM Provider

1. Create service in `apps/api/src/llms/services/`
2. Extend `BaseLLMService`
3. Register in provider config service
4. Configure via environment variables

### Adding a New Vertical

1. Create module in `apps/api/src/` (e.g., `legal/`)
2. Define schema in `apps/api/supabase/migrations/`
3. Create specialized UI in `apps/web/`
4. Register workflows/agents

## Further Reading

- [API Documentation](docs/api/README.md)
- [Agent Development Guide](docs/agents/README.md)
- [A2A Protocol Specification](docs/a2a/README.md)
- [RAG Documentation](specs/prd-phase-6-rag-infrastructure.md)
- [RBAC Documentation](specs/prd-rbac-permissions.md)

---

For questions about architecture, contact: golfergeek@orchestratorai.io
