# Product Requirements Document: v2 Final Solution

## Overview

This PRD defines the final, advanced version of Orchestrator AI v2. This builds upon the foundational work completed in the "create-v2-start" PRD, adding advanced features, sophisticated RAG strategies, and enhanced capabilities.

**Important:** Every feature and component in this PRD will be built through educational videos (Loom and YouTube). The entire version will be constructed incrementally through video-based learning, making this both a product development effort and a comprehensive educational program.

## Goals

1. Implement advanced RAG strategies (all 13+ strategies)
2. Add sophisticated agent capabilities
3. Enhance observability and monitoring with swim lane visualization
4. Implement advanced Human-in-the-Loop workflows
5. Build comprehensive educational content (skills, agents, Claude Code commands)
6. Set up multi-organization/vertical infrastructure
7. Integrate comprehensive MCP servers and tools
8. Implement media generation capabilities (images and video)

## Relationship to create-v2-start PRD

This PRD assumes completion of all requirements in `docs/prd/create-v2-start.md`. The foundational infrastructure, basic RAG, and core agent architecture must be in place before implementing the advanced features defined here.

---

## Section 1: Advanced RAG Strategies

### 1.1 Advanced RAG Implementation

**Priority:** High  
**Description:** Implement all advanced RAG strategies beyond basic RAG and reranking. Reference implementation patterns from [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies) repository.

**Requirements:**
- Implement all 13+ advanced RAG strategies
- Extend database schema with strategy-specific columns
- Support multiple embedding strategies per collection
- Implement different chunking strategies
- Support ensemble and hybrid approaches
- All strategies accessible through unified API
- Configuration determines which strategy to use
- Reference implementation code from ottomator-agents repository

**Acceptance Criteria:**
- All advanced RAG strategies implemented
- Database schema extended appropriately
- Multiple embedding strategies supported
- Unified API for all strategies
- Configuration-based strategy selection
- Documentation for each strategy
- Implementation references ottomator-agents patterns

**Advanced RAG Strategies** (Reference: [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)):

1. **Parent Document RAG** - Retrieve parent documents from chunks
2. **Multi-Query RAG** - Generate multiple query variations
3. **Query Expansion RAG** - Expand queries with related terms
4. **Hybrid Search RAG** - Combine vector and keyword search
5. **Self-RAG** - Self-reflective retrieval and generation
6. **Corrective RAG (C-RAG)** - Corrective retrieval with query refinement
7. **Adaptive RAG** - Route queries based on complexity
8. **Agentic RAG** - LLM-guided retrieval and reasoning
9. **Multi-Step RAG** - Iterative query refinement
10. **Contextual Compression RAG** - Compress context before generation
11. **Ensemble RAG** - Combine multiple retrieval strategies
12. And more from ottomator-agents repository

**Database Schema Extensions:**
- Additional columns for advanced strategies (see create-v2-start PRD Section 5.1.1)
- Strategy-specific tables or JSONB columns
- Support for intermediate results storage
- Multiple embeddings per chunk support

**Embedding Strategies:**
- Multiple embedding models per collection
- Different chunking strategies (sentence, paragraph, semantic, etc.)
- Multiple embeddings per chunk (for ensemble approaches)
- Embedding metadata (model version, parameters, etc.)

---

## Section 2: Advanced Agent Capabilities

### 2.1 Agent Builder Agents

**Priority:** High  
**Description:** Build agent builders as Claude Code agents with skills and commands. These builders help users create, configure, and manage agents more efficiently.

**Requirements:**
- **Claude Code Agent Builder:**
  - Agent builder implemented as Claude Code agent
  - Skills for agent creation (scaffolding, configuration, testing)
  - Commands for agent management
  - Interactive agent creation workflow
  - Agent template system
  
- **Agent Builder Capabilities:**
  - Generate agent JSON/YAML files
  - Create agent directory structure
  - Generate boilerplate code (LangGraph, N8N, etc.)
  - Configure agent endpoints
  - Set up agent testing infrastructure
  - Validate agent configurations
  - Generate agent documentation
  
- **Agent Builder Skills:**
  - Agent scaffolding skill (creates structure)
  - Agent configuration skill (sets up configs)
  - Agent testing skill (generates tests)
  - Agent deployment skill (prepares deployment)
  - Agent documentation skill (generates docs)
  
- **Agent Builder Commands:**
  - `create-agent` - Create new agent
  - `configure-agent` - Configure existing agent
  - `test-agent` - Run agent tests
  - `deploy-agent` - Deploy agent
  - `validate-agent` - Validate agent config

**Acceptance Criteria:**
- Agent builder implemented as Claude Code agent
- All skills functional
- All commands work correctly
- Can generate complete agent structures
- Supports LangGraph and N8N agent creation
- Documentation complete
- Video walkthrough produced

---

### 2.2 Advanced Agent Types

**Priority:** Medium  
**Description:** Implement advanced agent types and capabilities beyond the foundational agents.

**Requirements:**
- Advanced orchestration agents
- Multi-agent collaboration patterns
- Agent specialization and delegation
- Advanced tool integration
- Agent builder integration

**Acceptance Criteria:**
- Advanced agent types implemented
- Multi-agent patterns work correctly
- Agent builders can create advanced agents
- Documentation complete

---

## Section 3: Enhanced Observability

### 3.1 Advanced Admin Observability UI/UX

**Priority:** High  
**Description:** Build a comprehensive, user-friendly admin observability interface that provides powerful monitoring, debugging, and analytics capabilities. The current basic implementation exists but needs significant enhancement for production use.

**Current State (from v2-start):**
- Admin SSE streaming endpoint exists (`/observability/stream`)
- Basic admin observability UI exists (`AdminObservabilityView.vue`)
- Real-time event streaming functional
- Events stored in `observability_events` table
- Basic event display works but lacks advanced features

**Requirements:**
- **Enhanced UI/UX:**
  - Modern, intuitive dashboard layout
  - Better event organization and grouping
  - Timeline visualization with zoom/pan
  - Event correlation and relationship mapping
  - Color-coded event types and severity levels
  - Responsive design for mobile/tablet access

- **Advanced Filtering & Search:**
  - Multi-criteria filtering (agent, user, conversation, event type, time range)
  - Full-text search across event payloads
  - Saved filter presets
  - Quick filters for common scenarios
  - Filter by event relationships (e.g., all events for a specific task)

- **Visualization & Analytics:**
  - Real-time event timeline with interactive controls
  - Event flow diagrams showing agent execution paths
  - Performance metrics visualization (latency, throughput)
  - Cost tracking integration (correlate with LLM usage data)
  - Error rate and success rate dashboards
  - Agent activity heatmaps

- **Event Management:**
  - Event grouping by conversation/task/agent
  - Event aggregation and summarization
  - Event replay functionality
  - Export capabilities (CSV, JSON, PDF reports)
  - Event bookmarking and annotations
  - Custom event views and saved queries

- **Performance & Scalability:**
  - Efficient handling of large event volumes (pagination, virtualization)
  - Client-side caching and optimization
  - Lazy loading for historical events
  - Real-time updates without performance degradation
  - Background data synchronization

- **Integration Features:**
  - Correlation with LLM usage data (`llm_usage` table)
  - Link to evaluation data
  - Integration with task/conversation views
  - Deep linking to specific events

**Acceptance Criteria:**
- Admin observability UI is production-ready and user-friendly
- Advanced filtering and search work correctly
- Event visualization is clear, useful, and performant
- Handles large event volumes efficiently
- Export functionality works for all formats
- Real-time updates are smooth and non-blocking
- Integration with other admin features works
- Mobile/tablet responsive design
- Documentation complete with user guide

**Technical Considerations:**
- Consider using a dedicated observability UI framework/library
- Implement efficient data structures for event storage/retrieval
- Use WebSockets or SSE with proper reconnection handling
- Implement proper error boundaries and loading states
- Consider server-side filtering/aggregation for performance

---

### 3.2 Agent Swim Lane Visualization

**Priority:** High  
**Description:** Expand the observability UI to show swim lanes of all agents, providing a visual representation of agent execution flows, parallel processing, and agent interactions. This gives administrators a comprehensive view of all agent activity across the system.

**Current State (from v2-start):**
- Basic admin observability UI exists (`AdminObservabilityView.vue`)
- Real-time event streaming functional
- Events stored in `observability_events` table
- Basic event display works

**Requirements:**
- **Swim Lane Layout:**
  - Each agent gets its own horizontal swim lane
  - Swim lanes arranged vertically, scrollable
  - Agent name/icon displayed at left of each lane
  - Color-coded by agent type or organization
  
- **Timeline Visualization:**
  - Horizontal timeline across all swim lanes (shared X-axis)
  - Time-based positioning of events within lanes
  - Zoom/pan controls for timeline navigation
  - Time range selector (last hour, day, week, custom)
  - Real-time updates as new events arrive
  
- **Event Visualization:**
  - Events displayed as blocks/bars within swim lanes
  - Block width represents duration (for events with start/finish pairs)
  - Block color represents event type (LLM call, HITL pause, error, etc.)
  - Hover tooltips show event details
  - Click to expand event details panel
  
- **Agent Activity Indicators:**
  - Visual indicators for active agents (pulsing, highlighted)
  - Idle agents shown with dimmed lanes
  - Agent status badges (running, paused, completed, error)
  - Agent performance metrics displayed inline
  
- **Parallel Processing Visualization:**
  - Multiple agents executing simultaneously shown as parallel lanes
  - Agent-to-agent calls shown as arrows between lanes
  - Dependency chains visualized with connecting lines
  - Agent collaboration patterns clearly visible
  
- **Filtering & Grouping:**
  - Filter by organization/vertical
  - Filter by agent type or specific agents
  - Group lanes by organization, agent type, or status
  - Show/hide specific agents or lanes
  - Filter by time range or event type
  
- **Interaction Features:**
  - Click event block to see full details
  - Click agent name to focus on that agent's lane
  - Drag to pan timeline
  - Scroll wheel to zoom timeline
  - Keyboard shortcuts for common actions
  - Export swim lane view as image or PDF
  
- **Performance Optimization:**
  - Virtual scrolling for many agents
  - Lazy loading of historical events
  - Efficient rendering of timeline
  - Client-side caching of event data
  - Debounced updates for real-time streaming

**Acceptance Criteria:**
- Swim lane visualization displays all active agents
- Timeline shows accurate time-based positioning
- Events are correctly positioned within lanes
- Parallel processing is clearly visualized
- Agent interactions are visible
- Filtering and grouping work correctly
- Performance is acceptable with many agents
- Real-time updates work smoothly
- Export functionality works
- Documentation complete with user guide

**Technical Considerations:**
- Consider using a timeline visualization library (e.g., vis.js Timeline, D3.js, or custom Vue component)
- Efficient data structures for timeline rendering
- WebSocket/SSE for real-time updates
- Client-side event aggregation for performance
- Responsive design for different screen sizes

---

### 3.3 Advanced Observability Features

**Priority:** Medium  
**Description:** Enhance observability beyond basic streaming and event tracking.

**Requirements:**
- Advanced analytics and metrics
- Performance monitoring
- Cost tracking integration with observability
- Advanced debugging tools
- Correlation between observability events and LLM usage data
- Custom alerting and notifications
- Integration with swim lane visualization

**Acceptance Criteria:**
- Advanced observability features implemented
- Analytics dashboard functional
- Performance metrics tracked
- Cost data integrated
- Swim lane integration complete
- Documentation complete

---

## Section 4: Advanced Human-in-the-Loop

### 4.1 Advanced HITL Workflows

**Priority:** Medium  
**Description:** Implement advanced Human-in-the-Loop patterns beyond basic pause/resume.

**Requirements:**
- Multi-step HITL workflows
- Conditional HITL triggers
- HITL approval chains
- Advanced HITL UI components

**Acceptance Criteria:**
- Advanced HITL workflows implemented
- Complex approval patterns work
- UI supports advanced workflows
- Documentation complete

---

### 4.2 Checkpoint Time Travel & Revert

**Priority:** High  
**Description:** Implement checkpoint time travel functionality that allows users to revert workflows to previous checkpoints, enabling "undo" and "try again" capabilities for agent executions.

**Current State (from v2-start):**
- LangGraph checkpointer saves state snapshots after each step
- Checkpoints are stored per `thread_id` (which equals `task_id`)
- Basic pause/resume HITL functionality exists
- No UI or API for accessing checkpoint history or reverting

**Requirements:**
- **Checkpoint History API:**
  - Endpoint to retrieve checkpoint history for a task/thread
  - List all checkpoints with timestamps, step names, and state summaries
  - Endpoint to get details of a specific checkpoint
  - Support filtering checkpoints by step, timestamp range, etc.

- **Revert Functionality:**
  - API endpoint to revert workflow to a specific checkpoint
  - Invalidate all checkpoints after the target checkpoint
  - Restore workflow state from target checkpoint
  - Resume workflow from restored checkpoint
  - Support for "fork" vs "replace" modes:
    - **Replace:** Overwrite current state, discard later checkpoints
    - **Fork:** Create new task/thread from checkpoint, keep original intact

- **Frontend UI:**
  - Checkpoint timeline visualization showing workflow progression
  - Visual representation of checkpoints (nodes on timeline)
  - Ability to select a checkpoint and view its state
  - "Revert to this checkpoint" button with confirmation
  - Show what will be lost when reverting (later steps)
  - Preview of state at selected checkpoint

- **State Management:**
  - Track invalidated checkpoints (mark as invalid, don't delete)
  - Maintain checkpoint history even after reverts
  - Support multiple revert operations (can revert multiple times)
  - Handle cascading invalidations (if reverting step 3, invalidate steps 4+)

- **Integration with HITL:**
  - Allow reverting during HITL pause
  - After revert, workflow can resume from checkpoint
  - HITL requests can be re-triggered if needed
  - Support modifying parameters when resuming from checkpoint

- **Use Cases:**
  - "The KPI query results look wrong - go back to the data fetch step"
  - "This blog post draft isn't good - revert to before the writing step"
  - "Let me try a different approach - revert to planning checkpoint"
  - "I want to see what the state was 3 steps ago"

**Acceptance Criteria:**
- Checkpoint history API functional
- Revert API works correctly
- Frontend UI displays checkpoint timeline
- Users can revert to any previous checkpoint
- State restoration works correctly
- Invalidated checkpoints are tracked
- Multiple reverts supported
- Integration with HITL works
- Documentation complete

**Technical Considerations:**
- LangGraph checkpointer provides checkpoint history via `list()` method
- Need to map LangGraph checkpoint structure to user-friendly format
- Consider performance implications of storing many checkpoints
- May need checkpoint pruning/cleanup strategy for long-running workflows
- Ensure checkpoint data includes enough context for meaningful reverts

---

## Section 5: Advanced PII Detection & Pseudonymization

### 5.1 Pattern-Based PII Detection

**Priority:** High  
**Description:** Implement comprehensive pattern-based PII detection using the existing `redaction_patterns` table. This extends beyond dictionary-based detection to automatically detect PII using regex patterns and validation rules.

**Current State (from v2-start):**
- `redaction_patterns` table exists with columns:
  - `name`, `pattern_regex`, `replacement`, `description`
  - `category`, `priority`, `is_active`, `severity`, `data_type`
- `PIIPatternService` exists but pattern-based detection is not fully utilized
- Dictionary-based pseudonymization works
- Showstopper detection works for SSN, credit cards, API keys

**Requirements:**
- Fully implement pattern-based PII detection using `redaction_patterns` table
- Automatic pattern matching and replacement
- Pattern priority system (higher priority patterns checked first)
- Pattern validation (regex + validator functions)
- Pattern categories (email, phone, SSN, credit_card, api_key, etc.)
- Severity levels (showstopper, warning, info)
- Pattern-based pseudonymization (replace with patterns, not just dictionaries)
- Pattern testing and validation UI
- Pattern management admin UI (CRUD for patterns)

**Acceptance Criteria:**
- Pattern-based detection works for all pattern types
- Patterns are checked in priority order
- Pattern validation functions work correctly
- Pattern-based replacement functional
- Admin can manage patterns via UI
- Pattern testing interface available
- Performance is acceptable with many patterns
- Documentation complete

---

### 5.2 Advanced PII Detection Strategies

**Priority:** Medium  
**Description:** Implement advanced PII detection strategies beyond basic pattern matching.

**Requirements:**
- **Context-Aware Detection:**
  - Detect PII based on surrounding context
  - Understand PII in different formats (e.g., phone numbers with/without dashes)
  - Handle variations and edge cases
  - Contextual validation (e.g., SSN in proper format)

- **ML-Based Detection:**
  - Machine learning models for PII detection
  - Train models on organization-specific data
  - Confidence scoring for detections
  - False positive reduction

- **Hybrid Detection:**
  - Combine dictionary, pattern, and ML-based detection
  - Ensemble approach for higher accuracy
  - Confidence aggregation across methods
  - Fallback strategies

- **Custom Detection Rules:**
  - Organization-specific detection rules
  - Custom pattern definitions per organization
  - Rule priority and conflict resolution
  - Rule testing and validation

**Acceptance Criteria:**
- Context-aware detection works correctly
- ML-based detection implemented (if applicable)
- Hybrid detection improves accuracy
- Custom rules can be defined and tested
- Performance is acceptable
- Documentation complete

---

### 5.3 Advanced Pseudonymization Strategies

**Priority:** Medium  
**Description:** Implement advanced pseudonymization beyond simple dictionary replacement.

**Requirements:**
- **Context-Aware Pseudonymization:**
  - Generate pseudonyms that match context (e.g., realistic names, valid email formats)
  - Maintain consistency across documents/conversations
  - Preserve data types and formats

- **Reversible Pseudonymization:**
  - Enhanced reversal mechanisms
  - Support for complex pseudonymization patterns
  - Reversal validation and testing

- **Organization-Specific Pseudonymization:**
  - Custom pseudonym generation rules per organization
  - Organization-specific pseudonym dictionaries
  - Pseudonym style preferences

- **Advanced Pattern Replacement:**
  - Pattern-based pseudonym generation
  - Format-preserving pseudonymization
  - Semantic pseudonymization (e.g., replace "CEO" with "Executive")

**Acceptance Criteria:**
- Context-aware pseudonymization works
- Reversible pseudonymization functional
- Organization-specific rules work
- Pattern-based replacement implemented
- Documentation complete

---

### 5.4 PII Detection & Pseudonymization Admin UI

**Priority:** Medium  
**Description:** Build comprehensive admin UI for managing PII detection patterns, dictionaries, and pseudonymization rules.

**Requirements:**
- Pattern management UI:
  - CRUD for `redaction_patterns` table
  - Pattern testing interface
  - Pattern priority management
  - Pattern category organization
  - Pattern import/export

- Dictionary management UI:
  - Enhanced CRUD for `pseudonym_dictionaries`
  - Bulk import/export
  - Dictionary validation
  - Dictionary testing

- Detection analytics:
  - PII detection statistics
  - Pattern match rates
  - False positive tracking
  - Detection performance metrics

- Pseudonymization analytics:
  - Pseudonym usage statistics
  - Reversal success rates
  - Pseudonym consistency tracking

**Acceptance Criteria:**
- Pattern management UI functional
- Dictionary management UI functional
- Analytics dashboards work
- Import/export functionality works
- Testing interfaces available
- Documentation complete

---

## Section 6: Multi-Organization & Vertical Infrastructure

### 6.1 Organizations Table Population

**Priority:** High  
**Description:** Populate the organizations table with all vertical organizations and SaaS clients. This provides a complete organizational structure for the system.

**Current State (from v2-start):**
- `organizations` table exists (created in v2-start)
- Table structure: `slug`, `name`, `description`, `url`, `settings`, `created_at`, `updated_at`
- Basic seed file exists but needs expansion

**Requirements:**
- **Vertical Organizations:**
  - **Hiverarchy** - Vertical organization
  - **GolferGeek** - Vertical organization
  - **SmartLink** - Vertical organization
  
- **SaaS Clients:**
  - **IFM (Industrial Floor Maintenance)** - SaaS client
    - Contact: David Craig
    - Organization-specific settings and configurations
    - Custom RAG collections for IFM-specific content
  
- **Company Organization:**
  - **OrchestratorAI** - The company/organization name (this is the product/platform)
    - Platform-specific agents and tools
    - Educational and development agents
    - Custom RAG collections for platform documentation
    - Marketing content and features enabled
  
- **Note on Orchestrator Agent (Infrastructure):**
  - There is ONE Orchestrator agent (not multiple orchestrator agents)
  - The Orchestrator agent is NOT part of the organization/department hierarchy
  - It is a single infrastructure component that coordinates all agents
  - Agents belong to organizations but have a "department" field for categorization
  - The Orchestrator agent exists outside organizational boundaries
  - We do NOT use orchestrator agents as departments - there is only one Orchestrator agent
  
- **Organization Seed Data:**
  - Create comprehensive seed file with all organizations
  - Include organization metadata (descriptions, URLs)
  - Organization-specific settings (JSONB field)
  - Default organization configurations
  
- **Organization Management:**
  - Admin UI for managing organizations
  - CRUD operations for organizations
  - Organization settings management
  - Organization-specific feature flags

**Acceptance Criteria:**
- All vertical organizations in database (Hiverarchy, GolferGeek, SmartLink)
- IFM organization created with David Craig as contact
- OrchestratorAI organization created (company/platform organization)
- Seed file includes all organizations
- Organization management UI functional
- Organization-specific settings can be configured
- Agent schema includes "department" field (separate from organization)
- Documentation complete

---

### 6.2 Organization-Specific RAG Collections

**Priority:** High  
**Description:** Set up RAG collections for each organization, ensuring all RAG capabilities are available to each organization. This includes marketing content, knowledge bases, and organization-specific documentation.

**Requirements:**
- **RAG Collection Setup:**
  - Create RAG collections for each organization
  - Organization-specific knowledge bases
  - Marketing content collections
  - Documentation collections
  
- **IFM-Specific RAG:**
  - Industrial Floor Maintenance knowledge base
  - IFM marketing content
  - IFM-specific documentation
  - Industry-specific content
  
- **Vertical Organization RAG:**
  - Hiverarchy knowledge base and content
  - GolferGeek knowledge base and content
  - SmartLink knowledge base and content
  
- **OrchestratorAI RAG:**
  - Platform documentation and knowledge base
  - Educational content and learning materials
  - Development guides and best practices
  - Company/platform-specific content
  
- **RAG Access Control:**
  - Organization-scoped RAG collections
  - Agents can access organization-specific RAG
  - Multi-organization RAG support
  - Cross-organization RAG (if needed)

**Acceptance Criteria:**
- RAG collections created for all organizations
- IFM-specific content ingested
- Marketing content available for all organizations
- Organization-scoped access works correctly
- Agents can query organization-specific RAG
- Documentation complete

---

### 6.3 Agent Department Field & Organization Scoping

**Priority:** Medium  
**Description:** Extend agent schema to include "department" field for categorization, while maintaining organization scoping. The Orchestrator agent exists outside this structure as infrastructure.

**Requirements:**
- **Agent Schema Extension:**
  - Add `department` field to agent table/schema
  - Department is metadata for categorization (e.g., "platform", "marketing", "hr", "engineering")
  - Organization scoping remains for access control and data isolation
  - Agents belong to organizations but are categorized by department
  
- **Orchestrator Agent:**
  - Single Orchestrator agent (not part of organization/department hierarchy)
  - Infrastructure component that coordinates all agents
  - Can discover and route to agents across all organizations/departments
  - Exists outside organizational boundaries
  
- **Department Usage:**
  - Department field used for agent categorization and discovery
  - Allows filtering agents by department regardless of organization
  - Useful for orchestrator agent routing decisions
  - Does not affect access control (organization handles that)
  - **No formal department management** - departments emerge dynamically from what agents define

**Acceptance Criteria:**
- Agent schema includes department field
- Organization scoping still works for access control
- Orchestrator agent exists as single infrastructure component
- Department-based filtering works
- Orchestrator can discover agents across all departments/organizations
- Documentation complete

---

### 6.4 Agent Discovery & Navigation UI

**Priority:** High  
**Description:** Implement agent discovery and navigation UI that dynamically organizes agents by department based on the selected organization. Departments are not formally managed - they emerge from agent department fields.

**Current State (from v2-start):**
- AgentTreeView component exists for displaying agents
- Agents filtered by namespace/organization
- Hierarchy-based display (orchestrator/manager pattern)

**Requirements:**
- **Organization Selection:**
  - User selects organization (if they have access to multiple)
  - System discovers all agents for that organization
  - Organization selection determines which agents are visible
  
- **Dynamic Department Discovery:**
  - Query all agents for selected organization
  - Extract unique department values from agent department fields
  - Group agents by their department field
  - No formal department structure - departments are whatever agents define
  - Each organization will have different departments based on their agents
  
- **Left Navigation Structure:**
  - **Orchestrator Agent:** Always visible in left nav (infrastructure component)
    - Initially limited functionality (just a clickable item)
    - Will coordinate all agents (functionality built in later videos)
    - Not part of department structure
  
  - **Departments:** Dynamically displayed based on agent department fields
    - Each department appears as a section/group in left nav
    - Departments contain agents that belong to that department
    - Departments are not formally created/managed - they emerge from agents
    - Each organization will have different departments
  
- **Agent Organization:**
  - Agents grouped under their department in left nav
  - No "reports to orchestrator agent" structure
  - Departments are flat - agents belong to departments, not hierarchies
  - Agent display shows: department → agents within that department

**Discovery Flow:**
1. User selects organization (if multiple available)
2. System queries: `GET /api/agents?organization_slug={selected_org}`
3. System groups agents by `department` field
4. System extracts unique departments from agent set
5. Left nav displays:
   - Orchestrator (infrastructure, always visible)
   - Department 1 (with agents)
   - Department 2 (with agents)
   - ... (all departments that exist in agents)

**UI/UX Requirements:**
- Left navigation sidebar
- Orchestrator agent always visible at top (or in dedicated section)
- Departments as collapsible sections/groups
- Agents listed under their department
- Clear visual hierarchy: Orchestrator → Departments → Agents
- Responsive design
- Search/filter capabilities

**Acceptance Criteria:**
- Organization selection works correctly
- Agents discovered for selected organization
- Agents grouped by department dynamically
- Departments appear in left nav based on agent department fields
- Orchestrator agent visible in nav (limited functionality initially)
- No formal department management UI needed
- Each organization shows different departments based on their agents
- Navigation structure is clear and intuitive
- Documentation complete

**Technical Considerations:**
- Update AgentTreeView or create new navigation component
- Backend endpoint to get agents by organization
- Client-side grouping by department field
- Handle organizations with no agents gracefully
- Handle agents with no department field (maybe "Uncategorized" department)

---

## Section 7: MCP Servers & Tools Integration

### 7.1 Core MCP Server Setup

**Priority:** High  
**Description:** Set up and configure MCP servers for key integrations. These servers must be discoverable and available for the orchestrator agent and other agents that need them.

**Requirements:**
- **MCP Server Infrastructure:**
  - MCP server discovery mechanism
  - MCP server registration system
  - MCP server health monitoring
  - MCP server configuration management
  
- **Required MCP Servers:**
  - **Notion MCP** - Integration with Notion workspaces
  - **LinkedIn MCP** - LinkedIn API integration
  - **Slack MCP** - Slack workspace integration
  - **AnyType MCP** - AnyType database integration
  - **Supabase MCP** - Supabase database operations
  
- **MCP Server Features:**
  - Authentication and credential management
  - Error handling and retry logic
  - Rate limiting and throttling
  - Connection pooling
  - Logging and monitoring

**Acceptance Criteria:**
- All required MCP servers configured and running
- MCP servers discoverable by orchestrator agent
- Authentication works for all servers
- Error handling robust
- Health monitoring functional
- Documentation complete

---

### 7.2 LangGraph Tools for MCP Integration

**Priority:** High  
**Description:** Create LangGraph tools that wrap MCP server capabilities, making MCP functionality available to all LangGraph agents.

**Requirements:**
- **LangGraph MCP Tools:**
  - Notion tool (read/write pages, databases)
  - LinkedIn tool (post content, read feeds, network operations)
  - Slack tool (send messages, read channels, manage workspaces)
  - AnyType tool (database operations, content management)
  - Supabase tool (database queries, real-time subscriptions)
  
- **Tool Implementation:**
  - Each MCP server wrapped as LangGraph tool
  - Tools in shared `tools/` module
  - Proper error handling
  - Type-safe interfaces
  - Well-documented with examples
  
- **Tool Availability:**
  - Tools available to all LangGraph agents
  - Agent-specific tool configuration
  - Tool permission system (if needed)
  - Tool usage tracking

**Acceptance Criteria:**
- All MCP tools implemented as LangGraph tools
- Tools available in shared tools module
- Agents can use MCP tools
- Error handling works correctly
- Documentation complete with examples

---

### 7.3 Orchestrator Agent Architecture & MCP Integration

**Priority:** High  
**Description:** Design and implement the single Orchestrator agent as an infrastructure component. Initially, it appears in the left navigation with limited functionality. Full coordination capabilities will be built in later videos.

**Requirements:**
- **Orchestrator Agent Architecture:**
  - Single Orchestrator agent (not part of organization structure)
  - Infrastructure component, not a department agent
  - Initially: Appears in left nav as clickable item (limited functionality)
  - Eventually: Can discover and route to all agents across all organizations/departments
  - Eventually: Coordinates multi-agent workflows
  - Eventually: Manages agent-to-agent communication
  
- **Initial Implementation (v2-start/v2-final early):**
  - Orchestrator agent visible in left navigation
  - Basic UI/placeholder functionality
  - Not yet coordinating agents (that comes later)
  - Serves as infrastructure placeholder
  
- **MCP Integration (Later):**
  - Orchestrator agent MCP discovery
  - Dynamic MCP tool registration
  - MCP tool routing logic
  - Orchestrator agent can use any MCP tool
  - MCP tool coordination in multi-agent workflows
  
- **Agent Discovery (Later):**
  - Discover agents by organization
  - Discover agents by department
  - Discover agents by capability/type
  - Route tasks to appropriate agents based on requirements

**Acceptance Criteria:**
- Single Orchestrator agent implemented as infrastructure
- Orchestrator exists outside organization hierarchy
- Orchestrator visible in left nav (initially limited functionality)
- Full coordination capabilities built incrementally in later videos
- Orchestrator discovers all MCP servers (when implemented)
- Orchestrator can discover and route to all agents (when implemented)
- Tool routing works correctly (when implemented)
- Multi-agent coordination functional (when implemented)
- Documentation complete

---

## Section 8: Media Generation Capabilities

### 8.1 Image Generation Integration

**Priority:** High  
**Description:** Integrate image generation capabilities from OpenAI and Google, making image generation available as tools for agents.

**Requirements:**
- **OpenAI Image Generation:**
  - DALL-E 3 API integration
  - GPT Image API integration (when available)
  - Image generation API wrapper
  - Image generation parameters (size, quality, style, model)
  - Image storage and retrieval
  
- **Google Image Generation:**
  - Google Imagen via Vertex AI integration
  - Gemini image generation capabilities
  - Image generation API wrapper
  - Image generation parameters
  - Image storage and retrieval
  
- **LangGraph Image Generation Tool:**
  - Unified image generation tool
  - Provider selection (OpenAI or Google)
  - Tool parameters: prompt, size, style, provider, model
  - Returns generated image URL or data
  
- **MCP Image Generation Tool:**
  - MCP tool for image generation
  - Same parameters as LangGraph tool
  - Available via MCP protocol

**API Documentation & Resources:**
- **OpenAI DALL-E API:** https://platform.openai.com/docs/guides/images
- **OpenAI DALL-E 3 Documentation:** https://help.openai.com/en/articles/8555480
- **OpenAI Image Generation API:** https://openai.com/index/image-generation-api/
- **OpenAI GPT Image API:** https://help.openai.com/zh-hans-cn/articles/11128753-gpt-image-api
- **Google Imagen (Vertex AI):** https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation
- **Google Gemini Image Generation:** https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation
- **Video Tutorial - OpenAI DALL-E API:** https://www.youtube.com/watch?v=0S2acIMiA2c

**Acceptance Criteria:**
- OpenAI image generation works (DALL-E 3 and GPT Image API)
- Google image generation works (Imagen/Vertex AI)
- LangGraph tool implemented
- MCP tool implemented
- Images stored and retrievable
- Documentation complete with examples and API links

---

### 8.2 Video Generation Integration

**Priority:** High  
**Description:** Integrate video generation capabilities from OpenAI and Google, making video generation available as tools for agents.

**Requirements:**
- **OpenAI Video Generation:**
  - OpenAI Sora API integration (when available - monitor OpenAI announcements)
  - Video generation API wrapper
  - Video generation parameters (duration, quality, style, aspect ratio)
  - Video storage and retrieval
  
- **Google Video Generation:**
  - Google Veo/Imagen Video API integration (when available)
  - Video generation API wrapper
  - Video generation parameters
  - Video storage and retrieval
  
- **Alternative Video Generation APIs:**
  - Runway ML API (as alternative/additional option)
  - Synthesia API (for AI avatar videos)
  - Consider multiple providers for redundancy
  
- **LangGraph Video Generation Tool:**
  - Unified video generation tool
  - Provider selection (OpenAI, Google, or alternatives)
  - Tool parameters: prompt, duration, style, provider, aspect_ratio
  - Returns generated video URL or data
  
- **MCP Video Generation Tool:**
  - MCP tool for video generation
  - Same parameters as LangGraph tool
  - Available via MCP protocol

**API Documentation & Resources:**
- **OpenAI Sora:** Monitor https://openai.com/ for Sora API availability
- **Google Veo/Imagen Video:** Monitor https://cloud.google.com/vertex-ai for video generation API
- **Runway ML API:** https://docs.runwayml.com/ (alternative video generation)
- **Synthesia API:** https://docs.synthesia.io/ (AI avatar video generation)
- **Note:** Video generation APIs are rapidly evolving - check latest documentation

**Acceptance Criteria:**
- OpenAI video generation works (when Sora API available)
- Google video generation works (when API available)
- Alternative providers integrated (Runway, Synthesia)
- LangGraph tool implemented
- MCP tool implemented
- Videos stored and retrievable
- Documentation complete with examples and API links
- Monitoring system for new API availability

---

### 8.3 Media Generation UI & Management

**Priority:** Medium  
**Description:** Create admin UI for managing media generation, viewing generated images/videos, and configuring media generation settings.

**Requirements:**
- Media gallery UI (images and videos)
- Media generation history
- Media metadata and tags
- Media search and filtering
- Media organization by agent/task
- Media generation settings configuration

**Acceptance Criteria:**
- Media gallery UI functional
- Media history tracked
- Search and filtering work
- Settings configurable
- Documentation complete

---

## Section 9: Educational Content & Training

**Note:** Every feature in this PRD will be built through educational videos. The entire v2-final-solution will be constructed incrementally via video-based learning (Loom and YouTube), making this both product development and comprehensive education.

### 9.1 Video-Based Development & Learning

**Priority:** Critical  
**Description:** Every component, feature, and capability in v2-final-solution will be built through educational videos. This creates a comprehensive learning resource while simultaneously building the product.

**Requirements:**
- **Video Production:**
  - All features built via screen recordings
  - Combination of Loom (quick captures) and YouTube (long-form tutorials)
  - Clear narration explaining decisions and approaches
  - Real-time problem-solving and debugging shown
  
- **Video Organization:**
  - Videos organized by feature/section
  - Playlists for related topics
  - Video metadata and descriptions
  - Timestamps for key sections
  - Links from documentation to videos
  
- **Video Content Standards:**
  - Show complete development process (not just final result)
  - Include mistakes, debugging, and course corrections
  - Explain "why" not just "what"
  - Connect concepts to broader architecture
  - Reference related videos and concepts

**Acceptance Criteria:**
- Video production process established
- All major features have accompanying videos
- Videos are well-organized and discoverable
- Video quality is consistent
- Documentation links to relevant videos

---

### 9.2 Agent Builder Development

**Priority:** High  
**Description:** Build agent builders as Claude Code agents with skills and commands. These builders will help users create and configure agents more efficiently.

**Requirements:**
- **Claude Code Agent Builder:**
  - Agent builder as Claude Code agent
  - Skills for agent creation (agent scaffolding, configuration, testing)
  - Commands for agent management
  - Interactive agent creation workflow
  - Agent template system
  
- **Agent Builder Capabilities:**
  - Generate agent JSON/YAML files
  - Create agent directory structure
  - Generate boilerplate code
  - Configure agent endpoints
  - Set up agent testing
  - Validate agent configurations
  
- **Agent Builder Skills:**
  - Agent scaffolding skill
  - Agent configuration skill
  - Agent testing skill
  - Agent deployment skill
  - Agent documentation generation skill

**Acceptance Criteria:**
- Agent builder implemented as Claude Code agent
- Skills functional for agent creation
- Commands work correctly
- Can generate complete agent structures
- Documentation complete with video walkthrough

---

### 9.3 Multi-Environment Coding Education

**Priority:** High  
**Description:** Teach coding across multiple AI-powered development environments, showing students how to work effectively in each environment and when to use which tool.

**Requirements:**
- **Supported Coding Environments:**
  - **Cursor** - AI-powered IDE
  - **Claude Code** - Anthropic's coding environment
  - **WindSurf** - Browser-based AI coding
  - **Google Antigravity** - Google's AI coding tool
  - **Codex** - OpenAI's coding assistant
  
- **Environment-Specific Content:**
  - Setup and configuration for each environment
  - Environment-specific workflows and patterns
  - Best practices for each tool
  - When to use which environment
  - Migration between environments
  
- **Web-Based Coding:**
  - Coding through web interfaces
  - GitHub integration and workflows
  - Web-based IDE usage
  - Cloud development environments
  - Collaborative coding patterns

**Acceptance Criteria:**
- Educational content for all coding environments
- Setup guides for each environment
- Best practices documented
- Web-based coding workflows explained
- GitHub integration covered
- Video tutorials for each environment

---

### 9.4 Guardrails & Safety Patterns

**Priority:** High  
**Description:** Teach the concept of "guardrails" through sub-agents, skills, commands, orchestrator agents, and proper context/prompt engineering. Emphasize how these patterns provide safety and reliability.

**Requirements:**
- **Guardrails Concepts:**
  - What are guardrails in agent systems
  - Why guardrails are essential
  - How guardrails prevent errors and misuse
  
- **Guardrails Implementation Patterns:**
  - **Sub-agents as guardrails** - Using specialized agents to validate and constrain behavior
  - **Skills as guardrails** - Encapsulating safe, tested functionality
  - **Commands as guardrails** - Providing controlled interfaces
  - **Orchestrator agent as guardrail** - Single infrastructure component coordinating and validating multi-agent workflows (exists outside organization/department hierarchy)
  - **Context engineering as guardrails** - Using proper context to guide agent behavior
  - **Prompt engineering as guardrails** - Crafting prompts that constrain and guide responses
  
- **Guardrails in Practice:**
  - Examples of guardrails in each agent
  - How to design guardrails for new agents
  - Testing guardrails effectiveness
  - Guardrails for different risk levels
  - Guardrails for different use cases
  
- **Technology Change Awareness:**
  - Emphasize that technology changes rapidly
  - Teach students to expect and adapt to change
  - Show how guardrails help maintain stability during change
  - Discuss how patterns may become outdated
  - Teach principles that transcend specific technologies

**Acceptance Criteria:**
- Guardrails concepts clearly explained
- All guardrails patterns documented with examples
- Practical examples in actual agents
- Technology change awareness emphasized throughout
- Video tutorials showing guardrails in action
- Students understand guardrails are essential, not optional

---

### 9.5 Standards Education (A2A, MCP, Emerging)

**Priority:** High  
**Description:** Teach industry standards as they emerge and evolve, ensuring students understand how standards enable interoperability and future-proof their work.

**Requirements:**
- **A2A (Agent-to-Agent) Standard:**
  - What is A2A standard
  - How A2A enables agent interoperability
  - Implementing A2A-compatible agents
  - `.well-known/agent.json` format
  - A2A discovery and communication
  
- **MCP (Model Context Protocol) Standard:**
  - What is MCP standard
  - MCP server implementation
  - MCP tool development
  - MCP client integration
  - MCP best practices
  
- **Emerging Standards:**
  - Monitor for new standards as they emerge
  - Update educational content as standards evolve
  - Teach students how to evaluate new standards
  - Show how to adapt to standard changes
  - Emphasize standards' role in interoperability
  
- **Standards Integration:**
  - How standards work together
  - Using multiple standards in one system
  - Standards vs proprietary solutions
  - When to adopt new standards
  - Migration strategies

**Acceptance Criteria:**
- A2A standard fully documented and demonstrated
- MCP standard fully documented and demonstrated
- Process for tracking emerging standards established
- Educational content updated as standards evolve
- Video tutorials showing standards in practice
- Students understand standards' importance

---

### 9.6 LangGraph Expertise Development

**Priority:** High  
**Description:** Build comprehensive expertise in LangGraph through hands-on development, video tutorials, and real-world agent implementations.

**Requirements:**
- **LangGraph Fundamentals:**
  - LangGraph architecture and concepts
  - State management in LangGraph
  - Node and edge patterns
  - Checkpointing and persistence
  - Streaming and observability
  
- **Advanced LangGraph Patterns:**
  - Multi-agent workflows
  - Complex state transitions
  - Conditional routing
  - Human-in-the-loop integration
  - Error handling and recovery
  
- **LangGraph Tools:**
  - Creating custom tools
  - Tool composition
  - Tool error handling
  - Tool testing strategies
  
- **LangGraph Best Practices:**
  - Performance optimization
  - State design patterns
  - Testing strategies
  - Debugging techniques
  - Production deployment

**Acceptance Criteria:**
- Comprehensive LangGraph educational content
- Multiple LangGraph agent examples
- Video tutorials covering LangGraph concepts
- Best practices documented
- Students can build complex LangGraph agents

---

### 9.7 N8N Expertise Development

**Priority:** High  
**Description:** Build comprehensive expertise in N8N through hands-on development, video tutorials, and real-world workflow implementations.

**Requirements:**
- **N8N Fundamentals:**
  - N8N architecture and concepts
  - Workflow design patterns
  - Node types and usage
  - Data flow and transformation
  - Error handling in N8N
  
- **Advanced N8N Patterns:**
  - Complex workflows
  - Conditional logic
  - Loops and iterations
  - Webhook handling
  - API integrations
  
- **N8N Agent Development:**
  - Creating N8N-based agents
  - Agent-to-agent communication via N8N
  - N8N workflow optimization
  - N8N testing strategies
  
- **N8N Best Practices:**
  - Workflow organization
  - Performance optimization
  - Error handling patterns
  - Testing strategies
  - Production deployment

**Acceptance Criteria:**
- Comprehensive N8N educational content
- Multiple N8N workflow examples
- Video tutorials covering N8N concepts
- Best practices documented
- Students can build complex N8N workflows and agents

---

### 9.8 Agent Development Examples

**Priority:** High  
**Description:** Build actual agents (one LangGraph, one N8N) as comprehensive examples that demonstrate all concepts, patterns, and best practices.

**Requirements:**
- **LangGraph Agent Example:**
  - Complete LangGraph agent implementation
  - Demonstrates all LangGraph patterns
  - Shows guardrails in practice
  - Uses skills, commands, and tools
  - Includes comprehensive documentation
  - Video walkthrough of entire development process
  
- **N8N Agent Example:**
  - Complete N8N agent implementation
  - Demonstrates all N8N patterns
  - Shows guardrails in practice
  - Includes comprehensive documentation
  - Video walkthrough of entire development process
  
- **Example Agent Features:**
  - Real-world use case
  - Multiple guardrails implemented
  - Standards compliance (A2A, MCP)
  - Comprehensive testing
  - Production-ready patterns
  - Educational annotations

**Acceptance Criteria:**
- LangGraph example agent complete
- N8N example agent complete
- Both agents demonstrate all key concepts
- Comprehensive documentation for each
- Video walkthroughs produced
- Students can use examples as templates

---

### 9.9 Skills, Commands, and Orchestrator Patterns

**Priority:** High  
**Description:** Comprehensive education on skills, commands, and orchestrator agent patterns, showing how these components work together to create robust agent systems.

**Requirements:**
- **Skills Education:**
  - What are skills and why they matter
  - Creating reusable skills
  - Skill composition and chaining
  - Skill testing and validation
  - Skills as guardrails
  
- **Commands Education:**
  - What are commands and their role
  - Creating command interfaces
  - Command validation and safety
  - Commands as guardrails
  - Command composition
  
- **Orchestrator Agent Patterns:**
  - What is an orchestrator agent (infrastructure component, not a department)
  - Orchestrator design patterns
  - Single orchestrator vs multiple orchestrators
  - Multi-agent coordination
  - Orchestrator as guardrail
  - Orchestrator best practices
  - Orchestrator exists outside organization/department hierarchy
  
- **Integration Patterns:**
  - How skills, commands, and orchestrators work together
  - Building complex systems from components
  - Patterns for different use cases
  - Anti-patterns to avoid

**Acceptance Criteria:**
- Comprehensive skills education complete
- Commands education complete
- Orchestrator patterns documented
- Integration patterns explained
- Video tutorials for each concept
- Practical examples provided

---

### 9.10 Context & Prompt Engineering

**Priority:** High  
**Description:** Teach proper context and prompt engineering as critical guardrails and quality mechanisms for agent systems.

**Requirements:**
- **Context Engineering:**
  - What is context engineering
  - How to structure context effectively
  - Context as guardrail
  - Context optimization strategies
  - Context for different agent types
  
- **Prompt Engineering:**
  - What is prompt engineering
  - Prompt design patterns
  - Prompts as guardrails
  - Prompt optimization techniques
  - Prompt testing and validation
  
- **RAG Integration:**
  - Using RAG for context enhancement
  - Context retrieval strategies
  - Context quality and relevance
  - RAG as context guardrail
  
- **Best Practices:**
  - Context engineering best practices
  - Prompt engineering best practices
  - Testing context and prompts
  - Iterative improvement strategies

**Acceptance Criteria:**
- Context engineering fully documented
- Prompt engineering fully documented
- RAG integration explained
- Best practices documented
- Video tutorials provided
- Practical examples and exercises

---

### 9.11 Video Production & Organization

**Priority:** High  
**Description:** Establish comprehensive video production workflow and organization system to support the entire educational program.

**Requirements:**
- **Video Production Workflow:**
  - Pre-production planning
  - Recording standards and tools
  - Post-production editing
  - Quality standards
  - Publishing workflow
  
- **Video Organization:**
  - YouTube channel organization
  - Playlist structure
  - Video metadata and SEO
  - Cross-referencing between videos
  - Progress tracking
  
- **Loom Integration:**
  - Quick capture workflow
  - When to use Loom vs YouTube
  - Loom to YouTube migration process
  - Loom organization
  
- **Video Content Standards:**
  - Consistent format and style
  - Clear learning objectives
  - Code examples and demonstrations
  - Real-world applications
  - Links to related content

**Acceptance Criteria:**
- Video production workflow established
- Video organization system functional
- Consistent quality across videos
- Easy discovery and navigation
- Progress tracking works
- Documentation links to videos

---

## Section 10: Video Roadmap - From v2-Start to v2-Final-Solution

**Video Development Philosophy:**
- **Two Codebases:** One experimental codebase for testing/learning, one production codebase built entirely on video
- **Everything On Camera:** Nothing is built off-camera - all development happens during video recording
- **30-Minute Videos:** Each video is focused, ~30 minutes, building one logical component
- **Teaching While Building:** Education happens WHILE building agents - no separate teaching phases. Each agent build teaches specific concepts.
- **Documented Learning:** Each video clearly documents what concepts are being taught (LangGraph, RAG, MCP, guardrails, etc.)
- **Branch Checkpoints:** After each major milestone (agent completion), create a git branch checkpoint for students to jump ahead if needed
- **Clear Flow:** Each video starts with "Here's where we were" and ends with "Here's what we built and learned"

**Video Structure:**
- **Opening (2-3 min):** Recap previous video, show current state, introduce today's goal and what we'll learn
- **Building (20-25 min):** Build the feature/agent while teaching concepts, explain decisions, show debugging
- **Closing (2-3 min):** Test what we built, summarize what we learned, document concepts taught, preview next video

**Agent Building Approach:**
- **~25 Agents:** Build agents for each vertical (Hiverarchy, GolferGeek, SmartLink, IFM, etc.)
- **Integrated Education:** Each agent teaches specific concepts (LangGraph patterns, RAG usage, MCP tools, guardrails, etc.)
- **Progressive Complexity:** Start with simpler agents, build to more complex ones
- **Concept Documentation:** Each video clearly lists what concepts are being taught

---

### Phase 1: Foundation & Infrastructure Setup (Videos 1-6)

#### Video 1: Multi-Organization Infrastructure Setup
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v1-organization-setup`  
**Starting Point:** v2-start completion (all foundational work done)

**What We Build:**
- Populate organizations table with verticals (Hiverarchy, GolferGeek, SmartLink)
- Add IFM (Industrial Floor Maintenance) organization for David Craig
- Add OrchestratorAI organization (company/platform organization)
- Add "department" field to agent schema
- Create organization seed file
- Set up organization-scoped configurations
- Note: There is ONE Orchestrator agent (infrastructure), not orchestrator agents as departments

**What We Teach:**
- Database migrations and seed files
- Organization-scoped architecture patterns
- Multi-tenant data isolation concepts
- Using Cursor/Claude Code for database work

**Key Concepts:**
- Organizations as first-class entities
- Scoping data by organization
- Seed file best practices

**Deliverables:**
- Organizations table populated
- Seed file created
- Organization management ready

---

#### Video 2: Organization-Specific RAG Collections
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v2-org-rag-collections`  
**Starting Point:** Video 1 completion

**What We Build:**
- Create RAG collections for each organization
- Set up IFM-specific knowledge base
- Set up OrchestratorAI platform documentation RAG collection
- Ingest organization-specific content
- Configure organization-scoped RAG access

**What We Teach:**
- RAG collection management
- Document ingestion workflows
- Organization-scoped RAG patterns
- Using RAG UI for content management

**Key Concepts:**
- RAG as organization-specific knowledge
- Content organization strategies
- RAG access control

**Deliverables:**
- RAG collections for all organizations
- IFM knowledge base populated
- OrchestratorAI platform documentation RAG collection created
- Organization-scoped RAG working

---

#### Video 3: Agent Department Field & Discovery UI
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v3-agent-department-discovery`  
**Starting Point:** Video 2 completion

**What We Build:**
- Add department field to agent schema
- Organization-scoped agent configuration
- Agent discovery by organization
- Dynamic department grouping from agent department fields
- Left navigation UI: Orchestrator + Departments
- Add Orchestrator agent to left nav (infrastructure component, limited functionality initially)
- Update AgentTreeView or create new navigation component

**What We Teach:**
- Agent schema evolution (adding department field)
- Dynamic data organization (departments emerge from agents, not formally managed)
- Organization-based discovery patterns
- UI component architecture (navigation components)
- Infrastructure vs business components in UI
- Using Cursor/Claude Code for Vue.js development

**Concepts Taught:**
- **Department as Metadata:** Department is a field on agents, not a formal structure
- **Dynamic Organization:** Departments appear based on what agents define - no formal department management
- **Discovery Pattern:** Organization → Get Agents → Group by Department → Display in Nav
- **Navigation Architecture:** Infrastructure (Orchestrator, always visible) + Dynamic Groups (Departments, emerge from agents)
- **No Formal Departments:** We don't build departments - they're whatever the agents define

**Coding Environment:** Cursor / Claude Code

**Deliverables:**
- Department field added to agent schema
- Agents scoped to organizations
- Discovery endpoint: get agents by organization
- Dynamic department grouping working
- Left nav shows Orchestrator (infrastructure, limited functionality) + Departments (dynamic)
- Navigation UI functional
- Each organization shows different departments based on their agents

---

### Phase 2: Observability System (Videos 7-8)

#### Video 7: Advanced Observability UI Enhancement
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v7-advanced-observability`  
**Starting Point:** Video 6 completion

**What We Build:**
- Enhance admin observability UI
- Add advanced filtering and search
- Implement event timeline visualization
- Add performance metrics dashboard
- Build event correlation features

**What We Teach:**
- UI/UX for observability systems
- Timeline visualization techniques
- Performance metrics and analytics
- Event correlation patterns
- Using Cursor for Vue.js development

**Concepts Taught:**
- Observability patterns and best practices
- Data visualization in admin interfaces
- Real-time UI updates
- Performance monitoring dashboards
- Event relationship mapping

**Coding Environment:** Cursor

**Deliverables:**
- Enhanced observability UI
- Advanced filtering working
- Timeline visualization functional
- Performance dashboard complete

---

#### Video 8: Agent Swim Lane Visualization
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v8-swim-lanes`  
**Starting Point:** Video 7 completion

**What We Build:**
- Implement swim lane layout system
- Create timeline visualization across all lanes
- Add agent activity indicators
- Build parallel processing visualization
- Add agent interaction visualization (arrows between lanes)

**What We Teach:**
- Swim lane visualization concepts
- Timeline visualization libraries (vis.js, D3.js, or custom)
- Real-time UI state management
- Complex UI component architecture
- Agent execution flow visualization

**Concepts Taught:**
- Visual agent monitoring patterns
- Parallel execution visualization
- Real-time dashboard updates
- Complex state management in Vue
- Timeline rendering optimization

**Coding Environment:** Cursor / WindSurf

**Deliverables:**
- Swim lane visualization working
- Timeline functional across lanes
- Agent activity visible in real-time
- Parallel execution clearly visualized

---

### Phase 3: MCP Servers & Tools Setup (Videos 9-11)

#### Video 9: MCP Server Infrastructure Setup
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v4-advanced-rag-architecture`  
**Starting Point:** Video 3 completion

**What We Build:**
- Extend RAG database schema for advanced strategies
- Create strategy configuration system
- Set up unified RAG API for multiple strategies
- Implement strategy selection mechanism

**What We Teach:**
- Database schema evolution
- Strategy pattern implementation
- API design for extensibility
- Using Claude Code for architecture decisions

**Key Concepts:**
- Extensible architecture
- Strategy pattern
- API versioning considerations

**Deliverables:**
- Extended RAG schema
- Strategy configuration system
- Unified API foundation

---

#### Video 5: Parent Document & Multi-Query RAG
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v5-parent-multiquery-rag`  
**Starting Point:** Video 4 completion

**What We Build:**
- Implement Parent Document RAG strategy
- Implement Multi-Query RAG strategy
- Add strategy-specific endpoints
- Test both strategies with real queries

**What We Teach:**
- Parent Document RAG concepts
- Multi-query generation patterns
- Strategy implementation details
- Testing RAG strategies

**Key Concepts:**
- Retrieval strategies
- Query expansion
- Context hierarchy

**Deliverables:**
- Two advanced RAG strategies working
- Strategy testing framework
- Documentation for both strategies

---

#### Video 6: Hybrid Search & Self-RAG Implementation
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v6-hybrid-self-rag`  
**Starting Point:** Video 5 completion

**What We Build:**
- Implement Hybrid Search RAG (vector + keyword)
- Implement Self-RAG strategy
- Add ensemble capabilities
- Compare strategy performance

**What We Teach:**
- Hybrid search concepts
- Self-reflective RAG patterns
- Performance comparison
- Using Cursor for complex logic

**Key Concepts:**
- Combining search methods
- Self-evaluation in RAG
- Performance optimization

**Deliverables:**
- Hybrid Search RAG working
- Self-RAG implemented
- Performance comparison tools

---

### Phase 3: MCP Servers & Tools Setup (Videos 9-11)

#### Video 9: MCP Server Infrastructure Setup
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v9-mcp-infrastructure`  
**Starting Point:** Video 8 completion

**What We Build:**
- Set up MCP server discovery mechanism
- Create MCP server registration system
- Implement MCP server health monitoring
- Build MCP configuration management

**What We Teach:**
- MCP protocol basics
- Server discovery patterns
- Health monitoring strategies
- Configuration management

**Key Concepts:**
- MCP standard
- Service discovery
- Health checks

**Deliverables:**
- MCP infrastructure ready
- Server discovery working
- Health monitoring functional

---

#### Video 10: Notion & LinkedIn MCP Servers
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v10-notion-linkedin-mcp`  
**Starting Point:** Video 9 completion

**What We Build:**
- Implement Notion MCP server
- Implement LinkedIn MCP server
- Create authentication flows
- Build basic read/write operations

**What We Teach:**
- MCP server implementation
- OAuth authentication flows
- API integration patterns
- Error handling in integrations

**Key Concepts:**
- MCP server structure
- Authentication best practices
- API rate limiting

**Deliverables:**
- Notion MCP server working
- LinkedIn MCP server working
- Authentication flows complete

---

#### Video 11: Slack, AnyType & Supabase MCP Servers + LangGraph Tools
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v11-mcp-servers-tools`  
**Starting Point:** Video 10 completion

**What We Build:**
- Implement Slack MCP server
- Implement AnyType MCP server
- Implement Supabase MCP server
- Create LangGraph tools wrapping all MCP servers
- Make tools available to all LangGraph agents

**What We Teach:**
- Multiple MCP server implementation patterns
- Database integration via MCP
- Real-time capabilities (Slack)
- LangGraph tool creation
- Wrapping MCP servers as LangGraph tools
- Using WindSurf for web-based coding

**Concepts Taught:**
- MCP server variety and patterns
- Database operations via MCP
- Real-time integrations
- LangGraph tool architecture
- Tool reusability patterns

**Coding Environment:** Cursor / WindSurf

**Deliverables:**
- All three MCP servers working
- LangGraph tools for all MCP servers
- Tools available to agents
- Unified MCP interface complete

---

### Phase 4: Agent Building - Teaching While Building (~25 Agents, Videos 12-36)

**Agent Building Philosophy:**
- **Education Integrated:** Each agent teaches specific concepts while building real functionality
- **Progressive Complexity:** Start with simpler agents, build to complex multi-agent workflows
- **Concept Documentation:** Each video clearly lists what concepts are being taught
- **Real-World Agents:** Build agents for actual verticals (Hiverarchy, GolferGeek, SmartLink, IFM)
- **Variety:** Mix of LangGraph agents, N8N agents, and hybrid approaches
- **Guardrails:** Every agent demonstrates guardrails (sub-agents, skills, commands, context engineering)

**Agent Categories:**
- **Simple Agents (Videos 12-18):** Basic functionality, single concept focus
- **Intermediate Agents (Videos 19-28):** Multiple concepts, RAG integration, MCP tools
- **Advanced Agents (Videos 29-36):** Complex workflows, multi-agent patterns, advanced guardrails

**Example Agent Videos (Structure):**

#### Video 12: Hierarchical Learning Material Builder Agent - Progressive Content Generation
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v12-hierarchical-learning-builder`  
**Starting Point:** Video 11 completion  
**Organization:** [TBD - can be any organization]  
**Department:** Platform/Education

**What We Build:**
- Hierarchical learning material builder agent
- Generates progressive learning content: elevator pitch → detailed understanding → interview questions → flashcards
- Multi-stage content generation workflow
- Agent type: LangGraph (multi-step workflow)

**What We Teach:**
- LangGraph multi-stage workflows
- Progressive content generation patterns
- Content structuring and organization
- RAG integration for subject matter research
- Guardrails via content validation sub-agents

**Concepts Taught:**
- **Multi-Stage Workflows:** Building LangGraph agents that progress through multiple stages, each building on the previous
- **Content Hierarchy:** Structuring educational content from high-level to detailed, ensuring logical progression
- **RAG for Research:** Using RAG to gather subject matter information before generating content
- **Validation Guardrails:** Using sub-agents to validate content quality at each stage before proceeding

**Coding Environment:** Claude Code / Cursor

**Deliverables:**
- Hierarchical learning builder agent complete
- Generates elevator pitch, detailed content, interview questions, and flashcards
- Multi-stage workflow functional
- Content validation working

---

#### Video 13: Visual UI Evaluation Agent - Scientific UI Analysis
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v13-ui-evaluation-agent`  
**Starting Point:** Video 12 completion  
**Organization:** [TBD - can be any organization]  
**Department:** Platform/Design

**What We Build:**
- Visual UI evaluation agent
- Analyzes visual designs with scientific understanding of pleasing UI
- Provides detailed recommendations
- Can produce improved output designs
- Agent type: LangGraph (with vision capabilities)

**What We Teach:**
- Vision model integration (GPT-4 Vision, Claude with vision, etc.)
- UI/UX design principles and scientific evaluation
- Image analysis and understanding
- Recommendation generation patterns
- Image generation integration (for producing improved designs)
- Guardrails via design principle validation

**Concepts Taught:**
- **Vision Model Integration:** Using LLMs with vision capabilities to analyze visual designs
- **Scientific UI Evaluation:** Applying design principles (gestalt principles, color theory, typography, spacing, etc.) systematically
- **Recommendation Systems:** Generating actionable, specific recommendations based on analysis
- **Image Generation Integration:** Using image generation tools to produce improved designs based on recommendations
- **Design Guardrails:** Validating recommendations against established design principles

**Coding Environment:** Claude Code / Cursor

**Deliverables:**
- UI evaluation agent complete
- Can analyze visual designs scientifically
- Generates detailed recommendations
- Can produce improved design outputs
- Design principle validation working

---

#### Video 14: [Agent Name] - [Primary Concept]
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v14-{agent-name}`  
**Starting Point:** Video 13 completion

**What We Build:**
- [Specific agent functionality]
- [Agent type: LangGraph/N8N/Hybrid]
- [Organization: Hiverarchy/GolferGeek/SmartLink/IFM]
- [Department: Platform/Marketing/HR/Engineering/etc.]

**What We Teach:**
- [Concept 1: e.g., "LangGraph state management basics"]
- [Concept 2: e.g., "Basic RAG integration"]
- [Concept 3: e.g., "Simple guardrails via prompt engineering"]

**Concepts Taught:**
- [Detailed explanation of Concept 1]
- [Detailed explanation of Concept 2]
- [Detailed explanation of Concept 3]

**Coding Environment:** [Cursor / Claude Code / WindSurf / etc.]

**Deliverables:**
- [Agent name] complete and working
- [Specific features] functional
- [Documentation] complete

---

**Note:** The following videos (14-36) will follow this same structure. Each agent teaches 2-4 specific concepts while building real functionality. Agents will be distributed across verticals and will progressively increase in complexity.

**Agent Distribution Plan:**
- **Hiverarchy:** ~6-7 agents
- **GolferGeek:** ~6-7 agents  
- **SmartLink:** ~6-7 agents
- **IFM (Industrial Floor Maintenance):** ~5-6 agents
- **OrchestratorAI:** ~2-3 agents (including hierarchical learning builder and UI evaluation agent)
- **Note:** The Orchestrator agent (singular, infrastructure) is a single infrastructure component that coordinates all agents, not counted in agent distribution. There is ONE Orchestrator agent, not orchestrator agents as departments.

**Concept Coverage Across Agents:**
- LangGraph patterns (state management, nodes, edges, checkpoints)
- RAG strategies (basic, parent document, multi-query, hybrid)
- MCP tools (Notion, LinkedIn, Slack, AnyType, Supabase)
- Guardrails (sub-agents, skills, commands, context engineering, prompt engineering)
- N8N workflows (for N8N-based agents)
- Human-in-the-Loop patterns
- Agent-to-agent communication
- Error handling and recovery
- Testing strategies
- Deployment patterns

**Each Agent Video Will Include:**
- Clear "What We Build" section
- Explicit "What We Teach" list (2-4 concepts)
- Detailed "Concepts Taught" explanations
- Coding environment specified
- Deliverables clearly listed
- Branch checkpoint for students

---

### Phase 5: Media Generation & Advanced Features (Videos 37-40)

#### Video 37: Image Generation Integration

**What We Build:**
- Implement Slack MCP server
- Implement AnyType MCP server
- Implement Supabase MCP server
- Create unified MCP tool interface

**What We Teach:**
- Multiple MCP server patterns
- Database integration via MCP
- Real-time capabilities (Slack)
- Using WindSurf for web-based coding

**Key Concepts:**
- MCP server variety
- Database operations via MCP
- Real-time integrations

**Deliverables:**
- All three MCP servers working
- Unified MCP interface
- All servers discoverable

---

### Phase 4: Agent Building - Teaching While Building (~25 Agents, Videos 12-36)

#### Video 10: LangGraph MCP Tools Module
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v10-langgraph-mcp-tools`  
**Starting Point:** Video 9 completion

**What We Build:**
- Create LangGraph tools wrapping MCP servers
- Implement Notion LangGraph tool
- Implement LinkedIn LangGraph tool
- Make tools available to all LangGraph agents

**What We Teach:**
- LangGraph tool creation
- Wrapping external APIs as tools
- Tool composition patterns
- Using Claude Code for tool development

**Key Concepts:**
- LangGraph tools architecture
- Tool reusability
- Agent-tool integration

**Deliverables:**
- MCP tools as LangGraph tools
- Tools available to agents
- Tool documentation complete

---

#### Video 11: Enhanced LangGraph Agent with MCP Tools
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v11-enhanced-langgraph-agent`  
**Starting Point:** Video 10 completion

**What We Build:**
- Enhance existing LangGraph agent (Marketing Swarm or HR Assistant)
- Integrate MCP tools into agent workflow
- Add tool selection logic
- Test agent with new capabilities

**What We Teach:**
- Agent enhancement patterns
- Tool integration in workflows
- Decision-making in agents
- Testing enhanced agents

**Key Concepts:**
- Agent evolution
- Tool orchestration
- Workflow enhancement

**Deliverables:**
- Enhanced agent working
- MCP tools integrated
- Agent capabilities expanded

---


---

**Note:** Agent building is the core of our educational program. Each agent teaches specific concepts while building real functionality. Education is integrated into every agent build - no separate teaching phases.

**Agent Building Structure:**
- Each agent video builds one complete agent
- Each video teaches 2-4 specific concepts (documented clearly)
- Concepts taught include: LangGraph patterns, RAG usage, MCP tools, guardrails, N8N workflows, context engineering, prompt engineering, etc.
- Agents are built for different verticals (Hiverarchy, GolferGeek, SmartLink, IFM, etc.)
- Progressive complexity: simpler agents first, building to more complex ones

**Agent Video Template:**
Each agent video follows this structure:
- **What We Build:** The specific agent and its functionality
- **What We Teach:** List of concepts being taught (e.g., "LangGraph state management", "RAG with parent documents", "MCP Notion integration", "Guardrails via sub-agents")
- **Concepts Taught:** Detailed breakdown of what students learn
- **Coding Environment:** Which tool we're using (Cursor, Claude Code, WindSurf, etc.)
- **Deliverables:** What's complete at the end

### Phase 5: Media Generation & Advanced Features (Videos 37-40)

#### Video 37: Image Generation API Integration (OpenAI & Google)
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v37-image-generation`  
**Starting Point:** Video 36 completion

**What We Build:**
- Integrate OpenAI DALL-E API
- Integrate Google Imagen API
- Create unified image generation service
- Build image storage and retrieval

**What We Teach:**
- API integration patterns
- Image generation concepts
- Storage strategies
- Using Cursor for API work

**Key Concepts:**
- Image generation APIs
- Provider abstraction
- Media storage

**API Resources:**
- OpenAI DALL-E API: https://platform.openai.com/docs/guides/images
- OpenAI DALL-E 3: https://help.openai.com/en/articles/8555480
- Google Imagen (Vertex AI): https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation
- OpenAI Image Generation API: https://openai.com/index/image-generation-api/

**Deliverables:**
- Both image APIs integrated
- Unified image service
- Image storage working

---

#### Video 38: Image Generation LangGraph & MCP Tools
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v38-image-generation-tools`  
**Starting Point:** Video 37 completion

**What We Build:**
- Create LangGraph image generation tool
- Create MCP image generation tool
- Add image generation to agent workflows
- Build image gallery UI

**What We Teach:**
- Tool creation for media
- Media in agent workflows
- UI for media management
- Using GitHub for code organization

**Key Concepts:**
- Media tools
- Agent-media integration
- Media UI patterns

**Deliverables:**
- Image generation tools working
- Agents can generate images
- Image gallery UI functional

---

#### Video 39: Video Generation Integration
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v39-video-generation`  
**Starting Point:** Video 38 completion

**What We Build:**
- Integrate OpenAI video generation (Sora when available)
- Integrate Google video generation APIs
- Create video generation tools
- Build video storage and playback

**What We Teach:**
- Video generation APIs
- Video processing
- Storage for large media files
- Using Antigravity/Codex for complex integrations

**Key Concepts:**
- Video generation
- Media processing
- Large file handling

**API Resources:**
- OpenAI Sora (when available): Monitor OpenAI announcements
- Google Video Generation: Monitor Google Cloud AI updates
- Runway ML API: https://docs.runwayml.com/ (alternative)
- Synthesia API: https://docs.synthesia.io/ (alternative)

**Deliverables:**
- Video generation APIs integrated
- Video tools working
- Video storage functional

---

### Phase 6: Final Integration & Documentation (Video 41)

#### Video 16: Advanced Observability UI Enhancement
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v16-advanced-observability`  
**Starting Point:** Video 15 completion

**What We Build:**
- Enhance admin observability UI
- Add advanced filtering and search
- Implement event timeline visualization
- Add performance metrics dashboard

**What We Teach:**
- UI/UX for observability
- Timeline visualization
- Performance metrics
- Using Cursor for Vue.js development

**Key Concepts:**
- Observability patterns
- Data visualization
- Performance monitoring

**Deliverables:**
- Enhanced observability UI
- Advanced filtering working
- Timeline visualization functional

---

#### Video 17: Agent Swim Lane Visualization
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v17-swim-lanes`  
**Starting Point:** Video 16 completion

**What We Build:**
- Implement swim lane layout
- Create timeline visualization across lanes
- Add agent activity indicators
- Build parallel processing visualization

**What We Teach:**
- Swim lane concepts
- Timeline visualization libraries
- Real-time UI updates
- Complex UI state management

**Key Concepts:**
- Visual agent monitoring
- Parallel execution visualization
- Real-time dashboards

**Deliverables:**
- Swim lane visualization working
- Timeline functional
- Agent activity visible

---


#### Video 18: Claude Code Agent Builder - Part 1 (Skills)
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v18-agent-builder-skills`  
**Starting Point:** Video 17 completion

**What We Build:**
- Create Claude Code agent builder agent
- Implement agent scaffolding skill
- Implement agent configuration skill
- Test skills independently

**What We Teach:**
- Claude Code agent development
- Skills as reusable components
- Skill composition
- Using Claude Code for agent building

**Key Concepts:**
- Agent builders
- Skills architecture
- Reusable components

**Deliverables:**
- Agent builder agent created
- Two skills implemented
- Skills tested and working

---

#### Video 19: Claude Code Agent Builder - Part 2 (Commands)
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v19-agent-builder-commands`  
**Starting Point:** Video 18 completion

**What We Build:**
- Implement agent creation command
- Implement agent testing command
- Implement agent deployment command
- Create complete agent builder workflow

**What We Teach:**
- Commands as guardrails
- Command interfaces
- Workflow automation
- Using Claude Code commands

**Key Concepts:**
- Commands pattern
- Guardrails via commands
- Automation workflows

**Deliverables:**
- Agent builder commands working
- Complete workflow functional
- Can generate agents automatically

---

#### Video 20: Building Example LangGraph Agent with Builder
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v20-example-langgraph-agent`  
**Starting Point:** Video 19 completion

**What We Build:**
- Use agent builder to create new LangGraph agent
- Enhance agent with MCP tools
- Add RAG capabilities
- Implement guardrails throughout

**What We Teach:**
- Complete agent development workflow
- Guardrails in practice
- Agent testing strategies
- Using the agent builder

**Key Concepts:**
- End-to-end agent development
- Guardrails implementation
- Agent testing

**Deliverables:**
- Complete LangGraph agent example
- Demonstrates all concepts
- Well-documented

---


#### Video 21: Checkpoint Time Travel & Revert
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v21-checkpoint-time-travel`  
**Starting Point:** Video 20 completion

**What We Build:**
- Implement checkpoint history API
- Create revert functionality
- Build checkpoint timeline UI
- Add fork vs replace modes

**What We Teach:**
- State management
- Time travel debugging
- Undo/redo patterns
- Using Cursor for complex state logic

**Key Concepts:**
- Checkpoint management
- State restoration
- Debugging workflows

**Deliverables:**
- Checkpoint history API working
- Revert functionality functional
- Timeline UI complete

---

#### Video 22: Pattern-Based PII Detection
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v22-pattern-pii-detection`  
**Starting Point:** Video 21 completion

**What We Build:**
- Implement pattern-based PII detection
- Create pattern management UI
- Add pattern testing interface
- Integrate with existing PII system

**What We Teach:**
- PII detection patterns
- Regex patterns
- Security patterns
- Using Claude Code for security work

**Key Concepts:**
- Pattern matching
- Security guardrails
- PII protection

**Deliverables:**
- Pattern-based detection working
- Pattern management UI functional
- Integrated with PII system

---

#### Video 23: Advanced HITL Workflows
**Duration:** ~30 minutes  
**Branch Checkpoint:** `checkpoint/v23-advanced-hitl`  
**Starting Point:** Video 22 completion

**What We Build:**
- Implement multi-step HITL workflows
- Add conditional HITL triggers
- Create HITL approval chains
- Enhance HITL UI components

**What We Teach:**
- Advanced HITL patterns
- Approval workflows
- Human-AI collaboration
- Using WindSurf for UI work

**Key Concepts:**
- Complex HITL workflows
- Approval chains
- Human-AI interaction

**Deliverables:**
- Advanced HITL workflows working
- Approval chains functional
- Enhanced UI complete

---


**What We Build:**
- Integrate all components (observability, agents, MCP, media generation)
- Test end-to-end workflows across all 25+ agents
- Fix integration issues
- Performance optimization
- Complete system documentation
- Create student navigation guide
- Set up branch navigation system

**What We Teach:**
- System integration strategies
- End-to-end testing approaches
- Performance optimization techniques
- Documentation best practices
- Learning path navigation
- Technology change awareness

**Concepts Taught:**
- Large-scale system integration
- Comprehensive testing strategies
- Performance tuning for production
- Documentation for educational content
- Student experience design
- Future-proofing strategies

**Coding Environment:** Multiple (demonstrating different tools)

**Deliverables:**
- All components integrated and tested
- All 25+ agents working end-to-end
- Complete documentation
- Student navigation guide
- Branch checkpoint system
- v2-final-solution complete

**What We Build:**
- Complete system documentation
- Create student guide
- Set up branch navigation
- Prepare for next phase

**What We Teach:**
- Documentation best practices
- Learning path navigation
- Technology change awareness
- Continuing education

**Key Concepts:**
- Documentation
- Learning paths
- Technology evolution

**Deliverables:**
- Complete documentation
- Student guide ready
- Branch navigation working
- v2-final-solution complete

---

## Video Production Checklist

**Before Each Video:**
- [ ] Review previous video and current codebase state
- [ ] Test experimental codebase to understand the work
- [ ] Prepare talking points for concepts to teach
- [ ] Set up clean recording environment
- [ ] Ensure all tools/APIs are accessible

**During Each Video:**
- [ ] Start with recap and current state (2-3 min)
- [ ] Build feature while explaining decisions (20-25 min)
- [ ] Show debugging and problem-solving
- [ ] Test what we built
- [ ] Summarize learnings and preview next video (2-3 min)

**After Each Video:**
- [ ] Create git branch checkpoint
- [ ] Update documentation
- [ ] Create video description with links
- [ ] Add video to playlist
- [ ] Update student navigation guide

**Branch Checkpoint Process:**
- Create branch: `checkpoint/v{N}-{feature-name}`
- Ensure codebase is in working state
- Update README with branch navigation
- Document what's complete and what's next
- Tag release if appropriate

---

## Notes

- **Video-First Development:** Every feature in this PRD will be built through educational videos (Loom and YouTube). The entire v2-final-solution is both product development and comprehensive education.
- **Technology Change Awareness:** All educational content emphasizes that technology changes rapidly. Patterns and implementations may become outdated, but principles and guardrails remain valuable.
- **Multi-Environment Support:** Educational content covers multiple coding environments (Cursor, Claude Code, WindSurf, Google Antigravity, Codex) and web-based coding (web interfaces + GitHub).
- **Guardrails Throughout:** The concept of guardrails (sub-agents, skills, commands, orchestrator agents, context/prompt engineering) is integrated into every lesson and example.
- **Standards Education:** A2A, MCP, and emerging standards are taught as they evolve, ensuring students understand interoperability and future-proofing.
- **Hands-On Expertise:** Students build expertise in LangGraph, N8N, and coding through hands-on development of actual agents and agent builders.
- **Agent Builders:** Agent builders are built as Claude Code agents with skills and commands, demonstrating the full development workflow.
- **Example Agents:** Complete example agents (one LangGraph, one N8N) serve as comprehensive templates demonstrating all concepts.
- This PRD will be expanded as we progress through the create-v2-start implementation
- Each section will become its own plan item after foundational work is complete
- Multi-organization setup is critical for supporting verticals and SaaS clients
- MCP integration enables powerful agent capabilities
- Media generation expands agent capabilities significantly

