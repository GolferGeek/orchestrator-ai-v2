# Product Requirements Document: Create v2 Start

## Overview

Prepare the Orchestrator AI v2 repository for public release as an educational training resource. This repository will serve as a comprehensive example and training exercise for building agent orchestration systems. The goal is to create a clean, well-structured codebase that demonstrates best practices for multi-agent systems using Orchestrator AI API and LangGraph. Note: N8n workflows exist in the repository for intern prototype development but are not part of the v2-start user-facing features.

This PRD defines the **v2-start** state of the repository. Advanced and production-grade features (including advanced RAG strategies, observability UI improvements, and more complex agents) are specified separately in `docs/prd/v2-final-solution.md`.

## Goals

1. Clean and organize the codebase for public consumption
2. Finalize core data structures (agent table, agent JSON schema)
3. Restructure file organization for clarity
4. Implement unified streaming and observability
5. Implement Human-in-the-Loop (HITL) architecture
6. Establish proper LangGraph agent architecture
7. Create comprehensive documentation and setup guides
8. Remove sensitive data and prepare seed files
9. Ensure clean starting state for educational videos

## Target Audience

- Developers learning agent orchestration
- Teams building multi-agent systems
- Students and educators in AI/ML
- Open source contributors

---

## Section 1: Core Agent Infrastructure

### 1.1 Finalize Agent Table Structure

**Priority:** Critical  
**Description:** Define and implement the final agent table schema with comprehensive columns to support all agent types and frameworks.

**Requirements:**
- Single table design with comprehensive columns
- Support for multiple frameworks (langgraph, orchestrator-ai-api)
- Note: N8n framework support exists for intern prototypes but is not part of v2-start user-facing features
- Store agent JSON/YAML definitions
- Track agent metadata, status, and configuration
- Support for framework-specific configuration

**Acceptance Criteria:**
- Table schema defined with all required columns
- Migration script created
- Agent JSON files can be synced to database
- Query performance optimized with proper indexes
- Documentation of table structure and relationships

**Key Columns (to be finalized):**
- Core identity: id, name, slug, description
- Framework: framework_type, framework_version, framework_config
- Storage: agent_json_path, graph_path (langgraph)
- Status: active, created_at, updated_at, version
- Metadata: tags, organization_slug, department, capabilities (JSONB)

**Important Agent Structure Notes:**
- **Department Field:** Agents include a `department` field for categorization (e.g., "platform", "marketing", "hr", "engineering", "design"). This is separate from `organization_slug` which handles access control and data isolation.
- **Orchestrator Agent:** There is ONE Orchestrator agent (infrastructure component), not multiple orchestrator agents. The Orchestrator agent exists outside the organization/department hierarchy and coordinates all other agents. We do NOT use orchestrator agents as departments - there is only one Orchestrator agent.

### 1.2 Finalize Agent JSON/YAML Structure

**Priority:** Critical  
**Description:** Define the final agent JSON/YAML schema that serves as the source of truth for agent definitions.

**Requirements:**
- YAML or JSON format (YAML preferred for readability)
- Include `.well-known/agent.json` compatible fields
- Framework-specific configuration sections
- Clear required vs optional fields
- Validation schema

**Acceptance Criteria:**
- Agent JSON/YAML schema documented
- Validation script/function created
- Example agent files created
- Migration script to sync files → database
- Documentation with examples

**Key Fields (to be finalized):**
- Standard A2A fields (.well-known/agent.json compatibility)
- Framework configuration (LangGraph graph reference, orchestrator-ai-api config)
- Runtime configuration (environment variables, secrets references)
- Documentation (examples, use cases, parameters)
- Department field (for agent categorization, separate from organization)

**Important Agent Structure Notes:**
- **Department Field:** Agent JSON/YAML includes a `department` field for categorization. This allows filtering and discovery of agents by department across organizations.
- **Orchestrator Agent:** There is ONE Orchestrator agent (infrastructure), not orchestrator agents as departments. The Orchestrator agent coordinates all other agents and exists outside the organization/department hierarchy.

---

## Section 2: File Restructuring

### 2.1 Agent Files Organization

**Priority:** High  
**Description:** Move agent JSON/YAML files to proper location and organize by structure.

**Requirements:**
- Move agent JSON files to `apps/api/agents/`
- Organize by category/type if needed
- Maintain clear directory structure
- Update all references to agent file paths

**Acceptance Criteria:**
- All agent files in `apps/api/agents/`
- Directory structure documented
- All code references updated
- Scripts updated to use new paths

### 2.2 N8n Workflows Organization

**Priority:** Low  
**Description:** Organize N8n JSON exports for intern prototype development. Note: N8n agents are not part of v2-start user-facing features - they are for intern prototype work only.

**Requirements:**
- Move N8n JSON exports to `apps/n8n/workflows/`
- Organize by agent/workflow
- Maintain workflow versioning if needed
- Update references
- Document that these are for intern prototypes, not v2-start

**Acceptance Criteria:**
- All N8n workflows in `apps/n8n/workflows/`
- Directory structure documented
- Setup scripts reference correct paths
- Clear documentation that N8n is not part of v2-start user experience

### 2.3 Supabase Migrations Organization

**Priority:** High  
**Description:** Organize Supabase migrations and snapshots.

**Requirements:**
- Move migrations to `apps/api/supabase/migrations/`
- Move snapshots to `apps/api/supabase/snapshots/`
- Clean up `storage/` directory
- Update migration scripts

**Acceptance Criteria:**
- All migrations in `apps/api/supabase/migrations/`
- Snapshots organized in `apps/api/supabase/snapshots/`
- `storage/` directory cleaned up
- Migration scripts updated

### 2.4 Scripts Organization

**Priority:** Medium  
**Description:** Move appropriate scripts to their respective locations and clean up.

**Requirements:**
- Move agent-related scripts to `apps/api/scripts/`
- Move N8n scripts to `apps/n8n/scripts/`
- Move LangGraph scripts to `apps/langgraph/scripts/`
- Keep only essential root-level scripts
- Remove one-off/temporary scripts

**Acceptance Criteria:**
- Scripts organized by application
- Root-level scripts minimal and essential
- All scripts documented
- No orphaned scripts

---

## Section 3: Project Cleanup

### 3.1 Code Cleanup

**Priority:** High  
**Description:** Remove unnecessary files and clean up codebase structure.

**Requirements:**
- Remove most JavaScript files (keep TypeScript)
- Remove outdated/unused tests
- Clean up temporary files
- Remove experimental code
- Organize remaining code logically

**Acceptance Criteria:**
- No JavaScript files (except build outputs)
- Only essential tests remain
- Codebase is clean and organized
- No temporary/experimental code

### 3.2 Obsidian Directory Handling

**Priority:** Medium  
**Description:** Decide and implement handling of Obsidian directory.

**Requirements:**
- Decide: gitignore or remove
- If gitignore: add to .gitignore
- If remove: delete directory
- Document decision

**Acceptance Criteria:**
- Obsidian directory handled (gitignored or removed)
- Decision documented
- No Obsidian files in repository (if removed)

### 3.3 Admin UI Cleanup

**Priority:** Medium  
**Description:** Remove unused auth page, add full user management UI (CRUD), and clean up admin UI.

**Requirements:**
- Remove unused auth page
- Add user management UI (instead of requiring Supabase access)
- **Create:** User creation form with required fields (email, password, display name, role, org slug)
- **Read:** User list/view with all user details
- **Update:** User edit form (email, display name, role, org slug, password reset by admin)
- **Delete:** User deletion with confirmation
- Support for changing organization slugs (org slugs)
- **User self-service:** Allow users to change their own password (user profile/settings)
- Keep simple role-based system
- Clean up UI components
- Ensure consistent styling

**Acceptance Criteria:**
- Unused auth page removed
- Full user management UI implemented (Create, Read, Update, Delete)
- Users can be managed through admin UI (no Supabase access required)
- Organization slugs can be updated
- User roles can be updated
- Admin password reset functionality available
- Users can change their own password through profile/settings
- Admin UI is clean and functional
- Role-based system works correctly
- No broken references

---

## Section 4: Configuration & Environment

### 4.1 Port Configuration

**Priority:** High  
**Description:** Change default port from 6100 to 6100.

**Requirements:**
- Update all port references to 6100
- Update documentation
- Update environment variables
- Update docker-compose if applicable

**Acceptance Criteria:**
- Application runs on port 6100
- All references updated
- Documentation updated
- No hardcoded 6100 references

### 4.2 Service Auto-Start Removal

**Priority:** Critical  
**Description:** Remove auto-start of Supabase and N8n services for clean educational setup.

**Requirements:**
- Services should NOT auto-start
- User must manually start services
- Clear setup instructions provided
- Scripts available for manual startup

**Acceptance Criteria:**
- No auto-start of Supabase
- No auto-start of N8n
- Setup scripts available
- Documentation explains manual startup

### 4.3 .env.example Cleanup

**Priority:** High  
**Description:** Create comprehensive, well-organized .env.example file.

**Requirements:**
- All required variables documented
- Clear comments explaining each variable
- Organized by category (Database, LangGraph, LLM providers, etc.)
- Note: N8n configuration exists for intern prototypes but is not part of v2-start
- Example values (non-sensitive)
- Required vs optional clearly marked
- Default values where appropriate

**Acceptance Criteria:**
- .env.example is comprehensive
- All variables documented
- Well-organized by category
- Clear comments and examples
- No sensitive data

**Categories:**
- Database/Supabase configuration
- N8n configuration (optional; only needed if you enable the N8n jokes agent)
- LangGraph configuration
- LLM provider API keys
- Orchestrator AI configuration
- Ports and URLs
- Feature flags
- Development/testing flags

---

## Section 5: Database Architecture

### 5.1 Multiple Databases in Single Instance

**Priority:** Critical  
**Description:** Configure Supabase instance with multiple databases for isolation.

**Requirements:**
- Single Supabase instance
- Multiple databases: `orchestrator_ai`, `n8n_data`, `company_data`, `rag_data`
- Reset one database without affecting others
- Proper connection management
- Migration scripts target specific databases

**Acceptance Criteria:**
- Multiple databases configured
- Each database isolated
- Reset scripts work per-database
- Connection strings documented
- Migration scripts updated

**Database Structure:**
- `orchestrator_ai` - Main application database (v2-start)
- `n8n_data` - N8n workflow data (for intern prototypes, not v2-start user-facing)
- `company_data` - User/company data (optional)
- `rag_data` - RAG (Retrieval Augmented Generation) data and embeddings (v2-start)

### 5.1.1 RAG Database Structure

**Priority:** High  
**Description:** Design RAG database to support multiple RAG efforts/collections. Initial schema should be extensible for advanced RAG strategies that require additional columns and different embedding strategies.

**Requirements:**
- Separate `rag_data` database for RAG operations
- Support multiple RAG efforts/collections in same database
- Each RAG effort has its own namespace/prefix or table structure
- Vector storage for embeddings (using pgvector or similar)
- Document metadata storage
- Collection/chunk management
- Proper indexing for vector search
- **Extensible schema** for advanced RAG strategies (additional columns will be needed)
- **Support for different embedding strategies** (different embedding models, chunking strategies)
- **Flexible embedding storage** (different approaches for different RAG strategies)

**Acceptance Criteria:**
- RAG database configured
- Multiple RAG efforts can coexist
- Vector search works efficiently
- Document storage and retrieval functional
- Proper isolation between RAG efforts
- Schema is extensible for future advanced strategies
- Support for multiple embedding strategies

**RAG Database Design:**

**Initial Schema (Basic RAG):**
- **Collections/Namespaces:** Each RAG effort has its own collection (e.g., `agent_contexts`, `knowledge_base`, `documentation`)
- **Tables/Structure:**
  - `rag_collections` - Metadata for each RAG effort
    - `id`, `name`, `description`, `embedding_model`, `chunking_strategy`, `created_at`, `updated_at`
  - `rag_documents` - Document storage with collection_id
    - `id`, `collection_id`, `title`, `content`, `metadata` (JSONB), `created_at`
  - `rag_embeddings` - Vector embeddings with document_id
    - `id`, `document_id`, `chunk_id`, `embedding` (vector), `embedding_model`, `created_at`
  - `rag_chunks` - Text chunks with document_id
    - `id`, `document_id`, `content`, `chunk_index`, `metadata` (JSONB), `created_at`
- **Isolation:** Use `collection_id` or namespace prefix to separate efforts
- **Vector Search:** pgvector extension for similarity search

**Future Schema Extensions (Advanced RAG Strategies):**
- Advanced RAG strategies will require additional columns and different embedding strategies
- See `docs/prd/v2-final-solution.md` for detailed schema extensions
- Initial schema designed to be extensible without breaking basic RAG functionality

### 5.2 Organizations Table

**Priority:** Medium  
**Description:** Create an organizations table to provide a single source of truth for organization data. Currently `organization_slug` is stored as TEXT in multiple tables (agents, conversations, users, pseudonym_dictionaries, etc.) without a central organization definition.

**Current State:**
- `organization_slug` exists as TEXT field in multiple tables:
  - `agents.organization_slug`
  - `conversations.organization_slug`
  - `users.organization_slug`
  - `pseudonym_dictionaries.organization_slug`
- No dedicated `organizations` table exists
- Organization slugs are just strings (e.g., "my-org", "demo", "acme-corp")
- No organization metadata or settings storage

**Requirements:**
- Create `organizations` table with:
  - `slug` TEXT PRIMARY KEY (not UUID - slug is the identifier)
  - `name` TEXT (display name)
  - `description` TEXT (optional)
  - `url` TEXT (optional - organization URL/website)
  - `settings` JSONB (optional - organization-level settings)
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ
- Consider adding foreign key constraints from other tables to `organizations(slug)`
- Migration to populate organizations table from existing slugs
- Seed file for default organizations

**Design Decision:**
- Use `slug` as PRIMARY KEY (not UUID) - simpler, more readable
- Slug serves as both identifier and human-readable name
- Optional URL field for organization website/domain
- JSONB settings field for future extensibility

**Acceptance Criteria:**
- `organizations` table created
- Migration populates table from existing slugs
- Foreign key relationships considered/implemented
- Seed file includes default organizations
- Documentation updated

**Note:** This is a foundational change that will improve data integrity and enable future organization-level features. Consider whether to implement foreign key constraints immediately or defer to v2-final-solution.

---

### 5.3 Seed Files Creation

**Priority:** High  
**Description:** Create seed files for initial data setup.

**Requirements:**
- Seed file for organizations (default organizations)
- Seed file for agents (three starting agents)
- Seed file for providers (LLM providers)
- Seed file for models (LLM models)
- Seed file for other essential data
- Script to run all seeds

**Acceptance Criteria:**
- Seed files created for all essential data
- Seed script runs successfully
- Data matches final agent JSON files
- Documentation for running seeds
- Agent seeds include the three core starting agents (Blog Post Writer, Marketing Swarm, HR Assistant)
- Optional agents (Jokes, Metrics) may use separate or additional seed scripts as needed

### 5.4 Supabase Setup Flow (For Learners)

**Priority:** High  
**Description:** Document a clear, step-by-step Supabase setup flow for learners following the v2-start code-along.

**Requirements:**
- High-level checklist learners can follow:
  - Install Supabase/CLI or follow provided setup scripts
  - Create a local Supabase instance with the required databases:
    - `orchestrator_ai` (main app)
    - `n8n_data` (optional, for N8n prototypes)
    - `company_data` (optional)
    - `rag_data` (RAG collections/embeddings)
  - Run all migrations for each database
  - Run seed scripts (organizations, providers, models, three starting agents)
  - Verify setup (e.g., via a simple health/check script or Supabase dashboard)
- Reference existing setup scripts in `scripts/` or `apps/api/supabase/`
- Clearly mark which steps are required for v2-start vs optional (e.g., N8n)

**Acceptance Criteria:**
- Supabase setup flow documented in Getting Started / README
- Learners can follow the checklist to get all databases/migrations/seeds in place
- Clear distinction between required and optional steps

---

## Section 6: RAG Infrastructure

### 6.1 RAG Backend API

**Priority:** High  
**Description:** Create comprehensive RAG backend API with endpoints for all RAG operations. Focus on basic endpoints to start, especially the document ingestion endpoint which is critical for building RAG collections.

**Requirements:**
- REST API endpoints for RAG operations
- **Critical:** Document ingestion endpoint (build/ingest RAG collections)
- Collection management (create, read, update, delete)
- Document ingestion pipeline (upload, process, chunk, embed)
- Query/search endpoints (vector similarity search)
- Embedding generation and storage
- Support for multiple RAG levels (basic to advanced)
- All RAG functionality encapsulated in one unified API

**Acceptance Criteria:**
- RAG API endpoints implemented
- **Document ingestion endpoint fully functional** (critical for building RAG)
- Collection CRUD operations work
- Document ingestion pipeline functional (chunking, embedding, storage)
- Vector search works efficiently
- Multiple RAG levels supported
- API documented with examples

**RAG Endpoints (Basic Set for v2-start):**

**Collection Management:**
- `POST /api/rag/collections` - Create collection
- `GET /api/rag/collections` - List collections
- `GET /api/rag/collections/{id}` - Get collection details
- `PUT /api/rag/collections/{id}` - Update collection
- `DELETE /api/rag/collections/{id}` - Delete collection

**Document Ingestion (Critical):**
- `POST /api/rag/collections/{id}/documents` - **Ingest document** (upload, chunk, embed, store)
  - Accepts: text content, file uploads, or document references
  - Processes: chunks text, generates embeddings, stores in vector database
  - Returns: document ID and ingestion status
- `GET /api/rag/collections/{id}/documents` - List documents in collection
- `DELETE /api/rag/collections/{id}/documents/{docId}` - Delete document

**Query/Search:**
- `POST /api/rag/collections/{id}/query` - Query/search collection
  - Accepts: query text, strategy, top_k, similarity_threshold
  - Returns: retrieved documents/chunks with similarity scores

**Embedding (Optional for v2-start):**
- `POST /api/rag/collections/{id}/embed` - Generate embeddings (if needed separately)

### 6.2 RAG Frontend UI

**Priority:** High  
**Description:** Create RAG management frontend for managing collections, documents, and testing queries.

**Requirements:**
- Collection management UI (create, view, edit, delete)
- Document upload and management interface
- Query/testing interface (test RAG queries)
- Embedding visualization (if applicable)
- Collection statistics and metrics
- Document preview and editing
- Integration with admin UI

**Acceptance Criteria:**
- RAG frontend implemented
- All collection operations available in UI
- Document upload and management works
- Query testing interface functional
- UI is intuitive and well-designed
- Integrated with admin UI

**Frontend Features:**
- Collection list view with search/filter
- Collection detail view with documents
- Document upload (drag-and-drop or file picker)
- Document viewer/editor
- Query interface with results display
- Collection settings/configuration
- Statistics dashboard

### 6.3 RAG as a Service

**Priority:** High  
**Description:** Implement RAG as a service/infrastructure component (similar to LLM service or streaming service). RAG building/management is done via frontend + backend endpoints (administrative, not agentic). RAG usage is available as both MCP tool and LangGraph tool.

**Requirements:**
- RAG service provides API endpoints for querying/retrieval
- RAG building/management done via frontend UI + backend endpoints (not agentic, not a tool)
- RAG usage available as MCP tool (for MCP-compatible agents)
- RAG usage available as LangGraph tool (for LangGraph agents)
- Any agent can use RAG through appropriate tool interface
- Supports multiple RAG strategies (basic, reranking, etc.)
- Similar architecture to LLM service - agents use RAG via tools

**Acceptance Criteria:**
- RAG service implemented as infrastructure component
- RAG building/management endpoints work (collections, documents)
- MCP tool for RAG querying implemented
- LangGraph tool for RAG querying implemented
- Agents can use RAG via MCP or LangGraph tools
- Multiple RAG strategies supported through service

**RAG Architecture:**

**RAG Building/Management** (Administrative, Not Agentic):
- Done via frontend UI + backend API endpoints
- Users manage collections, upload documents, configure RAG through UI
- Not a tool, not agentic - pure administrative functionality
- Endpoints: `/api/rag/collections`, `/api/rag/collections/{id}/documents`, etc.

**RAG Usage** (Available as Tools):
- **MCP Tool:** RAG query tool available via MCP protocol
  - Agents using MCP can call RAG tool
  - Tool wraps RAG service query endpoint
  - **Parameters:**
    - `collection_id` (required) - Which RAG collection to query
    - `prompt` (required) - The query/question to search for
    - `strategy` (optional, default: "basic") - RAG strategy to use (basic, reranking)
    - `top_k` (optional, default: 5) - Number of results to retrieve
    - `similarity_threshold` (optional) - Minimum similarity score
  - Returns context/retrieved documents
  
- **LangGraph Tool:** Native LangGraph tool for RAG querying
  - LangGraph agents can use RAG as a tool in their graph
  - Tool wraps RAG service query endpoint
  - **Parameters:** Same as MCP tool
    - `collection_id` (required) - Which RAG collection to query
    - `prompt` (required) - The query/question to search for
    - `strategy` (optional, default: "basic") - RAG strategy to use (basic, reranking)
    - `top_k` (optional, default: 5) - Number of results to retrieve
    - `similarity_threshold` (optional) - Minimum similarity score
  - Returns context/retrieved documents

**Benefits:**
- Clear separation: building = admin UI, usage = tools
- Flexible: agents can use RAG via MCP or LangGraph tools
- Composable: agents can combine RAG with other tools/capabilities
- Consistent architecture: RAG is infrastructure, exposed as tools
- Easy to extend: add RAG to any agent via tool interface

### 6.4 Basic RAG Implementation

**Priority:** Medium  
**Description:** Implement foundational RAG strategies for initial release. Advanced RAG strategies will be implemented in the v2 final solution PRD and built incrementally through educational videos.

**Requirements:**
- Support basic RAG (simple vector similarity search)
- Support reranking RAG (optional, if simple to implement)
- Unified API architecture that can be extended
- Configuration determines which strategy to use
- Extensible architecture for future advanced RAG techniques
- Reference implementation patterns from [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies) repository

**Acceptance Criteria:**
- Basic RAG implemented and functional
- Reranking RAG implemented (if included)
- Unified API architecture in place
- Configuration-based strategy selection
- Extensible architecture ready for future strategies
- Documentation for implemented strategies
- Foundation ready for advanced RAG in next PRD

### 6.5 RAG LangGraph Tool Implementation

**Priority:** High  
**Description:** Create a RAG LangGraph tool in the LangGraph tools module. This tool wraps the RAG retrieval endpoint and makes RAG available to all LangGraph agents. The HR Assistant Agent (Section 12.3) will serve as the canonical example of RAG usage.

**Requirements:**
- RAG retrieval endpoint implemented (`POST /api/rag/collections/{id}/query`)
- LangGraph tool created in `apps/langgraph/src/tools/` module
- Tool wraps RAG retrieval endpoint
- Tool parameters match RAG query API:
  - `collection_id` (required) - Which RAG collection to query
  - `prompt` (required) - The query/question to search for
  - `strategy` (optional, default: "basic") - RAG strategy to use (basic, reranking)
  - `top_k` (optional, default: 5) - Number of results to retrieve
  - `similarity_threshold` (optional) - Minimum similarity score
- Tool returns retrieved context/documents
- Well-documented with clear code comments
- Available to all LangGraph agents via tools module

**Acceptance Criteria:**
- RAG retrieval endpoint functional
- RAG LangGraph tool implemented in tools module
- Tool properly wraps RAG API endpoint
- Tool can be used by any LangGraph agent
- Well-documented
- HR Assistant Agent demonstrates usage (serves as canonical example)

**Note:** The HR Assistant Agent (Section 12.3) will serve as the canonical example of RAG usage. It demonstrates the complete flow: query → RAG tool call → retrieve context → LLM generation → response. No separate canonical example needed.

---

**RAG Strategies for Initial Release:**

1. **Basic RAG** - Simple vector similarity search (Required)
   - Direct query → vector search → LLM generation
   - Foundation for all other strategies
   - Simplest implementation

2. **Reranking RAG** - Rerank retrieved documents for relevance (Optional, if simple)
   - Initial retrieval → rerank by relevance → top-k selection
   - Improves precision of retrieved documents
   - Can be added if straightforward to implement

**Future Advanced RAG Strategies** (To be implemented in `docs/prd/v2-final-solution.md`):
- Parent Document RAG
- Multi-Query RAG
- Query Expansion RAG
- Hybrid Search RAG
- Self-RAG
- Corrective RAG (C-RAG)
- Adaptive RAG
- Agentic RAG
- Multi-Step RAG
- Contextual Compression RAG
- Ensemble RAG
- And more from [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)

**Implementation Notes:**
- Start with simplest strategies for educational foundation
- Reference code patterns from [ottomator-agents repository](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)
- Architecture should be modular and extensible
- Advanced strategies will be built incrementally in future PRD and videos
- Configuration allows selection of strategy

---

## Section 7: Streaming & Observability

### 7.1 Unified Streaming Service

**Priority:** Critical  
**Description:** Create unified streaming service using RxJS Subject for both API and Agent-to-Agent streaming.

**Requirements:**
- Single streaming service with `addStreamEvent(event)` method
- RxJS Subject/ReplaySubject for event streaming
- Both API streaming and Agent-to-Agent streaming write to same service
- Two subscribers: user SSE endpoint and admin endpoint
- Use existing `observability_events` table

**Acceptance Criteria:**
- Streaming service implemented
- Both sources can write events
- User SSE endpoint receives events
- Admin endpoint receives events
- Events stored in `observability_events` table

**Architecture:**
- `StreamingService` (singleton)
- RxJS ReplaySubject with buffer
- User SSE subscriber
- Admin SSE/WebSocket subscriber
- Database persistence

### 7.2 Observability Events Structure

**Priority:** High  
**Description:** Finalize observability events structure and naming conventions.

**Requirements:**
- `source_app` = framework/system (langgraph, orchestrator-ai)
- `agent_slug` = specific agent name
- `hook_event_type` = `orchAI-{event}` or `external-{event}`
- Timestamps for timing analysis
- Proper event payload structure

**Acceptance Criteria:**
- Event structure documented
- Naming conventions clear
- All events follow conventions
- Timing analysis possible

**Event Types:**
- `orchAI-start` - Orchestrator AI internal event (task/agent started)
- `orchAI-finish` - Orchestrator AI internal event (task/agent completed)
- `orchAI-llm-start` - LLM service call started
  - Payload: `{ provider, model, prompt_length, request_id, ... }`
- `orchAI-llm-finish` - LLM service call completed
  - Payload: `{ provider, model, response_length, tokens_used, duration_ms, cost, request_id, ... }`
- `orchAI-hitl-request` - Human-in-the-loop request
- `orchAI-pii-detected` - PII detected in content
  - Payload: `{ pii_type, original_value, pseudonym, context, ... }`
- `orchAI-pii-reversed` - PII pseudonym reversed back to original
  - Payload: `{ pseudonym, original_value, context, ... }`
- `orchAI-pii-showstopper-blocked` - Showstopper PII detected, request blocked
  - Payload: `{ pii_type, original_value, showstopper_types, blocking_reason, context, ... }`
  - **Showstopper Types:** SSN, credit_card, api_key (and other high-risk PII)
- `external-start` - External agent started
- `external-progress` - External agent progress
- `external-finish` - External agent completed

### 7.3 LLM Usage Tracking & Analytics

**Priority:** Medium  
**Description:** Document existing LLM usage tracking system that provides detailed analytics and cost tracking.

**Current State:**
- `llm_usage` table tracks all LLM calls with comprehensive metadata:
  - Provider, model, tokens (input/output), cost, duration
  - Caller information (type, name), route (local/remote)
  - PII detection metadata, status, timestamps
  - Enhanced metrics (sanitization level, redactions, etc.)
- `RunMetadataService` handles usage tracking and persistence to `llm_usage` table
- **Admin UI exists** (`LlmUsageView.vue`, `LlmUsageTable.vue`) showing:
  - Usage records table with filtering
  - Analytics dashboard with stats
  - Cost tracking and summaries
  - Performance metrics
  - Real-time monitoring

**Requirements:**
- Keep existing LLM usage tracking functionality
- Ensure usage tracking works for all agent types
- Admin UI accessible and functional
- Usage data properly correlated with observability events

**What's Included (v2-start):**
- ✅ LLM usage tracking (all calls logged)
- ✅ Cost tracking and analytics
- ✅ Admin UI for viewing usage records
- ✅ Filtering and search capabilities
- ✅ Performance metrics and statistics

**Note:** LLM usage tracking is similar to observability events but serves a different purpose:
- **Usage tracking** = Detailed cost/performance analytics for LLM calls
- **Observability events** = Real-time streaming events for monitoring agent workflows

**Acceptance Criteria:**
- Usage tracking works for all agent types
- Admin UI displays usage data correctly
- Cost calculations accurate
- Performance metrics available

---

### 7.4 Evaluations System

**Priority:** Medium  
**Description:** Document existing evaluation system that allows users to rate and provide feedback on LLM responses.

**Current State:**
- `messages` table includes evaluation fields:
  - `user_rating`, `speed_rating`, `accuracy_rating` (1-5 scale)
  - `user_notes`, `evaluation_details` (JSONB)
  - `evaluation_timestamp`
- `EvaluationService` handles evaluation CRUD operations
- **Admin UI exists** for viewing evaluations:
  - User evaluations with ratings and notes
  - Evaluation analytics and statistics
  - Model comparison based on evaluations
  - Enhanced evaluation metadata (workflow steps, LLM info, constraints)

**Requirements:**
- Keep existing evaluation functionality
- Ensure evaluations work for all agent types
- Admin UI accessible for viewing evaluation data
- Evaluation data properly linked to messages/tasks

**What's Included (v2-start):**
- ✅ User rating system (overall, speed, accuracy)
- ✅ User notes and feedback
- ✅ Evaluation analytics
- ✅ Model comparison based on evaluations
- ✅ Enhanced evaluation metadata

**Acceptance Criteria:**
- Evaluations can be submitted for messages/tasks
- Admin can view evaluation analytics
- Evaluation data properly stored and linked
- UI displays evaluation information correctly

---

### 7.5 Admin Observability Streaming (Existing - Needs Improvement)

**Priority:** Low  
**Description:** Document existing admin observability streaming capability. Note that while functional, it needs improvement for better user experience.

**Current State:**
- `ObservabilityStreamController` provides SSE endpoint (`/observability/stream`)
- Admin-only endpoint streams all observability events in real-time
- `useAdminObservabilityStream` composable connects to stream
- **Admin UI exists** (`AdminObservabilityView.vue`) but needs enhancement

**Requirements:**
- Keep existing admin streaming functionality
- Note that improvements are planned for v2-final-solution
- Ensure basic streaming works for demonstration purposes

**What's Included (v2-start):**
- ✅ Admin SSE streaming endpoint
- ✅ Real-time event streaming
- ✅ Basic admin observability UI
- ⚠️ **Note:** UI/UX needs improvement (planned for v2-final-solution)

**What's NOT Included (moved to v2-final-solution):**
- ❌ Enhanced admin observability UI/UX
- ❌ Advanced filtering and visualization
- ❌ Better event organization and display

**Acceptance Criteria:**
- Admin streaming endpoint functional
- Basic admin UI displays events
- Real-time updates work
- Note added that improvements are planned

**Note:** Admin observability streaming exists and works, but the user experience needs enhancement. This will be addressed in the v2-final-solution PRD.

---

**Event Type Benefits:**

**LLM Start/Finish Events:**
- **Timing Analysis:** Calculate LLM call duration by comparing start/finish timestamps
- **Cost Tracking:** Track token usage and costs per LLM call
- **Performance Monitoring:** Identify slow LLM calls
- **Request Correlation:** Use `request_id` to correlate start/finish events
- **Different Payloads:** Start event has request info, finish event has response/cost info

**PII Events:**
- **Security Auditing:** Track when PII is detected and handled
- **Compliance:** Monitor PII processing for regulatory requirements
- **Debugging:** Understand PII pseudonymization flow
- **Reversal Tracking:** Track when pseudonyms are reversed back to originals
- **Privacy Monitoring:** Ensure PII is properly protected throughout the workflow
- **Showstopper Blocking:** Track when high-risk PII (SSN, credit cards, API keys) causes request blocking

---

## Section 8: PII & Pseudonymization (Basic)

### 8.1 Basic Dictionary-Based Pseudonymization

**Priority:** Medium  
**Description:** Include basic PII pseudonymization using dictionary-based replacement. This demonstrates the foundation of PII protection without requiring complex pattern matching.

**Current State:**
- `pseudonym_dictionaries` table exists with columns:
  - `original_value`, `pseudonym`, `data_type`, `category`
  - `organization_slug`, `agent_slug` (for scoping)
  - `frequency_weight`, `is_active`
- `DictionaryPseudonymizerService` exists and is actively used
- Dictionary-based replacement is working in LLM service
- **Showstopper PII detection exists** - blocks requests when high-risk PII detected:
  - SSN (Social Security Numbers)
  - Credit card numbers
  - API keys and secrets
- `PIIService.checkPolicy()` blocks requests immediately when showstoppers detected

**Requirements:**
- Keep existing dictionary-based pseudonymization functionality
- Ensure dictionary pseudonymization works for all agent types (LangGraph, orchestrator-ai-api)
- **Keep showstopper PII detection** - continue blocking requests when SSN, credit cards, or API keys detected
- Emit `orchAI-pii-detected` and `orchAI-pii-reversed` events when dictionary matches occur
- **Emit `orchAI-pii-showstopper-blocked` event** when showstopper PII detected and request blocked
- Support organization/agent-scoped dictionaries
- Basic admin UI for managing dictionary entries (CRUD)

**What's Included (v2-start):**
- ✅ Dictionary-based pseudonymization (simple string replacement)
- ✅ Dictionary CRUD operations
- ✅ Pseudonym reversal after LLM responses
- ✅ **Showstopper PII detection** - blocks requests when SSN, credit cards, or API keys detected
- ✅ PII observability events (detected/reversed/showstopper-blocked)
- ✅ Organization/agent scoping

**What's NOT Included (moved to v2-final-solution):**
- ❌ Pattern-based PII detection (`redaction_patterns` table exists but not fully utilized)
- ❌ Automatic pattern matching and replacement
- ❌ Advanced PII detection strategies
- ❌ ML-based PII detection
- ❌ Context-aware pseudonymization

**Acceptance Criteria:**
- Dictionary pseudonymization works for all agent types
- **Showstopper PII detection blocks requests** when SSN, credit cards, or API keys detected
- **Showstopper blocking events are emitted** (`orchAI-pii-showstopper-blocked`)
- PII events are emitted correctly (detected/reversed/showstopper-blocked)
- Admin can manage dictionary entries
- Pseudonyms are reversed correctly in responses
- Basic documentation showing dictionary usage and showstopper detection

**Note:** The `redaction_patterns` table exists in the database but pattern-based detection/replacement is not fully implemented. This advanced functionality will be part of the v2-final-solution PRD.

---

## Section 9: Transport Types

### 9.1 Full API Transport

**Priority:** High  
**Description:** Implement full-featured API transport type.

**Requirements:**
- Conversation ID
- Task ID
- User ID
- Prompt
- Webhook URL (for streaming responses)
- LLM service endpoint (for LLM calls through Orchestrator AI)
- Context/metadata

**Acceptance Criteria:**
- Full API transport implemented
- All fields supported
- Proper validation
- Documentation with examples

### 9.2 Simple API Transport

**Priority:** High  
**Description:** Implement simple API transport type for basic external APIs.

**Requirements:**
- Prompt
- Endpoint URL
- Minimal metadata
- No streaming support
- No HITL support

**Acceptance Criteria:**
- Simple API transport implemented
- Minimal fields required
- Proper validation
- Documentation with examples

### 9.3 Response Types Analysis

**Priority:** Medium  
**Description:** Analyze and document all response types, including synchronous completion responses and HITL responses.

**Requirements:**
- Document synchronous completion responses
- Document HITL responses (different from completion)
- Document streaming responses (webhook callbacks)
- Document error responses
- Create response type definitions
- Clear distinction between HITL response and completion response

**Acceptance Criteria:**
- All response types documented
- Type definitions created
- Examples provided
- Error handling documented
- HITL vs completion response clearly distinguished

**Response Types:**

1. **Completion Response** (Normal):
   ```json
   {
     "status": "completed",
     "task_id": "abc",
     "result": { ... },
     "metadata": { ... }
   }
   ```

2. **HITL Response** (Human Input Required):
   ```json
   {
     "status": "waiting_for_human",
     "task_id": "abc",
     "hitl_request_id": "xyz",
     "question": "Do you approve this blog post?",
     "options": ["approve", "reject", "request_revisions"],
     "context": { ... }
   }
   ```

3. **Streaming Events** (Webhook Callbacks):
   - Progress updates during execution
   - Sent to webhook URL during workflow
   - Not part of main API response

4. **Error Response**:
   ```json
   {
     "status": "error",
     "task_id": "abc",
     "error": "Error message",
     "error_code": "..."
   }
   ```

---

## Section 10: Human-in-the-Loop (HITL)

### 10.1 LangGraph HITL Integration

**Priority:** Critical  
**Description:** Implement HITL using LangGraph's built-in checkpointer mechanism with synchronous processing and pause/resume architecture. All HITL functionality is implemented in LangGraph agents - this is the primary and only HITL implementation for v2-start.

**Requirements:**
- Use LangGraph's checkpointer (MemorySaver or PostgresSaver)
- Use `task_id` as `thread_id` for state isolation
- Implement `interrupt()` mechanism
- Synchronous processing model (not async)
- LangGraph workflow pauses (doesn't end) at interrupt
- Resume with human input via new task call
- Store HITL requests in `observability_events`
- Each execution isolated by `task_id`/`thread_id`

**Acceptance Criteria:**
- LangGraph checkpointer configured
- HITL interrupts work correctly
- State persists across HITL pause/resume
- HITL events stored in observability_events
- Resume mechanism works with same `task_id`
- Multiple concurrent interrupts handled independently
- Synchronous processing maintained

**Architecture:**
- **Synchronous Processing:** API waits synchronously for workflow completion
- **State Isolation:** Each execution gets its own `task_id` = `thread_id`
- **Pause/Resume:** LangGraph workflow pauses at interrupt, doesn't end
- **Checkpointer:** LangGraph checkpointer manages state per `thread_id`
- **HITL Requests:** Stored in `observability_events` table
- **Resume:** Frontend creates new task call with same `task_id` + HITL response metadata
- **API Runner:** Detects HITL response and sends to paused LangGraph workflow
- **Streaming:** Can continue after resume (same or new connection)

### 10.2 HITL Service

**Priority:** High  
**Description:** Create shared HITL service for LangGraph agents.

**Requirements:**
- Singleton service in LangGraph app
- Handles HITL request creation
- Handles HITL response processing
- Integrates with checkpointer
- Writes to observability_events
- Supports multiple HITL request types:
  - `confirmation` - Yes/No approval (approve/reject)
  - `choice` - Multiple choice selection from options
  - `input` - Free-form text input
  - `approval` - Structured approval with optional modifications

**Acceptance Criteria:**
- HITL service implemented
- Available to all LangGraph agents
- Properly integrated with checkpointer
- Events written to observability_events
- All request types supported

### 10.3 HITL Flow Implementation

**Priority:** High  
**Description:** Implement complete synchronous HITL flow with pause/resume architecture.

**Requirements:**
- Synchronous processing model (API waits for completion)
- Two response types: HITL response vs completion response
- LangGraph workflow pauses (doesn't end) at interrupt
- Frontend creates new task call with same `task_id` + HITL response metadata
- Streaming can continue after resume
- Each execution isolated by `task_id`/`thread_id`

**Acceptance Criteria:**
- Complete HITL flow works synchronously
- State persists correctly across pause/resume
- User can respond anytime (workflow stays paused)
- Agent resumes correctly from checkpoint
- Streaming continues after resume
- Multiple concurrent interrupts handled independently
- No data loss

**Complete HITL Flow:**

1. **Initial Request:**
   - `POST /api/agents/{slug}/tasks` with optional `task_id: abc` (if not provided, backend generates one)
   - Task is created in database with ID (either provided or generated)
   - API Runner calls LangGraph agent with `task_id` as `thread_id`
   - LangGraph starts execution, streaming begins
   - API waits synchronously

2. **HITL Interrupt:**
   - Agent calls `interrupt()` → state saved to checkpointer (`thread_id: abc`)
   - HITL request event sent to `observability_events` table
   - Streaming stops (or pauses)
   - LangGraph workflow pauses (doesn't end), waiting for input
   - Task remains in database with status "waiting_for_human" or similar
   - API returns HITL response immediately: `{ status: "waiting_for_human", hitl_request_id: "...", question: "...", task_id: "abc" }`

3. **User Response:**
   - Frontend displays HITL request to user (see Section 10.4 for UI details)
   - User responds based on request type:
     - `confirmation`: Approve/Reject buttons
     - `choice`: Select from provided options
     - `input`: Free-form text input field
     - `approval`: Approve/Reject/Modify with optional modification input
   - Frontend calls same endpoint to resume: `POST /api/agents/{slug}/tasks` with:
     - Same `task_id: abc` (task already exists in database)
     - HITL response metadata: `{ action: "hitl_response", hitl_request_id: "...", response: "approve" }`

4. **Resume:**
   - API Runner detects HITL response metadata in request
   - Checks if task exists in database (it should - created in step 1)
   - If task exists and is paused, resumes existing workflow (does NOT create new task)
   - Sends HITL response to paused LangGraph workflow (same `thread_id: abc`)
   - LangGraph resumes from checkpoint using checkpointer
   - Streaming continues (or restarts)
   - API waits synchronously again

5. **Completion:**
   - Workflow completes
   - Task status updated in database to "completed"
   - API returns completion response: `{ status: "completed", result: "...", task_id: "abc" }`

**Key Points:**
- **Synchronous:** API waits for completion (not async)
- **Pause/Resume:** Workflow pauses, doesn't end
- **Same task_id:** Used for both initial call and resume
- **State Isolation:** Each `task_id`/`thread_id` has its own isolated state
- **Multiple Interrupts:** Can handle multiple concurrent interrupts independently
- **Flexible Timing:** User can respond hours later; workflow resumes when ready
- **Flexible Request Types:** Not limited to approve/reject - supports confirmation, choice, input, and approval types

---

### 10.4 HITL Frontend UI/Display

**Priority:** High  
**Description:** Implement frontend UI for displaying HITL requests and collecting user responses. The UI should adapt to different HITL request types.

**Current State:**
- Basic HITL UI exists in `EventRow.vue` (observability client)
- Admin approvals UI exists in `AdminApprovalsView.vue`
- Approval status badges exist in `AgentTaskItem.vue`

**Requirements:**
- **HITL Request Display:**
  - Show HITL request prominently when received (via observability events or direct API response)
  - Display request type, question/prompt, and available options
  - Show request metadata (agent, task, timestamp)
  - Visual indicators for pending HITL requests (badges, notifications, etc.)

- **Response UI by Type:**
  - **Confirmation (`confirmation`):**
    - Two buttons: "Approve" (green) and "Reject" (red)
    - Optional: "Approve & Continue" for multi-step workflows
    - Clear visual feedback when response submitted
  
  - **Choice (`choice`):**
    - Display list of options (radio buttons or select dropdown)
    - Submit button to send selected choice
    - Support for custom option labels and descriptions
  
  - **Input (`input`):**
    - Text input field (single-line or multi-line based on context)
    - Character limit display if applicable
    - Submit button to send input text
    - Optional: Input validation before submission
  
  - **Approval (`approval`):**
    - Approve/Reject buttons
    - Optional modification text area for "Approve with Changes"
    - Display what is being approved (content preview, summary, etc.)
    - Support for structured modifications (if applicable)

- **UI Integration:**
  - HITL requests appear in conversation/chat UI where task is running
  - Can also appear in admin observability stream
  - Non-blocking: User can continue viewing other content while HITL is pending
  - Persistent: HITL requests remain visible until responded to

- **Response Handling:**
  - Submit response via API call with HITL metadata
  - Show loading state while submitting
  - Show success/error feedback
  - Update UI to show response was submitted
  - Resume workflow automatically after response

**Acceptance Criteria:**
- HITL requests display correctly for all types
- Response UI works for all request types
- Responses submit correctly and resume workflow
- UI is intuitive and user-friendly
- Works in both conversation UI and admin observability stream
- Visual feedback is clear and helpful

**Note:** Checkpoint time travel (reverting to previous checkpoints) is planned for v2-final-solution (see Section 4.2).

---

## Section 11: LangGraph Agent Architecture

### 11.1 Shared Services Module

**Priority:** High  
**Description:** Create shared singleton services for LangGraph agents.

**Requirements:**
- `ObservabilityService` - streaming events
- `HitlService` - human-in-the-loop
- `LLMHttpClientService` - LLM calls (existing)
- `WebhookStatusService` - webhook status (existing)
- All services as singletons

**Acceptance Criteria:**
- Shared services module created
- All services implemented
- Available to all agent modules
- Properly documented

### 11.2 Agent Feature Modules

**Priority:** High  
**Description:** Create feature module structure for each LangGraph agent.

**Requirements:**
- Each agent = own NestJS feature module
- Module can contain multiple files
- Own controller with endpoint
- Own services (agent-specific logic)
- Own DTOs/interfaces
- Own nodes (if complex)
- Own state management
- Own tests

**Acceptance Criteria:**
- Each agent has own module
- Modules are self-contained
- Can grow to multiple files
- Shared services available
- Properly structured

**Structure:**
```
apps/langgraph/src/agents/
├── marketing-swarm/
│   ├── marketing-swarm.module.ts
│   ├── marketing-swarm.controller.ts
│   ├── marketing-swarm.service.ts
│   ├── graphs/
│   ├── nodes/
│   ├── tools/
│   └── dto/
└── hr-assistant/
    ├── hr-assistant.module.ts
    ├── hr-assistant.controller.ts
    ├── hr-assistant.service.ts
    ├── graphs/
    ├── nodes/
    ├── tools/
    └── dto/
```

### 11.3 LangGraph Tools Module

**Priority:** High  
**Description:** Create shared tools module for LangGraph agents. This includes common tools like RAG, database access, file system, and API calls.

**Requirements:**
- Shared tools module
- **RAG tool** - Wraps RAG retrieval endpoint (see Section 6.5)
- Common LangGraph tools (database, file system, API calls)
- Agent-specific tools in agent modules
- MCP tools still available when needed
- TypeScript-native tools

**Acceptance Criteria:**
- Tools module created
- **RAG tool implemented** (wraps RAG retrieval endpoint)
- Common tools implemented
- Agent-specific tools in agent modules
- MCP integration available
- Properly documented

**Structure:**
```
apps/langgraph/src/
├── tools/                    # Shared tools module
│   ├── tools.module.ts
│   ├── rag.tool.ts           # RAG retrieval tool (wraps RAG API)
│   ├── database.tool.ts
│   ├── file-system.tool.ts
│   └── api-call.tool.ts
└── agents/
    └── hr-assistant/
        └── tools/            # Agent-specific tools (if any)
```

---

## Section 12: Starting Agents

For v2-start, we focus on **three core starting agents**:
- Blog Post Writer Agent (Context / Orchestrator AI API)
- Marketing Swarm Agent (LangGraph with HITL)
- HR Assistant Agent (LangGraph with RAG)

We also include **two optional examples** for advanced users:
- Simple Jokes Agent (N8n, demonstrating Simple API transport)
- Metrics Agent (MCP or LangGraph tools, demonstrating database/metrics queries)

### 12.1 Blog Post Writer Agent (Orchestrator AI API - Context Agent)

**Priority:** Critical  
**Description:** Create a context agent that writes blog posts using markdown context files. Demonstrates the agent-to-agent context agent runner pattern.

**Requirements:**
- Agent JSON file in `apps/api/agents/`
- Markdown context file with blog post guidelines, style guide, examples, etc.
- Uses agent-to-agent context agent runner
- Properly configured endpoints
- Endpoints work
- Documentation complete

**Acceptance Criteria:**
- Agent works correctly
- Markdown context file contains blog post writing guidelines
- Agent can write blog posts using context
- Files in correct locations
- Endpoints configured
- Documentation complete

**Blog Post Writer Agent Features:**
- Writes blog posts based on topics provided
- Uses markdown context files as knowledge base (style guide, examples, guidelines)
- Demonstrates context agent pattern
- Example use cases: "Write a blog post about agent orchestration", "Create a post about LangGraph", etc.

### 12.2 Marketing Swarm Agent (LangGraph with HITL)

**Priority:** Critical  
**Description:** Create a marketing swarm agent that demonstrates Human-in-the-Loop capabilities through a multi-step content generation workflow. This agent generates marketing content in stages, pausing for human approval at key points.

**Requirements:**
- Agent JSON file in `apps/api/agents/`
- LangGraph agent module created
- Multi-step HITL workflow with specific stages
- Properly configured endpoints
- Streaming works
- HITL requests/responses work correctly
- Documentation complete

**Acceptance Criteria:**
- Agent works correctly
- Module structure correct
- Endpoints configured
- Streaming functional
- Multi-step HITL workflow works
- User can approve/reject/modify at each HITL pause
- Agent resumes correctly after HITL response
- Each step completes before moving to next
- Documentation complete

**Multi-Step HITL Workflow:**

1. **Generate LinkedIn Post:**
   - Agent generates a light LinkedIn post (smaller, concise post)
   - Pauses and requests human approval
   - HITL request: "Review this LinkedIn post"

2. **LinkedIn Post Approval (HITL Pause):**
   - User can: **Approve** (continue to next step), **Reject** (cancel workflow), or **Modify** (send edited post back)
   - If user modifies: Agent receives edited LinkedIn post and continues
   - If user approves: Agent uses original LinkedIn post and continues
   - If user rejects: Workflow ends

3. **Generate Blog Post:**
   - Once LinkedIn post is approved/modified, agent generates a full blog post
   - Blog post is based on/expanded from the LinkedIn post
   - Blog post is longer, more detailed than LinkedIn post
   - No HITL pause here (proceeds automatically after LinkedIn approval)

4. **Generate SEO Content:**
   - After blog post is generated, agent generates SEO content
   - SEO content includes: meta description, keywords, title tags, etc.
   - No HITL pause here (proceeds automatically)

**HITL Response Types:**
- **Approve:** Continue to next step with current content
- **Reject:** Cancel workflow, stop execution
- **Modify:** Send edited content back (e.g., edited LinkedIn post), agent uses modified content and continues

**Marketing Swarm Agent Features:**
- Demonstrates LangGraph HITL pattern with multi-step workflow
- Uses the `approval` HITL request type for the LinkedIn post approval step (approve/reject/modify)
- Shows how agents can pause for human input at a specific checkpoint (LinkedIn post), while later stages (blog post, SEO) run automatically
- Demonstrates content progression: LinkedIn post → Blog post → SEO content
- Shows HITL with modification capability (user can edit and send back)
- Example use case: Complete marketing content generation workflow with approval checkpoint

### 12.3 HR Assistant Agent (LangGraph with RAG)

**Priority:** High  
**Description:** Create an HR assistant agent that answers questions about HR policies, employee handbook, benefits, and company policies using content stored in a RAG collection. Demonstrates basic RAG capabilities using the RAG LangGraph tool. **This agent serves as the canonical example of RAG usage** - it shows the complete pattern: query → RAG tool → retrieve context → LLM generation → response.

**Requirements:**
- Agent JSON file in `apps/api/agents/`
- LangGraph agent module created
- HR content ingested into RAG collection (employee handbook, policies, benefits info, etc.)
- Uses RAG LangGraph tool from tools module (Section 11.3) for knowledge retrieval
- Demonstrates complete RAG pattern: query → RAG tool call → retrieve context → LLM generation → response
- Answers HR-related questions using RAG-retrieved context
- Well-documented code showing RAG tool usage (serves as canonical example)
- Properly configured endpoints
- Streaming works
- Documentation complete

**Acceptance Criteria:**
- Agent works correctly
- HR content in RAG collection
- RAG tool integration works
- Can query RAG collection for HR information
- Retrieves relevant context from HR documents
- Uses context in LLM generation to answer questions
- Module structure correct
- Endpoints configured
- Streaming functional
- Documentation complete

**HR Assistant Agent Features:**
- Simple Q&A workflow that queries HR RAG collection
- Uses RAG LangGraph tool from shared tools module
- Demonstrates basic RAG strategy
- Shows complete RAG pattern: query → tool call → context retrieval → LLM generation
- **Serves as canonical example** of RAG usage in LangGraph agents
- Well-documented code that can be used as reference for other agents
- Example use cases: "What's our vacation policy?", "How do I enroll in health insurance?", "What's the dress code?", "What are the parental leave benefits?", etc.

**Canonical Example Role:**
- This agent demonstrates the complete RAG usage pattern
- Shows how to call RAG tool from LangGraph node
- Shows how to integrate retrieved context into LLM prompt
- Code is well-commented and serves as reference implementation
- Other developers can use this as a template for building RAG-enabled agents

### 12.4 Simple Jokes Agent (N8n - Simple Example)

**Priority:** Medium  
**Description:** Create a very simple N8n-based jokes agent demonstrating the Simple API Transport pattern. This agent uses the Simple API Transport type (Section 9.2) - it only needs an endpoint and prompt, returning a simple text response. This demonstrates how quick and easy N8n agents can be. This agent is optional and not required for the main v2-start code-along path.

**Requirements:**
- Agent JSON file in `apps/api/agents/`
- Simple N8n workflow in `apps/n8n/workflows/`
- Uses Simple API Transport type (endpoint + prompt only)
- Takes a topic as input (via prompt)
- Returns a simple text response (joke about the topic)
- No streaming support (not needed for this simple example)
- No HITL support (not needed for this simple example)
- Very simple workflow (can be built quickly)
- Properly configured endpoints
- Frontend only needs to provide endpoint URL and prompt

**Acceptance Criteria:**
- Agent works correctly
- Files in correct locations
- Endpoints configured
- Simple API Transport type used
- Returns simple text response (no complex response structure)
- Frontend integration is minimal (endpoint + prompt only)
- Simple, educational example
- Documentation notes this is optional/example only

**Simple API Pattern:**
- Frontend sends: `{ endpoint: "...", prompt: "Tell me a joke about programming" }`
- Agent returns: Simple text response with the joke
- No conversation ID, task ID, webhook, or streaming needed

**Jokes Agent Features:**
- Demonstrates N8n agent capabilities
- Uses Simple API Transport pattern (endpoint + prompt only)
- Shows how simple N8n agents can be
- Example use cases: "Tell me a joke about programming", "Make a joke about AI", etc.

### 12.5 Metrics Agent (MCP or LangGraph Tools - Optional)

**Priority:** Low (Optional)  
**Description:** Create a metrics agent that queries company data using either MCP tools or LangGraph tools. This demonstrates how agents can access and query structured data. Note: This agent exists but may not be fully working - examples exist using MCP.

**Requirements:**
- Agent JSON file in `apps/api/agents/`
- Either MCP tool integration OR LangGraph tools module
- Access to company data database
- Query capabilities for metrics/KPI data
- Properly configured endpoints
- Streaming works (if applicable)
- Documentation complete

**Acceptance Criteria:**
- Agent works correctly (if implemented)
- Can query company data
- Returns metrics/KPI information
- Files in correct locations
- Endpoints configured
- Documentation notes current status (working vs needs work)

**Implementation Options:**
- **Option 1:** Use MCP tools for database access (examples exist)
- **Option 2:** Use LangGraph native tools for database access
- **Option 3:** Hybrid approach

**Metrics Agent Features:**
- Queries company data for metrics and KPIs
- Demonstrates database/structured data access patterns
- Shows MCP or LangGraph tools integration
- Example use cases: "What are our sales metrics?", "Show me revenue trends", etc.

**Note:** This agent is optional. If included, it demonstrates database access patterns. Current implementation may need work, but examples exist using MCP tools.

---

## Section 13: Testing

### 13.1 Test Infrastructure

**Priority:** High  
**Description:** Set up comprehensive test coverage with proper infrastructure.

**Requirements:**
- Tests based on port 6100
- Tests should NOT require Supabase constructs to be built
- Essential integration/E2E tests
- Test examples for key components
- Testing documentation

**Acceptance Criteria:**
- Test infrastructure set up
- Tests run on port 6100
- No Supabase dependency in tests
- Essential tests in place
- Documentation complete

### 13.2 Test Coverage

**Priority:** Medium  
**Description:** Ensure adequate test coverage for critical components.

**Requirements:**
- Test coverage for streaming service
- Test coverage for HITL service
- Test coverage for transport types
- Test coverage for agent modules
- Test coverage for observability

**Acceptance Criteria:**
- Critical components tested
- Coverage metrics acceptable
- Tests are maintainable
- Documentation updated

---

## Section 14: Documentation

### 14.1 README.md

**Priority:** Critical  
**Description:** Create comprehensive main README.

**Requirements:**
- Clear project description and purpose
- Quick start guide
- Architecture overview
- Prerequisites and installation instructions
- Link to detailed documentation
- Badges and project status
- Contributing guidelines link

**Acceptance Criteria:**
- README is comprehensive
- Clear and well-organized
- All sections complete
- Examples provided

### 14.2 Getting Started Guide

**Priority:** High  
**Description:** Create step-by-step guide for new users.

**Requirements:**
- Environment setup instructions
- Installation steps
- Configuration guide
- Supabase setup flow (reference Section 5.4 checklist and relevant scripts)
- Tour of existing agents & capabilities:
  - Explain the three core starting agents (Context, HITL, RAG)
  - Explain optional examples (N8n jokes agent, Metrics agent)
  - Show where each agent lives in the codebase and what technology it demonstrates
- First agent creation tutorial
- Common troubleshooting section

**Acceptance Criteria:**
- Guide is complete
- Step-by-step instructions
- Troubleshooting included
- Examples provided
- Learners understand how to set up Supabase and what agents/tech are already available

### 14.3 Architecture Documentation

**Priority:** High  
**Description:** Document system architecture and design decisions.

**Requirements:**
- System architecture diagrams
- Component descriptions
- Data flow documentation
- Agent interaction patterns
- API documentation

**Acceptance Criteria:**
- Architecture documented
- Diagrams included
- Design decisions explained
- API documented

---

## Section 15: Clean Slate Preparation

### 15.1 Docker Services Removal

**Priority:** Critical  
**Description:** Remove Docker services for clean educational starting point.

**Requirements:**
- Remove Supabase from Docker
- Remove N8n from Docker
- Remove entire database instance from Docker
- System in exact state user would have when downloading repo
- Setup scripts available for manual startup

**Acceptance Criteria:**
- No Docker services running
- Clean starting state
- Setup scripts available
- Documentation explains manual startup

### 15.2 Final State Verification

**Priority:** Critical  
**Description:** Verify system is in correct state for educational videos.

**Requirements:**
- Codebase is clean and organized
- Agent JSON files in place
- Seed files exist for initialization
- No running services
- Setup documentation complete
- User can follow setup → start services → run seeds → ready to go

**Acceptance Criteria:**
- System in correct state
- All files in place
- Setup process documented
- User can get started successfully

---

## Success Metrics

1. Repository is ready for public consumption
2. New users can get started within 30 minutes
3. All sensitive data removed
4. Documentation is comprehensive and clear
5. Three starting agents are functional and well-documented
6. Code follows consistent standards
7. System starts in clean state (no services running)
8. Setup process is clear and documented

## Implementation Phases

This section defines the implementation order with validation points. Each phase builds on previous phases, with agent implementations serving as validation checkpoints.

### Phase 0: Port & Environment Configuration
**Priority:** Critical
**Must complete first**

**Goals:**
- Change all ports (API: 6100, LangGraph: 6200, N8n: 5678, etc.)
- Clean up .env.example files with comprehensive documentation
- Update all port references in code
- Update Supabase configuration for port 6100
- Update N8n configuration

**Why First:** Prevents breaking changes during development and establishes consistent environment.

**Deliverables:**
- Updated .env.example with all variables documented
- All services configured for new ports
- Documentation of port assignments

---

### Phase 1: Agent Infrastructure
**Priority:** Critical
**Depends on:** Phase 0

**Goals:**
- Agent table structure (normalized columns, no JSON files)
- Organizations table
- Seed files (organizations + agents)
- Database as single source of truth

**Deliverables:**
- Agents table migration (see Phase 1 PRD: `docs/prd/phase-1-agent-infrastructure.md`)
- Organizations table migration
- Seed files created

**Key Decisions:**
- Database is source of truth (no agent JSON files)
- Normalized structure (known fields as columns, not hidden in YAML/JSON)
- Multi-org support via TEXT[] array
- Both io_schema AND capabilities required (different purposes)

---

### Phase 1.5: Agent Discovery & Runner Cleanup
**Priority:** Critical
**Depends on:** Phase 1

**Goals:**
- Update agent discovery for new table structure
- Three agent runners: Context, API, External (with A2A discovery)
- Remove tool agent runner
- Update frontend for new agent structure

**Deliverables:**
- Three agent runners working (see Phase 1.5 PRD: `docs/prd/phase-1.5-agent-discovery-runner-cleanup.md`)
- Agent discovery updated
- Frontend displays agents correctly
- Tool agent code removed

**External Agent Runner:**
- Implements A2A protocol discovery (`.well-known/agent.json`)
- Caches external agent cards
- Very similar to API runner but with discovery step
- Note: Implemented without test case (no external agents available yet)

---

### Phase 2: Streaming & Observability
**Priority:** Critical
**Depends on:** Phase 1.5

**Goals:**
- Unified streaming service (RxJS Subject)
- Observability events structure
- PII & Pseudonymization (basic dictionary-based)
- LLM usage tracking (document existing)
- Evaluations system (document existing)

**Deliverables:**
- Streaming service implemented
- Observability events working
- PII dictionary pseudonymization working
- Admin observability UI functional

---

### 🎯 VALIDATION CHECKPOINT: Blog Post Writer Agent (Context)
**Validates:** Phase 0, 1, 1.5, 2

**Why Build Now:**
- Simplest agent type (context agent)
- Tests entire stack: database, discovery, context runner, frontend
- No external dependencies (no APIs, no HITL, no RAG)
- Immediate validation that infrastructure works
- Great starting point for educational videos

**Success Criteria:**
- Agent in database, discoverable via API
- Executes via context runner
- Streaming/observability works
- Frontend can use agent
- Department categorization works

---

### Phase 5: LangGraph Agent Architecture
**Priority:** Critical
**Depends on:** Phase 2
**Must complete BEFORE any LangGraph agents**

**Goals:**
- Shared services module (ObservabilityService, HitlService placeholder, LLMHttpClientService, WebhookStatusService)
- Agent feature modules structure (one module per agent)
- LangGraph tools module (database, file system, API calls - NOT RAG yet)
- **Transport Types** (Full API, Simple API, Response types - moved from Phase 2)
- **LangGraph patterns and practices established**
- **Skills and agents files properly defined**
- **Learning/mastery phase for LangGraph**

**Why Now:**
- Must establish LangGraph foundation BEFORE building LangGraph agents
- Learn and master LangGraph patterns here
- Transport types needed for LangGraph agent communication
- Create reusable patterns for all future LangGraph agents

**Deliverables:**
- Shared services module created
- Agent feature module pattern established
- Tools module with common tools (NOT RAG yet)
- Transport types implemented (Full API, Simple API)
- Response types documented
- LangGraph best practices documented
- Example/template module structure

**Important Note:**
This is the phase to get LangGraph right. Take time to establish patterns, create examples, and document best practices. All subsequent LangGraph agents will follow these patterns.

---

### Phase 3: RAG Infrastructure
**Priority:** High
**Depends on:** Phase 5 (LangGraph foundation must be solid first)

**Goals:**
- RAG database structure (multiple collections)
- RAG backend API (collection management, document ingestion, query/search)
- RAG frontend UI (collection management, document upload, query testing)
- RAG as a service
- **RAG LangGraph tool** (added to existing tools module from Phase 5)
- Basic RAG implementation (basic strategy, optional reranking)

**Why After Phase 5:**
- RAG tool needs to integrate with LangGraph tools module
- RAG agents are LangGraph agents, so LangGraph must be solid first

**Deliverables:**
- RAG database created with pgvector
- RAG API endpoints working (collections, documents, query)
- RAG frontend UI functional
- RAG LangGraph tool implemented
- Basic RAG strategy working
- HR content ingested into RAG collection

---

### 🎯 VALIDATION CHECKPOINT: HR Assistant Agent (LangGraph with RAG)
**Validates:** Phase 5 (LangGraph), Phase 3 (RAG)

**Why Build Now:**
- First LangGraph agent - validates Phase 5 LangGraph architecture works
- Validates RAG infrastructure and RAG tool
- Simpler than HITL (no pause/resume complexity)
- Tests: LangGraph foundation, RAG tool, shared services, agent module structure

**Success Criteria:**
- Agent module created following Phase 5 patterns
- RAG tool integration works
- Can query HR RAG collection
- Retrieves and uses context correctly
- Streaming/observability works
- Well-documented as RAG reference implementation

**Important:**
This agent validates that Phase 5 LangGraph patterns are solid. If this agent is hard to build, go back and fix Phase 5 patterns.

---

### Phase 4: Human-in-the-Loop (HITL)
**Priority:** High
**Depends on:** Phase 5, HR Assistant working

**Goals:**
- LangGraph HITL integration (checkpointer, interrupt mechanism)
- HITL service (shared across LangGraph agents)
- HITL flow implementation (pause/resume architecture)
- HITL frontend UI (display requests, collect responses)

**Why After HR Assistant:**
- Most complex LangGraph feature
- Builds on proven LangGraph foundation from HR Assistant
- HITL requires solid understanding of LangGraph state management

**Deliverables:**
- HITL service implemented
- Checkpointer configured (MemorySaver or PostgresSaver)
- Interrupt/resume working
- HITL frontend UI functional
- All HITL request types supported (confirmation, choice, input, approval)

---

### 🎯 VALIDATION CHECKPOINT: Marketing Swarm Agent (LangGraph with HITL)
**Validates:** Phase 4 (HITL), Phase 5 (LangGraph)

**Why Build Now:**
- Second LangGraph agent - validates HITL infrastructure
- Tests: HITL service, checkpointer, pause/resume, multi-step workflow
- Most complex LangGraph agent (multi-step with approval checkpoint)

**Success Criteria:**
- Agent module created
- Multi-step workflow works (LinkedIn → Blog → SEO)
- HITL pause at LinkedIn post approval
- User can approve/reject/modify
- Agent resumes correctly after HITL response
- Streaming continues after resume

**HITL Flow:**
1. Generate LinkedIn post → HITL pause (approval request)
2. User approves/rejects/modifies → Agent resumes
3. Generate blog post (automatic, no pause)
4. Generate SEO content (automatic, no pause)

---

### 🎯 VALIDATION CHECKPOINT: Metrics Agent (MCP/LangGraph Tools)
**Validates:** LangGraph tools, database access, MCP integration

**Priority:** Medium (Optional)

**Why Build Now:**
- Validates tools module works
- Tests database access patterns
- Shows MCP integration (if using MCP)

**Success Criteria:**
- Agent can query company data
- Returns metrics/KPI information
- Tools integration works

**Note:** Optional - may need work, but examples exist using MCP tools.

---

### 🎯 VALIDATION CHECKPOINT: Jokes Agent (N8n - Simple API)
**Validates:** Simple API transport, API agent runner, N8n integration

**Priority:** Low (Optional)

**Why Build Last:**
- Validates Simple API transport type
- Tests API agent runner with simplest case
- Demonstrates N8n integration (for intern prototypes only)

**Success Criteria:**
- Simple N8n workflow created
- Simple API transport works (endpoint + prompt only)
- Returns simple text response
- Frontend integration minimal

**Note:** Optional - demonstrates N8n but not part of core v2-start user experience.

---

### Phase 7: Configuration & Cleanup
**Priority:** High
**Depends on:** All agents working

**Goals:**
- Code cleanup (remove JS files, unused tests, experimental code)
- Obsidian directory handling
- Admin UI cleanup (user management CRUD)

**Deliverables:**
- Clean codebase
- Admin UI with full user management
- No unnecessary files

---

### Phase 8: Testing
**Priority:** High
**Depends on:** Phase 7

**Goals:**
- Test infrastructure setup (port 6100, no Supabase dependency)
- Test coverage for critical components
- Integration/E2E tests

**Deliverables:**
- Test infrastructure working
- Critical components tested
- Documentation updated

---

### Phase 9: Documentation
**Priority:** Critical
**Depends on:** Phase 8

**Goals:**
- README.md
- Getting Started Guide (with Supabase setup flow)
- Architecture Documentation
- API documentation

**Deliverables:**
- Comprehensive README
- Step-by-step getting started guide
- Architecture diagrams and documentation

---

### Phase 10: Clean Slate Preparation
**Priority:** Critical
**Depends on:** Phase 9

**Goals:**
- Docker services removal (Supabase, N8n)
- Final state verification
- Setup scripts for manual startup

**Deliverables:**
- No running services
- Clean starting state
- User can follow setup → start services → run seeds → ready

---

## Phase Summary Table

| Phase | Name | Priority | Builds Agent? | Dependencies |
|-------|------|----------|---------------|--------------|
| 0 | Port & Environment | Critical | No | None |
| 1 | Agent Infrastructure | Critical | No | Phase 0 |
| 1.5 | Discovery & Runners | Critical | No | Phase 1 |
| 2 | Streaming & Observability | Critical | No | Phase 1.5 |
| **✓** | **Blog Post Writer** | Critical | **Context** | Phase 2 |
| 5 | LangGraph Architecture | Critical | No | Phase 2 |
| 3 | RAG Infrastructure | High | No | Phase 5 |
| **✓** | **HR Assistant** | High | **LangGraph + RAG** | Phase 5, 3 |
| 4 | HITL | High | No | Phase 5 |
| **✓** | **Marketing Swarm** | High | **LangGraph + HITL** | Phase 5, 4 |
| **✓** | **Metrics Agent** | Medium | **LangGraph Tools** | Phase 5 |
| **✓** | **Jokes Agent** | Low | **N8n Simple API** | Phase 5 |
| 7 | Configuration & Cleanup | High | No | All agents |
| 8 | Testing | High | No | Phase 7 |
| 9 | Documentation | Critical | No | Phase 8 |
| 10 | Clean Slate Preparation | Critical | No | Phase 9 |

## Agent Complexity Progression

1. **Blog Post Writer** (Context) - Simplest
2. **HR Assistant** (LangGraph + RAG) - Medium
3. **Marketing Swarm** (LangGraph + HITL) - Complex
4. **Metrics Agent** (Tools) - Medium
5. **Jokes Agent** (N8n) - Simple (different pattern)

## Key Principles

1. **Infrastructure First, Agents Second** - Each infrastructure phase completed before building agents
2. **Progressive Validation** - Each agent validates completed infrastructure
3. **Immediate Feedback** - Know if infrastructure works before adding complexity
4. **LangGraph Mastery** - Phase 5 establishes patterns, subsequent agents follow them
5. **Educational Flow** - Order optimized for teaching and learning

## Dependencies

- Access to repository
- Understanding of current codebase structure
- Knowledge of agent orchestration concepts
- Documentation tools and templates

## Risks and Mitigation

- **Risk:** Accidentally exposing secrets
  - **Mitigation:** Multiple review passes, automated scanning
- **Risk:** Incomplete documentation
  - **Mitigation:** User testing with fresh eyes
- **Risk:** Breaking existing functionality
  - **Mitigation:** Test all examples and demos
- **Risk:** Complex agents become too large
  - **Mitigation:** Feature module structure allows growth

## Open Questions

1. Obsidian directory: gitignore or remove?
2. Test coverage threshold?
3. Seed file format: SQL, JSON, or TypeScript?
4. Docker Compose files: remove or keep commented?

## Notes

- This is a preparation phase, not a rewrite
- Focus on making existing code accessible
- Prioritize clarity over perfection
- User experience is key
- Each section will become its own plan item after PRD approval
