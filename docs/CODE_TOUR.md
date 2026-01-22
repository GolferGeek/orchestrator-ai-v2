# Code Tour

A guided tour through the Orchestrator AI codebase to help you understand the structure and find what you need.

## Project Structure

```
orchestrator-ai-v2/
├── apps/
│   ├── api/              # NestJS API server
│   ├── web/               # Vue.js web application
│   ├── langgraph/         # LangGraph agent implementations
│   └── transport-types/   # Shared TypeScript types
├── demo-agents/           # Example agent (hello-world)
├── docs/                  # Documentation
├── scripts/               # Utility scripts
└── deployment/            # Production deployment configs
```

## Key Directories

### `apps/api/` - The API Server

**Purpose**: Main backend server handling agent execution, authentication, and governance.

**Key Files**:
- `src/main.ts` - Application entry point
- `src/agent2agent/` - Agent execution and A2A protocol
- `src/llms/` - LLM provider integration and routing
- `src/rag/` - RAG (Retrieval-Augmented Generation) implementation
- `src/rbac/` - Role-based access control
- `src/pii/` - PII pseudonymization and handling

**Important Services**:
- `base-agent-runner.service.ts` - Core agent execution logic
- `llm-service-factory.ts` - LLM provider factory
- `centralized-routing.service.ts` - Routes LLM requests to providers
- `rag/query.service.ts` - RAG query execution

### `apps/web/` - The Web Application

**Purpose**: Vue.js frontend for interacting with the platform.

**Key Directories**:
- `src/views/` - Page components
- `src/components/` - Reusable components
- `src/services/` - API client services
- `src/stores/` - Pinia state management

### `apps/langgraph/` - LangGraph Agents

**Purpose**: LangGraph agent implementations as NestJS applications.

**Structure**:
- Each agent is a NestJS module
- Exposes webhook endpoints for execution
- Implements A2A protocol compliance

### `demo-agents/` - Example Agent

**Purpose**: Reference implementation and learning example.

**Contents**:
- `hello-world/` - Simple example agent showing the v2 database-driven structure
- Includes `agent.json` (reference structure) and `README.md` (documentation)
- **Note**: In v2, agents are stored in the database, not as static files. This example shows the structure you'd use when creating agents via the API or web UI.

## Key Concepts & Where to Find Them

### Agent Execution Flow

**Start Here**: `apps/api/src/agent2agent/services/base-agent-runner.service.ts`

**Flow**:
1. Request received → `agents.controller.ts`
2. Authentication checked → Auth guards
3. Agent loaded → `agents.service.ts`
4. Execution → `base-agent-runner.service.ts`
5. PII handling → `pii/` services
6. LLM call → `llms/` services
7. Response → Streaming or final response

### LLM Provider Integration

**Start Here**: `apps/api/src/llms/services/llm-service-factory.ts`

**Key Files**:
- `llm-service-factory.ts` - Creates LLM service instances
- `centralized-routing.service.ts` - Routes to correct provider
- `provider-config.service.ts` - Validates provider config
- `providers/` - Individual provider implementations

### RAG Implementation

**Start Here**: `apps/api/src/rag/query.service.ts`

**Key Components**:
- `query.service.ts` - Main RAG query logic
- `collections.service.ts` - Collection management
- `embeddings.service.ts` - Embedding generation
- `vector-store.service.ts` - Vector database operations

### PII Handling

**Start Here**: `apps/api/src/llms/pii/dictionary-pseudonymizer.service.ts`

**Flow**:
1. Input received → Check dictionary
2. Pattern detection → Identify PII patterns
3. Pseudonymization → Replace with pseudonyms
4. LLM processing → Process with pseudonyms
5. Reverse → Restore original names in output

### RBAC System

**Start Here**: `apps/api/src/rbac/`

**Key Files**:
- Database migrations define roles/permissions
- Guards enforce permissions
- Services check access

## Navigation Tips

### Finding Agent-Related Code

```bash
# Agent execution
apps/api/src/agent2agent/

# Agent definitions
apps/api/src/agents/

# Demo agents
demo-agents/
```

### Finding LLM Code

```bash
# LLM services
apps/api/src/llms/services/

# Provider implementations
apps/api/src/llms/providers/

# Configuration
apps/api/src/llms/config/
```

### Finding RAG Code

```bash
# RAG services
apps/api/src/rag/

# Database schema
apps/api/supabase/migrations/ (search for "rag" or "vector")
```

### Finding Authentication Code

```bash
# Auth guards
apps/api/src/auth/

# User management
apps/api/src/users/

# Supabase auth
apps/api/supabase/ (migrations and config)
```

## Common Tasks & Where to Look

### Adding a New LLM Provider

1. **Create Provider Service**: `apps/api/src/llms/providers/your-provider.service.ts`
2. **Register in Factory**: `apps/api/src/llms/services/llm-service-factory.ts`
3. **Add Configuration**: `apps/api/src/llms/config/model-configuration.service.ts`
4. **Update Types**: `apps/transport-types/` if needed

### Creating a New Agent

1. **Study Existing**: Look at `demo-agents/hello-world/` example for structure reference
2. **Create in Database**: Use web UI, API, or SQL to insert into `agents` table
3. **Define Schema**: Set `io_schema` with input/output JSON Schema
4. **Configure**: Set `context`, `llm_config`, `capabilities`, etc.
5. **Test**: Via web UI or API

**See**: `docs/tutorials/BUILD_FIRST_AGENT.md` for step-by-step guide

### Adding RAG to an Agent

1. **Create Collection**: Via API or Supabase
2. **Upload Documents**: Via RAG API
3. **Configure Agent**: Add `rag_config` to agent
4. **Test**: Query agent with RAG-enabled questions

### Understanding Error Handling

**Start Here**: `apps/api/src/llms/services/llm-error-handling.ts`

**Pattern**:
- Errors are wrapped in `LLMError` class
- User-friendly messages provided
- Error types categorized
- Recovery suggestions included

## Database Schema

**Location**: `apps/api/supabase/migrations/`

**Key Tables**:
- `agents` - Agent definitions
- `organizations` - Multi-tenant organizations
- `rbac_roles` - RBAC role definitions
- `rbac_permissions` - Permission definitions
- `rag_collections` - RAG knowledge bases
- `conversations` - Agent conversation history

**Explore Schema**:
```bash
cd apps/api
supabase db diff
# Or use Supabase Studio: http://127.0.0.1:6015
```

## Testing

**Test Files**: Look for `*.spec.ts` or `*.test.ts`

**Key Test Areas**:
- `apps/api/src/**/*.spec.ts` - Unit tests
- `apps/langgraph/**/*.spec.ts` - LangGraph tests
- `apps/web/**/*.test.ts` - Web component tests

**Run Tests**:
```bash
npm run test
```

## Configuration

**Environment Variables**: `dev.env.example`

**Supabase Config**: `apps/api/supabase/config.toml`

**Application Config**: 
- `apps/api/src/config/` - API configuration
- `apps/web/vite.config.ts` - Web build configuration

## API Endpoints

**API Routes**: `apps/api/src/**/*.controller.ts`

**Key Controllers**:
- `agents.controller.ts` - Agent execution
- `rag.controller.ts` - RAG operations
- `users.controller.ts` - User management
- `organizations.controller.ts` - Organization management

**API Documentation**: See OpenAPI/Swagger (if configured) or controller files

## Frontend Architecture

**State Management**: Pinia stores in `apps/web/src/stores/`

**API Client**: Services in `apps/web/src/services/`

**Routing**: Vue Router in `apps/web/src/router/`

**Components**: Organized by feature in `apps/web/src/components/`

## Deployment

**Production Configs**: `deployment/`

**Docker**: `docker-compose.yml` files

**Scripts**: `scripts/` directory

## Getting Help

- **Code Questions**: Check relevant service files
- **Architecture Questions**: See `ARCHITECTURE.md`
- **Setup Questions**: See `GETTING_STARTED.md`
- **API Questions**: Check controller files and OpenAPI docs

---

**Tip**: Use your IDE's "Go to Definition" feature to navigate the codebase. Most services are well-typed, making navigation easier.
