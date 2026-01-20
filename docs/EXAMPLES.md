# Orchestrator AI Examples

This document showcases example agents and workflows available in Orchestrator AI, designed to help you understand the platform's capabilities and get started building your own agents.

## Demo Agents

Orchestrator AI includes a comprehensive library of demo agents organized by department and function. These agents demonstrate various patterns and use cases.

### Available Demo Agents

#### Marketing Agents

- **Blog Post Writer** - Creates compelling blog content
- **Content Creator** - Generates marketing content
- **Competitor Analysis** - Analyzes competitor strategies
- **Market Research** - Conducts market research
- **Marketing Swarm** - Multi-agent workflow coordinating writers, editors, and evaluators
- **Marketing Manager Orchestrator** - Orchestrates marketing team agents

#### Finance Agents

- **Finance Manager Orchestrator** - Coordinates finance team
- **Invoice Processor** - Processes and manages invoices
- **Metrics Analyzer** - Analyzes business metrics and KPIs

#### HR Agents

- **HR Assistant** - Handles HR inquiries and tasks
- **HR Manager Orchestrator** - Orchestrates HR team
- **Onboarding Specialist** - Manages employee onboarding

#### Legal Agents

- **Legal Manager Orchestrator** - Coordinates legal team
- **Contract Reviewer** - Reviews and analyzes contracts
- **Case Law Researcher** - Researches case law and legal precedents
- **Document Request Manager** - Manages legal document requests

#### Engineering Agents

- **Engineering Manager Orchestrator** - Coordinates engineering team
- **Requirements Writer** - Creates technical requirements documents
- **Launcher** - Project launcher and setup agent

#### Operations Agents

- **Operations Manager Orchestrator** - Coordinates operations team
- **Calendar Manager** - Manages calendars and scheduling
- **Email Triage** - Sorts and prioritizes emails
- **Meetings Coordinator** - Coordinates meetings
- **SOP Manager** - Manages standard operating procedures
- **Voice Summary** - Summarizes voice recordings

#### Sales Agents

- **Sales Manager Orchestrator** - Coordinates sales team
- **Chat Support** - Handles customer support chats
- **Leads Manager** - Manages sales leads
- **Voice Receptionist** - Handles phone calls

#### Research Agents

- **Research Manager Orchestrator** - Coordinates research team
- **External RAG** - Researches external sources
- **Internal RAG** - Researches internal documents
- **Policy RAG** - Researches policies and procedures

#### Product Agents

- **Product Manager Orchestrator** - Coordinates product team
- **Product Launch Coordinator** - Coordinates product launches

#### Productivity Agents

- **Productivity Manager Orchestrator** - Coordinates productivity tools
- **Jokes Agent** - Generates jokes and humor
- **Notion Integration** - Integrates with Notion

#### Specialist Agents

- **Specialists Manager Orchestrator** - Coordinates specialist agents
- **Agent Creator** - Helps create new agents
- **Golf Rules Agent** - Specialized agent for golf rules

## Example Workflows

### Marketing Swarm

The Marketing Swarm demonstrates multi-agent orchestration:

**Agents Involved**:
- **Writers** - Generate initial drafts
- **Editors** - Iterate and refine drafts
- **Evaluators** - Score and rank outputs

**Workflow**:
1. User provides content type and requirements
2. Writers generate multiple drafts
3. Editors refine drafts through multiple iterations
4. Evaluators score outputs
5. Best outputs are ranked and presented

**Key Features**:
- Multi-agent coordination
- Iterative refinement
- Evaluation and ranking
- Progress streaming
- Human-in-the-loop checkpoints

### Legal Department AI

A comprehensive legal department system with multiple specialist agents:

**Specialist Agents**:
- Contract Review Agent
- Compliance Agent
- IP Agent
- Privacy Agent
- Employment Agent
- Corporate Agent
- Litigation Agent
- Real Estate Agent

**Orchestration**:
- Chief Legal Officer (CLO) agent routes requests
- Specialist agents handle domain-specific tasks
- Multi-modal document input (PDF, DOCX, images)
- Document-level attribution in responses

## Code Examples

### Creating a Simple Agent

```typescript
// apps/langgraph/my-agent/src/workflows/my-agent.workflow.ts
import { StateGraph } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

interface AgentState {
  messages: BaseMessage[];
  taskId: string;
  conversationId: string;
}

export const createMyAgentWorkflow = () => {
  return new StateGraph<AgentState>()
    .addNode("process", async (state) => {
      // Your agent logic here
      const response = await processRequest(state.messages);
      return {
        ...state,
        messages: [...state.messages, response]
      };
    })
    .setEntryPoint("process")
    .compile();
};
```

### Wrapping an N8N Workflow

1. Create workflow in N8N (local or SaaS)
2. Export workflow JSON
3. Register as API agent:

```bash
npm run db:import-n8n workflow-name.json
```

The workflow is automatically wrapped with:
- PII protection
- Authentication
- Organization context
- Observability

### Using RAG in an Agent

```typescript
// Query RAG collection
const results = await ragService.query({
  query: "What are our Q4 sales targets?",
  collectionId: "sales-targets",
  organizationSlug: "my-org",
  topK: 5
});

// Use results in LLM context
const context = results.map(r => r.content).join("\n\n");
const response = await llmService.generate({
  prompt: `Context: ${context}\n\nQuestion: ${query}`,
  // ... other params
});
```

## Tutorial: Building Your First Agent

### Step 1: Choose Your Framework

**Option A: LangGraph (Code-based)**
- More control and flexibility
- Better for complex logic
- TypeScript/JavaScript

**Option B: N8N (Visual)**
- Visual workflow builder
- Easier for non-developers
- JSON-based workflows

### Step 2: Create Your Agent

**LangGraph Example**:

```bash
# Use the LangGraph command
/claude langgraph:create my-first-agent "A simple agent that greets users"
```

**N8N Example**:
1. Open N8N (http://localhost:5678)
2. Create new workflow
3. Add nodes (Webhook → LLM → Response)
4. Save and export

### Step 3: Register Your Agent

```bash
# LangGraph agents are automatically registered
# N8N workflows need to be imported:
npm run db:import-n8n my-workflow.json
```

### Step 4: Test Your Agent

```bash
# Test via API
curl -X POST http://localhost:6100/agents/my-org/my-first-agent/tasks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "conversationId": "conv-123",
    "content": "Hello, agent!"
  }'
```

### Step 5: Use in Web UI

1. Open http://localhost:6101
2. Navigate to agent catalog
3. Find your agent
4. Start a conversation

## Best Practices

### Agent Design

1. **Single Responsibility** - Each agent should do one thing well
2. **Clear Input/Output** - Define explicit schemas
3. **Error Handling** - Gracefully handle failures
4. **Progress Updates** - Stream progress for long-running tasks
5. **Human-in-the-Loop** - Add checkpoints where needed

### Security

1. **PII Handling** - Use platform PII protection
2. **Organization Scoping** - Always scope to organization
3. **RBAC** - Respect role-based permissions
4. **Audit Logging** - Log important actions

### Performance

1. **Caching** - Cache expensive operations
2. **Batching** - Batch similar requests
3. **Streaming** - Stream long responses
4. **Async Processing** - Use async for I/O operations

## Example Use Cases

### Content Generation

**Use Case**: Generate blog posts with research and editing

**Agents**:
- Research Agent (RAG-based)
- Writer Agent
- Editor Agent

**Workflow**:
1. Research topic using RAG
2. Generate draft
3. Edit and refine
4. Return final content

### Customer Support

**Use Case**: Handle customer inquiries

**Agents**:
- Chat Support Agent
- Knowledge Base RAG
- Escalation Agent

**Workflow**:
1. Receive customer query
2. Search knowledge base
3. Generate response
4. Escalate if needed

### Document Processing

**Use Case**: Process legal documents

**Agents**:
- Document Ingestion Agent
- Contract Review Agent
- Compliance Check Agent

**Workflow**:
1. Upload document
2. Extract text
3. Review contract terms
4. Check compliance
5. Generate summary

## Further Reading

- [Agent Development Guide](docs/agents/README.md)
- [A2A Protocol Specification](docs/a2a/README.md)
- [RAG Documentation](specs/prd-phase-6-rag-infrastructure.md)
- [Architecture Documentation](ARCHITECTURE.md)

## Contributing Examples

Have a great example? We'd love to include it!

1. Create your agent/workflow
2. Document it clearly
3. Submit a pull request
4. Include:
   - Description
   - Use case
   - Code/workflow
   - Example usage

---

For questions about examples, contact: golfergeek@orchestratorai.io
