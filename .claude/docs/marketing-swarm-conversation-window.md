# Marketing Swarm Conversation Window Architecture

## Overview

The Marketing Swarm has a **non-standard conversation window** that differs significantly from the default conversation window. It demonstrates a complex pattern for handling agents/workflows that:
- Get data from LangGraph (not directly from API)
- Use database-driven state (marketing schema tables)
- Stream real-time updates via SSE
- Have custom UI components

This pattern will be important for future complex agents and workflows, especially before building the orchestrator agent.

## Key Differences from Default Conversation Window

### Default Conversation Window
- **Data Source**: Direct API calls to `/agent-to-agent/:org/:agent/tasks`
- **State Management**: In-memory (Vue stores)
- **Updates**: Polling or single response
- **UI**: Standard conversation UI (`ConversationView.vue` with standard chat interface)
- **Image/Video Generators**: Works with standard conversation flow

### Marketing Swarm Conversation Window
- **Data Source**: LangGraph marketing table (`marketing.*` schema)
- **State Management**: Database-driven (marketing schema is the source of truth)
- **Updates**: Real-time SSE stream from observability service
- **UI**: Custom UI component (`MarketingSwarmTab.vue`)
- **Complexity**: Multi-phase execution with writers, editors, evaluators

## Architecture Flow

### 1. Initialization

**Frontend (`MarketingSwarmTab.vue` or `MarketingSwarmPage.vue`):**
```typescript
// Step 1: Create or use existing conversation
const conversationId = await marketingSwarmService.createSwarmConversation(
  orgSlug,
  userId,
  config
);

// Step 2: Initialize ExecutionContext
executionContextStore.initialize({
  orgSlug,
  userId,
  conversationId,
  agentSlug: 'marketing-swarm',
  agentType: 'api',
  provider: config.writers[0]?.llmProvider,
  model: config.writers[0]?.llmModel,
});

// Step 3: Connect to SSE stream BEFORE starting execution
marketingSwarmService.connectToSSEStream(conversationId);

// Step 4: Start execution via A2A framework
await marketingSwarmService.startSwarmExecution(
  contentTypeSlug,
  contentTypeContext,
  promptData,
  config
);
```

**Backend Flow:**
1. Frontend calls A2A orchestrator: `a2aOrchestrator.execute('build.create', {...})`
2. A2A orchestrator POSTs to `/agent-to-agent/:org/marketing-swarm/tasks`
3. API runner creates task record in `public.tasks` table
4. API runner calls LangGraph: `POST /workflows/marketing-swarm`
5. LangGraph creates task record in `marketing.swarm_tasks` table
6. LangGraph processes task using `DualTrackProcessorService`

### 2. Data Storage

**Marketing Schema Tables (LangGraph writes here):**
- `marketing.swarm_tasks` - Main task record
- `marketing.outputs` - All content drafts and revisions
- `marketing.output_versions` - Version history for each output
- `marketing.evaluations` - Evaluator scores and rankings
- `marketing.content_types` - Content type definitions
- `marketing.agents` - Agent personalities
- `marketing.agent_llm_configs` - Agent × LLM combinations

**Public Schema Tables (API writes here):**
- `public.conversations` - Conversation record (created by frontend)
- `public.tasks` - Task record (created by API runner)
- `public.deliverables` - Final deliverable (created by LangGraph)

### 3. Real-Time Updates (SSE)

**LangGraph Side (`dual-track-processor.service.ts`):**
```typescript
// LangGraph emits progress events via observability service
await this.observability.emitProgress(context, taskId, message, {
  metadata: {
    type: "output_updated",
    taskId,
    output: {
      id: output.id,
      status: output.status,
      content: output.content,
      // ... full output row data
    },
  },
});
```

**Frontend Side (`marketingSwarmService.ts`):**
```typescript
// Connect to observability SSE stream
const sseUrl = `${API_BASE_URL}/observability/stream?conversationId=${conversationId}&token=${token}`;
this.sseClient.connect(sseUrl);

// Listen for events
this.sseClient.addEventListener('message', (event) => {
  const data = JSON.parse(event.data) as ObservabilityEvent;
  this.handleObservabilityEvent(data);
});

// Handle different event types
switch (metadata.type) {
  case 'output_updated':
    this.handleOutputUpdated(metadata);
    break;
  case 'evaluation_updated':
    this.handleEvaluationUpdated(metadata);
    break;
  // ... other event types
}
```

**SSE Event Types:**
- `phase_changed` - Phase transition (initializing → writing → editing → evaluating → completed)
- `queue_built` - Output matrix created (writers × editors combinations)
- `output_updated` - Output status/content changed (full output row)
- `evaluation_updated` - Evaluation completed (full evaluation row)
- `finalists_selected` - Top N outputs selected for final evaluation
- `ranking_updated` - Rankings calculated (initial or final)

### 4. State Restoration

**When User Returns to Conversation:**
```typescript
// Step 1: Get task from API (by conversationId)
const task = await apiService.get(`/marketing/swarm-tasks/by-conversation/${conversationId}`);

// Step 2: Get full state from LangGraph (direct call to LangGraph)
const state = await marketingSwarmService.getSwarmState(task.taskId);

// Step 3: Populate store with state
store.setOutputs(state.outputs);
store.setEvaluations(state.evaluations);
store.setExecutionQueue(state.executionQueue);

// Step 4: Reconnect to SSE if task still running
if (state.phase !== 'completed') {
  marketingSwarmService.connectToSSEStream(conversationId);
}
```

**LangGraph Endpoint (`marketing-swarm.controller.ts`):**
```typescript
@Get('state/:taskId')
async getState(@Param('taskId') taskId: string) {
  // Reads from marketing schema tables
  const outputs = await this.db.getAllOutputs(taskId);
  const evaluations = await this.db.getAllEvaluations(taskId);
  // Returns full state
  return { outputs, evaluations, phase, ... };
}
```

## Key Complexity Points

### 1. Dual Data Sources

**API Endpoints:**
- `/marketing/swarm-tasks` - Task metadata (from API)
- `/marketing/swarm-tasks/by-conversation/:conversationId` - Task lookup

**LangGraph Endpoints (Direct Calls):**
- `/marketing-swarm/state/:taskId` - Full operational state (outputs, evaluations)
- `/marketing-swarm/status/:taskId` - Status and progress
- `/marketing-swarm/by-conversation/:conversationId` - Task lookup

**Why Two Sources?**
- API knows about conversations and tasks (public schema)
- LangGraph knows about swarm execution state (marketing schema)
- Frontend must query both to get complete picture

### 2. Database-Driven State Machine

**No LangGraph State Graph:**
- Traditional LangGraph uses `StateGraph` with in-memory state
- Marketing Swarm uses database tables as state machine
- `DualTrackProcessorService` reads/writes to marketing schema
- State transitions are database updates, not graph node transitions

**State Machine Flow:**
```
1. Create task → marketing.swarm_tasks (status: 'pending')
2. Build output matrix → marketing.outputs (status: 'pending_write')
3. Process writers → marketing.outputs (status: 'pending_edit', content: '...')
4. Process editors → marketing.outputs (status: 'pending_eval', edit_cycle: N)
5. Process evaluators → marketing.evaluations (status: 'completed', score: N)
6. Select finalists → marketing.outputs (is_finalist: true)
7. Final evaluation → marketing.evaluations (stage: 'final')
8. Calculate rankings → marketing.outputs (final_rank: N)
9. Complete → marketing.swarm_tasks (status: 'completed')
```

### 3. Fat SSE Messages

**Full Row Data in Events:**
- Each SSE event contains complete row data (not just IDs)
- `output_updated` includes full `OutputRow` with all fields
- `evaluation_updated` includes full `EvaluationRow` with all fields
- Frontend can update UI without additional API calls

**Example Output Event:**
```json
{
  "type": "output_updated",
  "taskId": "...",
  "output": {
    "id": "...",
    "status": "completed",
    "content": "...",
    "writerAgentSlug": "...",
    "editorAgentSlug": "...",
    "editCycle": 2,
    "editorFeedback": "...",
    "initialAvgScore": 8.5,
    "initialRank": 3,
    "isFinalist": true,
    "finalTotalScore": 9.2,
    "finalRank": 1,
    // ... all fields
  }
}
```

### 4. Custom UI Component

**Detection:**
```vue
<!-- ConversationView.vue -->
<template v-if="hasCustomUI">
  <MarketingSwarmTab
    v-if="customUIComponent === 'marketing-swarm'"
    :conversation="conversation"
  />
</template>
```

**Agent Configuration:**
- Agent has `hasCustomUI: true` flag
- Agent has `customUIComponent: 'marketing-swarm'` property
- Frontend detects and renders custom component instead of standard chat UI

**Custom UI Features:**
- Config form (content type, prompt data, agent selection)
- Progress view (real-time agent cards, output status)
- Results view (ranked outputs, evaluations, deliverables)
- Tab navigation (config, progress, results)

## Execution Flow

### Phase 1: Initialization
1. User fills config form
2. Frontend creates conversation (via `agent2AgentConversationsService`)
3. Frontend initializes ExecutionContext
4. Frontend connects to SSE stream
5. Frontend starts execution via A2A orchestrator

### Phase 2: Execution (LangGraph)
1. API runner receives request, creates task
2. API runner calls LangGraph `/workflows/marketing-swarm`
3. LangGraph creates task in `marketing.swarm_tasks`
4. LangGraph builds output matrix (writers × editors)
5. LangGraph processes in phases:
   - **Writing**: Writers generate initial drafts
   - **Editing**: Editors refine drafts (iterative cycles)
   - **Initial Evaluation**: Evaluators score all outputs
   - **Finalist Selection**: Top N outputs selected
   - **Final Evaluation**: Evaluators score finalists
   - **Ranking**: Calculate final rankings
6. LangGraph emits SSE events for each state change
7. LangGraph creates deliverable in `public.deliverables`

### Phase 3: Real-Time Updates (Frontend)
1. SSE events arrive at frontend
2. Frontend parses event metadata
3. Frontend updates Vue store
4. Vue reactivity updates UI (agent cards, progress bars, output lists)
5. User sees real-time progress

### Phase 4: Completion
1. LangGraph marks task as `completed`
2. LangGraph emits `phase_changed: completed` event
3. Frontend receives event, switches to results view
4. Frontend displays ranked outputs and evaluations
5. Frontend adds completion message to conversation

## Important Patterns for Future Complex Agents

### 1. Database-Driven State
- Use database tables as state machine (not LangGraph state graph)
- Read/write state from database in service layer
- Database is source of truth for execution state

### 2. Dual Data Sources
- API for conversation/task metadata (public schema)
- LangGraph for execution state (agent-specific schema)
- Frontend queries both to get complete picture

### 3. Fat SSE Messages
- Include full row data in SSE events (not just IDs)
- Frontend can update UI without additional API calls
- Reduces latency and API load

### 4. Custom UI Components
- Detect `hasCustomUI` flag on agent
- Render custom component instead of standard chat UI
- Custom component handles agent-specific UI needs

### 5. State Restoration
- Query both API and LangGraph to restore state
- Reconnect to SSE if task still running
- Populate store with full state before rendering UI

### 6. ExecutionContext Flow
- Frontend creates ExecutionContext
- ExecutionContext flows through A2A framework
- LangGraph receives ExecutionContext in all calls
- ExecutionContext used for observability and LLM requests

## Related Files

**Frontend:**
- `apps/web/src/components/custom-ui/MarketingSwarmTab.vue` - Custom UI component
- `apps/web/src/services/marketingSwarmService.ts` - Service layer
- `apps/web/src/stores/marketingSwarmStore.ts` - Vue store
- `apps/web/src/types/marketing-swarm.ts` - TypeScript types

**Backend (LangGraph):**
- `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.service.ts` - Main service
- `apps/langgraph/src/agents/marketing-swarm/dual-track-processor.service.ts` - Execution logic
- `apps/langgraph/src/agents/marketing-swarm/marketing-db.service.ts` - Database operations
- `apps/langgraph/src/agents/marketing-swarm/marketing-swarm.controller.ts` - HTTP endpoints

**Database:**
- `apps/api/supabase/migrations/20251211000001_create_marketing_swarm_schema.sql` - Marketing schema

**API:**
- `apps/api/src/agent2agent/services/api-agent-runner.service.ts` - API runner (calls LangGraph)
- `apps/api/src/observability/observability-stream.controller.ts` - SSE endpoint

## Notes for Subconversation 5

When building the `web-architecture-agent` and `web-architecture-skill`, we need to understand:
- How custom UI components are detected and rendered
- How ExecutionContext flows through custom components
- How SSE streams are connected and managed
- How state is restored when returning to conversations
- How database-driven state machines work (for future complex agents)

This pattern will be essential for:
- Future complex agents (beyond marketing swarm)
- Orchestrator agent (which will coordinate multiple agents)
- Any agent that needs custom UI or complex state management

