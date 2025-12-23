# MCP Architecture Deep Dive

## For the AI Solutions Architect

**Date:** 2025-01-27
**Purpose:** Complete understanding of MCP (Model Context Protocol) for architecture discussions, client presentations, and implementation planning.

---

## Executive Summary

MCP (Model Context Protocol) is an **open standard** created by Anthropic that defines how AI applications communicate with external tools and data sources. Think of it as **"USB for AI"** - a universal connector that lets any AI model talk to any tool.

**Key Value Proposition:** Instead of building N custom integrations for N tools, you build ONE MCP integration and connect to ANY MCP-compatible tool.

---

## Part 1: What is MCP?

### The Problem MCP Solves

**Before MCP:**
```
Your AI App → Custom Slack Integration
            → Custom Notion Integration
            → Custom Database Integration
            → Custom CRM Integration
            → (N more custom integrations...)

Each integration = different API, different auth, different error handling
```

**With MCP:**
```
Your AI App → MCP Client → MCP Server (Slack)
                        → MCP Server (Notion)
                        → MCP Server (Database)
                        → MCP Server (CRM)

One protocol = consistent interface for ALL tools
```

### Core Concepts

| Concept | What It Is | Analogy |
|---------|-----------|---------|
| **MCP Server** | Exposes tools/resources via MCP protocol | A USB device (keyboard, mouse) |
| **MCP Client** | Consumes MCP servers | A computer's USB port |
| **MCP Host** | Application containing the client | Your computer |
| **Tools** | Functions the LLM can call | Buttons on the keyboard |
| **Resources** | Data the LLM can read | Files on a USB drive |
| **Prompts** | Reusable prompt templates | Keyboard macros |

### The Protocol Stack

```
┌─────────────────────────────────────────────┐
│                Application                   │
│         (Claude, ChatGPT, Your App)         │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│                MCP Client                    │
│     (Discovers servers, routes calls)       │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│            JSON-RPC 2.0 Transport           │
│          (stdio, SSE, WebSocket)            │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│                MCP Server                    │
│    (Exposes tools, resources, prompts)      │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│           External Service API              │
│      (Slack API, Database, File System)     │
└─────────────────────────────────────────────┘
```

---

## Part 2: MCP Protocol Specification

### Protocol Version
Current: **2025-03-26** (March 2025 specification)

### Transport Mechanisms

| Transport | Use Case | How It Works |
|-----------|----------|--------------|
| **stdio** | Local process | Server runs as subprocess, communicates via stdin/stdout |
| **HTTP+SSE** | Remote server | HTTP POST for requests, Server-Sent Events for responses |
| **WebSocket** | Bidirectional | Full-duplex communication for real-time scenarios |

### Core Methods (JSON-RPC 2.0)

```typescript
// 1. Initialize - Handshake between client and server
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "MyApp", "version": "1.0.0" }
  },
  "id": 1
}

// Response:
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2025-03-26",
    "serverInfo": { "name": "SlackMCP", "version": "1.0.0" },
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true },
      "prompts": {}
    }
  },
  "id": 1
}

// 2. List Tools - Discover available tools
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}

// Response:
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "send-message",
        "description": "Send a message to a Slack channel",
        "inputSchema": {
          "type": "object",
          "properties": {
            "channel": { "type": "string" },
            "message": { "type": "string" }
          },
          "required": ["channel", "message"]
        }
      }
    ]
  },
  "id": 2
}

// 3. Call Tool - Execute a specific tool
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "send-message",
    "arguments": {
      "channel": "#general",
      "message": "Hello from MCP!"
    }
  },
  "id": 3
}

// Response:
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Message sent successfully to #general"
      }
    ],
    "isError": false
  },
  "id": 3
}
```

### Capabilities

| Capability | What It Enables |
|------------|-----------------|
| **tools** | Function calling (most common) |
| **resources** | Read-only data access (files, databases) |
| **prompts** | Reusable prompt templates |
| **logging** | Structured logging from server |
| **sampling** | Server can request LLM completions |

---

## Part 3: Your Current MCP Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator AI                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   NestJS API    │    │         LangGraph App           │ │
│  │                 │    │                                 │ │
│  │  ┌───────────┐  │    │  ┌───────────┐  ┌───────────┐  │ │
│  │  │MCP Server │  │    │  │  Agents   │  │   Tools   │  │ │
│  │  │(Embedded) │  │    │  │           │  │ (Direct)  │  │ │
│  │  └───────────┘  │    │  └───────────┘  └───────────┘  │ │
│  │       ↓         │    │        ↓              ↓        │ │
│  │  ┌───────────┐  │    │  ┌─────────────────────────┐   │ │
│  │  │Namespace  │  │    │  │  LLM HTTP Client        │   │ │
│  │  │Handlers   │  │    │  │  (calls external APIs)  │   │ │
│  │  └───────────┘  │    │  └─────────────────────────┘   │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  MCP N8N Server                          ││
│  │                  (Standalone Process)                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### What You Have Implemented

#### 1. Embedded MCP Server (NestJS API)

**Location:** `apps/api/src/mcp/`

**Structure:**
```
apps/api/src/mcp/
├── mcp.module.ts           # NestJS module registration
├── mcp.service.ts          # Core MCP service (routing)
├── mcp.controller.ts       # HTTP endpoint (POST /mcp)
├── interfaces/
│   └── mcp.interface.ts    # TypeScript interfaces
├── clients/
│   ├── mcp-client.service.ts    # Client for agents to use
│   └── generic-mcp.client.ts    # Generic MCP client
├── services/supabase/
│   ├── supabase.mcp.ts          # Supabase MCP server
│   └── supabase-mcp.service.ts  # Service wrapper
└── tools/
    ├── supabase.tools.ts   # Database tools
    ├── slack.tools.ts      # Slack tools
    └── notion.tools.ts     # Notion tools
```

**Namespace System:**
```typescript
// Tools are namespaced: namespace/tool-name
"supabase/get-schema"      // Data tools
"supabase/execute-sql"
"supabase/generate-sql"
"slack/send-message"       // Productivity tools
"slack/get-channels"
"notion/create-page"       // Productivity tools
"notion/query-database"
```

**HTTP Endpoint:**
```
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "supabase/get-schema",
    "arguments": { "tablePattern": "users%" }
  },
  "id": 1
}
```

#### 2. Standalone MCP Server (N8N)

**Location:** `mcp-n8n-server/`

**What It Does:** Exposes N8N workflow management as MCP tools

**Tools Available:**
- `list_workflows` - List all N8N workflows
- `get_workflow` - Get workflow details
- `create_workflow` / `update_workflow` / `delete_workflow`
- `execute_workflow` - Run a workflow
- `get_executions` - Execution history

**Configuration:** `.mcp.json`
```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["mcp-n8n-server/index.js"],
      "env": {
        "N8N_WEBHOOK_URL": "${N8N_WEBHOOK_URL}",
        "N8N_API_KEY": "${N8N_API_KEY}"
      }
    }
  }
}
```

#### 3. LangGraph Tools (Direct, Not MCP)

**Location:** `apps/langgraph/src/tools/`

**Current Pattern:** Tools are implemented as direct classes, NOT as MCP servers

```typescript
// Example: data-analyst.graph.ts
export function createDataAnalystGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
  listTablesTool: ListTablesTool,      // Direct tool injection
  describeTableTool: DescribeTableTool,
  sqlQueryTool: SqlQueryTool,
) {
  // Tools called directly:
  const tablesResult = await listTablesTool.execute("public");
}
```

**Note from code comment:**
> "Tools are called directly via their execute methods rather than through ToolNode, as this provides better control over the workflow."

---

## Part 4: MCP Integration Patterns

### Pattern 1: LLM Tool Calling (Current in LangGraph)

```
User Query → LLM → Tool Call Decision → Execute Tool → LLM → Response
```

**How It Works:**
1. LLM receives query + available tool definitions
2. LLM decides which tool to call (if any)
3. Tool is executed with provided arguments
4. Result is fed back to LLM
5. LLM generates final response

**In LangChain/LangGraph:**
```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Define tools
const tools = [searchTool, calculatorTool, weatherTool];

// Create tool node
const toolNode = new ToolNode(tools);

// In graph:
graph.addNode("tools", toolNode);
```

### Pattern 2: MCP as Tool Provider

```
User Query → LLM → MCP Client → MCP Server → External API → Response
```

**How It Works:**
1. MCP Client discovers tools from MCP Server
2. Tool definitions provided to LLM
3. LLM calls tool via MCP protocol
4. MCP Server executes and returns result

**Integration Options:**

#### Option A: LangChain MCP Adapter (Recommended)

```typescript
import { MCPToolkit } from "@langchain/mcp";

// Connect to MCP server
const toolkit = new MCPToolkit({
  transport: "stdio",
  command: "node",
  args: ["./mcp-server/index.js"]
});

// Get tools as LangChain tools
const tools = await toolkit.getTools();

// Use in agent
const agent = createReactAgent({
  llm,
  tools,
});
```

#### Option B: Direct MCP Client in Node

```typescript
import { MCPClientService } from '../mcp/clients/mcp-client.service';

// In a LangGraph node:
async function queryDatabaseNode(state) {
  const mcpClient = new MCPClientService();

  const result = await mcpClient.callTool({
    name: "supabase/execute-sql",
    arguments: { query: "SELECT * FROM users LIMIT 10" }
  });

  return { dbResult: result };
}
```

#### Option C: HTTP MCP Calls

```typescript
async function callMCPTool(toolName: string, args: object) {
  const response = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: Date.now()
    })
  });

  return response.json();
}
```

### Pattern 3: Agentic MCP (LLM Chooses Tools)

```
User Query → Agent → Reason → Choose MCP Tool → Execute → Observe → Repeat
```

**ReAct Pattern with MCP:**
```typescript
const agent = createReactAgent({
  llm: chatModel,
  tools: await mcpToolkit.getTools(),  // MCP tools
  prompt: `You have access to these tools via MCP:
    - supabase/execute-sql: Run SQL queries
    - slack/send-message: Send Slack messages
    - notion/create-page: Create Notion pages

    Use tools to accomplish the user's goal.`
});
```

---

## Part 5: LangGraph + MCP Integration

### Current State (Your Codebase)

**Pattern Used:** Direct tool injection, NOT MCP

```typescript
// data-analyst.graph.ts - Current approach
const graph = new StateGraph(DataAnalystStateAnnotation)
  .addNode("discover_tables", async (state) => {
    // Direct tool call
    const tablesResult = await listTablesTool.execute("public");
    return { availableTables: tableNames };
  })
```

### Future State: MCP-Enabled LangGraph

#### Approach 1: MCP Tools as LangChain Tools

```typescript
import { MCPToolkit } from "@langchain/mcp";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Initialize MCP connection
const mcpToolkit = new MCPToolkit({
  servers: [
    { name: "supabase", command: "node", args: ["./mcp-servers/supabase.js"] },
    { name: "slack", command: "node", args: ["./mcp-servers/slack.js"] }
  ]
});

// Get tools
const mcpTools = await mcpToolkit.getTools();

// Create tool node
const toolNode = new ToolNode(mcpTools);

// Build graph
const graph = new StateGraph(MyStateAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldUseTool, {
    "use_tool": "tools",
    "end": END
  })
  .addEdge("tools", "agent");
```

#### Approach 2: MCP Client in Custom Nodes

```typescript
// For fine-grained control
async function mcpToolNode(state: GraphState): Promise<Partial<GraphState>> {
  const mcpClient = state.mcpClient;

  // LLM already decided which tool to call
  const toolCall = state.pendingToolCall;

  const result = await mcpClient.callTool({
    name: toolCall.name,
    arguments: toolCall.args
  });

  return {
    toolResults: [...state.toolResults, result],
    pendingToolCall: null
  };
}
```

#### Approach 3: Hybrid (Recommended for Your Use Case)

```typescript
// Some tools via MCP (external integrations)
// Some tools via direct implementation (core functionality)

const directTools = [
  listTablesTool,     // Core database discovery
  describeTableTool,  // Core schema operations
  sqlQueryTool        // Core SQL execution
];

const mcpTools = await mcpToolkit.getTools();  // Slack, Notion, etc.

const allTools = [...directTools, ...mcpTools];

const toolNode = new ToolNode(allTools);
```

---

## Part 6: When to Use What

### Use MCP When:

| Scenario | Why MCP |
|----------|---------|
| Third-party integrations (Slack, Notion, Salesforce) | Standard interface, maintained by vendor |
| Tools shared across multiple agents | Centralized tool management |
| Tools that change frequently | Update server without touching agents |
| Need tool discoverability | `tools/list` provides dynamic discovery |
| Building for ecosystem | Other MCP clients can use your tools |

### Use Direct Tools When:

| Scenario | Why Direct |
|----------|------------|
| Performance-critical operations | No protocol overhead |
| Tight coupling with workflow state | Direct access to context |
| Internal-only tools | No external consumption needed |
| Simple operations | MCP overhead not justified |
| Complex multi-step tool logic | Easier to manage in-process |

### Your Recommended Architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator AI                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────┐  ┌───────────────────────────┐  │
│  │   Core Tools          │  │   MCP Tools (External)    │  │
│  │   (Direct in Graph)   │  │   (Via MCP Protocol)      │  │
│  │                       │  │                           │  │
│  │ - Database operations │  │ - Slack integration       │  │
│  │ - RAG retrieval       │  │ - Notion integration      │  │
│  │ - Internal workflows  │  │ - N8N workflows           │  │
│  │ - Checkpointing       │  │ - Third-party APIs        │  │
│  └───────────────────────┘  └───────────────────────────┘  │
│           ↓                            ↓                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   LangGraph Agents                     │  │
│  │                                                        │  │
│  │   Agent receives both direct tools and MCP tools      │  │
│  │   LLM decides which to use based on task              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 7: Implementation Roadmap

### Phase 1: Consolidate Current MCP (Now)

**Goal:** Clean up and document existing implementation

- [ ] Document all available MCP tools
- [ ] Ensure Slack/Notion tools are functional
- [ ] Add tests for MCP endpoints
- [ ] Create admin dashboard for MCP status

### Phase 2: LangGraph MCP Integration (Next)

**Goal:** Enable LangGraph agents to use MCP tools

```typescript
// New file: apps/langgraph/src/mcp/mcp-tool-provider.ts
export class MCPToolProvider {
  private mcpClient: MCPClientService;

  async getToolsForAgent(agentType: string): Promise<StructuredTool[]> {
    // Get all MCP tools
    const mcpTools = await this.mcpClient.listTools();

    // Filter based on agent type
    return mcpTools
      .filter(tool => this.isToolAllowedForAgent(tool, agentType))
      .map(tool => this.convertToLangChainTool(tool));
  }

  private convertToLangChainTool(mcpTool: MCPToolDefinition): StructuredTool {
    return new DynamicStructuredTool({
      name: mcpTool.name,
      description: mcpTool.description,
      schema: mcpTool.inputSchema,
      func: async (args) => {
        const result = await this.mcpClient.callTool({
          name: mcpTool.name,
          arguments: args
        });
        return result.content[0].text;
      }
    });
  }
}
```

### Phase 3: MCP Server Expansion (Future)

**Goal:** Add more MCP servers for key integrations

| Server | Purpose | Priority |
|--------|---------|----------|
| `github/` | PR reviews, code search | High |
| `jira/` | Issue management | Medium |
| `confluence/` | Documentation | Medium |
| `hubspot/` | CRM operations | Medium |
| `google-drive/` | Document access | Low |

### Phase 4: MCP Resources & Prompts (Future)

**Goal:** Implement full MCP specification

- [ ] Resources capability for file/data access
- [ ] Prompts capability for reusable templates
- [ ] Sampling capability for server-initiated LLM calls

---

## Part 8: Architecture Talking Points

### For Client Presentations

**"Why MCP?"**
> "MCP is the emerging standard for AI tool integration. By building on MCP, your AI investments are future-proof - as new tools adopt MCP, they'll plug directly into your existing infrastructure."

**"How does it differ from regular APIs?"**
> "Traditional APIs require custom integration code for each service. MCP provides a universal protocol - like how USB standardized hardware connections. One integration pattern works for all MCP-compatible services."

**"What's the business value?"**
> "Reduced integration time (days vs weeks), lower maintenance burden (protocol handles compatibility), and ecosystem access (growing library of MCP servers)."

### For Technical Discussions

**"MCP vs OpenAI Function Calling"**
> "Function calling is how an LLM requests tool execution. MCP is how the tool execution actually happens. They're complementary - the LLM uses function calling syntax, and MCP handles the actual tool invocation."

**"MCP vs LangChain Tools"**
> "LangChain tools are an in-process abstraction. MCP tools can run as separate processes, enabling isolation, language flexibility, and distributed execution. You can wrap MCP tools as LangChain tools for the best of both."

**"Stdio vs HTTP transport"**
> "Stdio is for local tools - fast, no network overhead, but requires process management. HTTP is for remote/shared tools - network overhead but scales independently. Choose based on deployment topology."

---

## Part 9: Naming Alternatives

Since you mentioned needing a better name than "AI Architect" for business development (not model training), here are some options:

### Option 1: Solution-Focused
- **AI Solutions Architect** ← Most accurate
- **Generative AI Architect**
- **Enterprise AI Architect**
- **Applied AI Architect**

### Option 2: Business-Focused
- **AI Integration Strategist**
- **AI Transformation Architect**
- **Intelligent Systems Architect**
- **AI/ML Solutions Consultant**

### Option 3: Modern/Trendy
- **Agentic AI Architect** ← Trending term
- **LLM Systems Architect**
- **Cognitive Systems Architect**
- **AI Platform Architect**

### Option 4: Role-Specific
- **AI Implementation Architect**
- **Conversational AI Architect**
- **AI Orchestration Architect** ← Matches your product!
- **AI Workflow Architect**

### My Recommendation:

**"AI Solutions Architect"** or **"AI Orchestration Architect"**

Why:
- "Solutions" emphasizes business outcomes, not just technology
- "Orchestration" aligns with your product (Orchestrator AI)
- Both clearly communicate: "I design and implement AI systems for business problems"
- Neither implies ML training (which would be "ML Engineer" or "AI Research Scientist")

---

## Part 10: The Context Problem & Anthropic's Solutions

### The Elephant in the Room: MCP is Context-Heavy

This is **the most critical issue** with MCP that you need to understand for architecture discussions.

#### The Problem: Tool Definition Bloat

**Scenario:** Enterprise environment with 20 MCP servers, 20 tools each = 400 tools

```
Traditional MCP Approach:
┌─────────────────────────────────────────────────────────────┐
│                    Context Window (200K tokens)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tool Definitions (loaded upfront):     ~100,000 tokens     │
│  ├── supabase/ (20 tools)               ~5,000 tokens       │
│  ├── slack/ (20 tools)                  ~5,000 tokens       │
│  ├── notion/ (20 tools)                 ~5,000 tokens       │
│  ├── github/ (20 tools)                 ~5,000 tokens       │
│  └── ... (16 more servers)              ~80,000 tokens      │
│                                                              │
│  User Conversation:                     ~50,000 tokens       │
│                                                              │
│  Remaining for Reasoning:               ~50,000 tokens       │
│                                                              │
│  ⚠️ HALF YOUR CONTEXT IS TOOL DEFINITIONS!                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Real Numbers from Anthropic's Research:**
- Before optimization: **150,000+ tokens** just for tool definitions
- Production systems can exceed **100,000 tokens** solely for schemas
- JSON Schema definitions are NOT token-efficient

#### The Second Problem: Tool Result Bloat

Every tool result goes back into context:

```
Tool Call: supabase/execute-sql
Result: 10,000 rows of data → ~50,000 tokens

Even if user only needed: "How many active users?"
Answer needed: "1,247"
Tokens wasted: ~49,990
```

### Anthropic's Three-Part Solution (November 2025)

Anthropic released three beta features specifically addressing this:

#### 1. Tool Search Tool (Lazy Loading)

**What It Does:** Instead of loading all tool definitions upfront, Claude **searches** your tool catalog and loads only what it needs.

**How It Works:**
```typescript
// Traditional: All tools loaded into context
const response = await anthropic.messages.create({
  tools: allMyTools,  // 400 tools = ~100K tokens consumed
  // ...
});

// With Tool Search Tool: Deferred loading
const response = await anthropic.messages.create({
  tools: [
    ...criticalTools,  // Only essential tools loaded
    ...allMyTools.map(t => ({ ...t, defer_loading: true }))  // Rest searchable
  ],
  // ...
});
```

**Results:**
- **85% token reduction** for tool definitions
- Opus 4: Accuracy improved **49% → 74%**
- Opus 4.5: Accuracy improved **79.5% → 88.1%**

#### 2. Programmatic Tool Calling (Code Execution)

**What It Does:** Instead of each tool result returning to Claude's context, Claude writes code that orchestrates tools and **filters what enters context**.

**Traditional Pattern (Context-Heavy):**
```
User: "Summarize our top 10 customers by revenue"

Round 1: Claude → supabase/execute-sql → 10,000 rows → Claude (50K tokens!)
Round 2: Claude → processes data → response

Total context consumed: ~50K tokens for data that becomes 100 words
```

**Programmatic Pattern (Context-Efficient):**
```
User: "Summarize our top 10 customers by revenue"

Claude writes Python:
```python
# This runs in sandboxed container
result = mcp_call("supabase/execute-sql", {"query": "SELECT..."})
top_10 = result[:10]  # Filter before returning to Claude
summary = format_summary(top_10)
return summary  # Only ~500 tokens enter context
```

Total context consumed: ~500 tokens
```

**Results:**
- **98.7% reduction** in context overhead
- 150,000 tokens → 2,000 tokens for same task
- Multi-tool workflows become practical

#### 3. MCP Connector API

**What It Does:** Built-in MCP client in Claude API - no separate client needed.

```typescript
// New MCP Connector (beta)
const response = await anthropic.messages.create({
  model: "claude-opus-4-5",
  mcp_servers: [
    {
      type: "url",
      url: "https://your-mcp-server.com/mcp",
      authorization_token: "Bearer ..."
    }
  ],
  messages: [{ role: "user", content: "Query the database" }]
});
```

### What This Means for Your Architecture

#### Immediate Implications

1. **Don't Load All Tools Upfront**
   - Your current API has 15+ tools across supabase/slack/notion
   - Each `tools/list` call loads ALL definitions into context
   - Solution: Implement tool categories or lazy loading

2. **Filter Tool Results Before Returning**
   - Current: SQL results go directly to LLM
   - Better: Pre-process, paginate, or summarize before context

3. **Consider the Code Execution Pattern**
   - Instead of: LLM → Tool → LLM → Tool → LLM
   - Consider: LLM → Code (Tool → Tool → Tool) → LLM

#### Recommended Architecture Changes

**Current (Context-Heavy):**
```typescript
// data-analyst.graph.ts
async function executeQueryNode(state) {
  const result = await sqlQueryTool.generateAndExecuteSql(question, schema);
  // ALL results go into state (and eventually context)
  return { sqlResults: result };
}
```

**Improved (Context-Efficient):**
```typescript
async function executeQueryNode(state) {
  const result = await sqlQueryTool.generateAndExecuteSql(question, schema);

  // Pre-process before adding to state
  const processedResult = {
    rowCount: result.rows.length,
    summary: result.rows.length > 10
      ? summarizeData(result.rows)  // Compress large results
      : result.rows,
    sampleRows: result.rows.slice(0, 5),  // Just a sample
    fullResultId: await cacheResult(result)  // Store full data externally
  };

  return { sqlResults: processedResult };
}
```

#### Future Architecture with Anthropic Beta Features

```typescript
// Using Tool Search Tool
const response = await anthropic.beta.messages.create({
  model: "claude-opus-4-5",
  betas: ["advanced-tool-use-2025-11-20"],
  tools: [
    // Critical tools always loaded
    { name: "search_tools", type: "tool_search", ... },

    // Everything else is searchable but not loaded
    ...allMCPTools.map(t => ({
      ...t,
      defer_loading: true
    }))
  ],
  messages: [...]
});

// Using Programmatic Tool Calling
const response = await anthropic.beta.messages.create({
  model: "claude-opus-4-5",
  betas: ["code-execution-2025-11-20"],
  tools: [
    { type: "code_execution", name: "execute_python" },
    ...mcpTools
  ],
  messages: [{
    role: "user",
    content: `Analyze our sales data. Write code to:
      1. Query the database for last quarter
      2. Calculate key metrics
      3. Return only the summary`
  }]
});
```

### Context Budget Planning

**For Production Systems, Plan Your Token Budget:**

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | 2,000 | Instructions, persona |
| Tool definitions (active) | 5,000 | 5-10 most-used tools |
| Tool definitions (searchable) | 0 | Defer loaded on demand |
| Conversation history | 50,000 | Recent messages |
| Tool results (processed) | 10,000 | Summarized/filtered |
| Reasoning space | 130,000 | For Claude's thinking |
| **Total** | **~200,000** | Context window |

**Key Insight:** Reserve at least **50% of context for reasoning**, especially for complex agentic tasks.

### Industry Adoption Update

As of late 2025:
- **OpenAI** adopted MCP (March 2025)
- **Google DeepMind** confirmed MCP support in Gemini (April 2025)
- **MCP donated to Linux Foundation** (December 2025) under Agentic AI Foundation
- Co-founded by: Anthropic, Block, OpenAI
- Supported by: Google, Microsoft, AWS, Cloudflare, Bloomberg

This means MCP is becoming the **universal standard** - your investment is future-proof.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Quick Reference                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Protocol: JSON-RPC 2.0 over stdio/HTTP/WebSocket            │
│  Version: 2025-03-26                                         │
│                                                              │
│  Core Methods:                                               │
│    initialize      → Handshake, exchange capabilities        │
│    tools/list      → Discover available tools                │
│    tools/call      → Execute a tool                          │
│    ping            → Health check                            │
│                                                              │
│  Capabilities:                                               │
│    tools           → Function calling (implemented)          │
│    resources       → Read-only data (not implemented)        │
│    prompts         → Prompt templates (not implemented)      │
│    logging         → Structured logging (implemented)        │
│                                                              │
│  Your Implementation:                                        │
│    API Endpoint:   POST /mcp                                 │
│    Namespaces:     supabase/, slack/, notion/                │
│    N8N Server:     Standalone via .mcp.json                  │
│    LangGraph:      Direct tools (MCP integration pending)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## References

### Official Documentation
- **Official MCP Spec:** https://modelcontextprotocol.io/
- **Claude MCP Connector Docs:** https://docs.claude.com/en/docs/agents-and-tools/mcp-connector
- **Tool Search Tool Docs:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- **Programmatic Tool Calling Docs:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling

### Libraries & SDKs
- **MCP SDK (TypeScript):** @modelcontextprotocol/sdk
- **LangChain MCP Adapters:** https://github.com/langchain-ai/langchain-mcp-adapters
- **LangChain MCP Docs:** https://docs.langchain.com/oss/python/langchain/mcp

### Research & Articles
- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) - 98.7% context reduction
- [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) - Tool Search Tool, Programmatic Calling
- [Eliminating Token Bloat in MCP](https://glama.ai/blog/2025-12-14-code-execution-with-mcp-architecting-agentic-efficiency)
- [Context Efficiency with MCP](https://nayakpplaban.medium.com/context-efficiency-with-mcp-a-practical-implementation-37420d08094f)
- [Neo4j: Build ReAct Agent with LangGraph and MCP](https://neo4j.com/blog/developer/react-agent-langgraph-mcp/)

### Your Implementation
- **API MCP Server:** apps/api/src/mcp/
- **N8N MCP Server:** mcp-n8n-server/
- **MCP Config:** .mcp.json
- **Admin Dashboard:** apps/web/src/views/admin/MCPAdminPage.vue

---

**See Also:**
- [15-Advanced-RAG-Strategies-Deep-Dive.md](../Product%20Hardening/15-Advanced-RAG-Strategies-Deep-Dive.md)
- Anthropic MCP Blog: https://www.anthropic.com/news/model-context-protocol
- MCP Wikipedia: https://en.wikipedia.org/wiki/Model_Context_Protocol

