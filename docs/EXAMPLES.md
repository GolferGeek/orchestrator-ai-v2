# Orchestrator AI Examples

This document showcases how agents work in Orchestrator AI v2 and provides examples for building your own agents.

**Quick Links**:
- **[Build Your First Agent](tutorials/BUILD_FIRST_AGENT.md)** - Step-by-step tutorial
- **[Hello World Agent](../demo-agents/hello-world/)** - Simple example agent.json structure
- **[Learning Path](LEARNING_PATH.md)** - Progressive learning tracks
- **[Quick Start for Students](QUICK_START_STUDENTS.md)** - Get running in 5 minutes

## How Agents Work in v2

**Important**: Orchestrator AI v2 uses a **database-driven architecture**. Agents are stored in the `agents` table, not as static files.

### Agent Types

Agents in v2 can be one of three types:

1. **Context Agents** (`agent_type: 'context'`)
   - Use the **context runner**
   - Fetch context from plans, deliverables, conversation history
   - Use LLM to generate responses
   - Defined entirely in the database with `context` (system prompt) and `llm_config`

2. **API Agents** (`agent_type: 'api'`)
   - Use the **API runner**
   - Make HTTP/webhook calls to endpoints
   - Can reference LangGraph workflows (in `apps/langgraph/`)
   - Can reference external APIs (like n8n workflows)
   - Defined in database with `endpoint` configuration

3. **External Agents** (`agent_type: 'external'`)
   - Use the **external runner**
   - Call external A2A protocol agents
   - Defined in database with `endpoint` configuration

### Specialized Runners

Beyond the three main types, there are specialized runners:

- **RAG Runner** (`agent_type: 'rag-runner'`) - Queries RAG collections and augments LLM responses
- **Orchestrator Runner** (`agent_type: 'orchestrator'`) - Coordinates multiple agents
- **Media Runner** (`agent_type: 'media'`) - Handles media generation
- **Prediction Runner** (`agent_type: 'prediction'`) - Makes predictions
- **Risk Runner** (`agent_type: 'risk'`) - Risk assessment

## Building Agents

### Option 1: Database-First (Context/Runner Agents)

Create an agent directly in the database that uses a runner. Here's a complete example of a **Blog Post Writer** context agent:

```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  name,
  description,
  version,
  agent_type,
  department,
  tags,
  io_schema,
  capabilities,
  context,
  llm_config,
  metadata
) VALUES (
  -- Basic identifiers
  'blog-post-writer',
  ARRAY['demo-org']::TEXT[],
  'Blog Post Writer',
  'AI-powered blog post creation agent that generates high-quality, SEO-optimized content.',
  '1.0.0',
  'context',
  'marketing',
  ARRAY['content-creation', 'seo', 'writing', 'marketing']::TEXT[],

  -- Input/Output Schema (defines what the agent accepts and returns)
  '{
    "input": {
      "type": "object",
      "required": ["topic", "targetAudience"],
      "properties": {
        "topic": {
          "type": "string",
          "description": "The main topic of the blog post"
        },
        "targetAudience": {
          "type": "string",
          "description": "Intended audience (e.g., developers, marketers)"
        },
        "tone": {
          "type": "string",
          "enum": ["professional", "casual", "technical"],
          "default": "professional"
        },
        "length": {
          "type": "string",
          "enum": ["short", "medium", "long"],
          "default": "medium"
        },
        "keywords": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "output": {
      "type": "object",
      "required": ["title", "content", "metadata"],
      "properties": {
        "title": {"type": "string"},
        "content": {"type": "string"},
        "metadata": {
          "type": "object",
          "properties": {
            "wordCount": {"type": "number"},
            "readingTime": {"type": "number"},
            "seoScore": {"type": "number"}
          }
        }
      }
    }
  }'::jsonb,

  -- Capabilities (what the agent can do)
  ARRAY[
    'blog-writing',
    'content-generation',
    'seo-optimization',
    'keyword-integration',
    'plan',
    'build'
  ]::TEXT[],

  -- Context (System Prompt - instructions for the agent)
  'You are an expert blog post writer specializing in SEO-optimized content.

## Your Core Competencies
1. Content Creation Excellence
2. SEO Optimization
3. Audience Understanding

## Writing Process
1. Analyze Requirements
2. Structure Planning
3. Content Creation
4. Quality Assurance

Always structure your response as valid JSON matching the output schema.',

  -- LLM Configuration (which model to use)
  '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 4000,
      "topP": 0.9
    }
  }'::jsonb,

  -- Metadata (optional extended information)
  '{
    "author": "Orchestrator AI Team",
    "mode_profile": "full",
    "execution_capabilities": {
      "can_converse": true,
      "can_plan": true,
      "can_build": true
    }
  }'::jsonb
);
```

### Option 2: LangGraph-First (API Agents)

1. **Build your agent as a LangGraph workflow** in `apps/langgraph/src/agents/{workflow-name}/`

Here's what a LangGraph controller looks like:

```typescript
// apps/langgraph/src/agents/marketing-swarm/marketing-swarm.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MarketingSwarmService } from './marketing-swarm.service';
import { MarketingSwarmRequestDto } from './dto';

@Controller('marketing-swarm')
export class MarketingSwarmController {
  constructor(private readonly marketingSwarmService: MarketingSwarmService) {}

  /**
   * Execute the marketing swarm workflow
   * Endpoint: POST /marketing-swarm/execute
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: MarketingSwarmRequestDto) {
    // ExecutionContext is required (contains taskId, userId, orgSlug, etc.)
    if (!request.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    const result = await this.marketingSwarmService.execute({
      context: request.context,
      taskId: request.context.taskId,
    });

    return {
      success: result.status === 'completed',
      data: result,
    };
  }

  /**
   * Get execution status
   * Endpoint: GET /marketing-swarm/status/:taskId
   */
  @Get('status/:taskId')
  async getStatus(@Param('taskId') taskId: string) {
    const status = await this.marketingSwarmService.getStatus(taskId);
    return { success: true, data: status };
  }
}
```

2. **The workflow automatically exposes endpoints** at:
   - `POST http://localhost:6200/marketing-swarm/execute` - Start execution
   - `GET http://localhost:6200/marketing-swarm/status/:taskId` - Check status

3. **Create a database record** that references that endpoint:

```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  name,
  description,
  agent_type,
  department,
  io_schema,
  capabilities,
  context,
  endpoint,
  metadata
) VALUES (
  'marketing-swarm',
  ARRAY['demo-org']::TEXT[],
  'Marketing Swarm',
  'Multi-agent workflow for generating marketing content',
  'api',
  'marketing',
  '{
    "input": {
      "type": "object",
      "properties": {
        "contentType": {"type": "string"},
        "requirements": {"type": "string"}
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "deliverable": {"type": "object"}
      }
    }
  }'::jsonb,
  ARRAY['content-generation', 'multi-agent', 'workflow']::TEXT[],
  'Marketing Swarm coordinates multiple agents to create comprehensive marketing content.',
  -- Endpoint configuration pointing to LangGraph workflow
  '{
    "url": "http://localhost:6200/marketing-swarm/execute",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "timeout": 300000
  }'::jsonb,
  -- Metadata indicating this is a LangGraph workflow
  '{
    "provider": "langgraph",
    "langgraphEndpoint": "http://localhost:6200",
    "features": ["hitl", "checkpointing"],
    "statusEndpoint": "/marketing-swarm/status/{taskId}"
  }'::jsonb
);
```

**Request Format**: LangGraph endpoints expect an `ExecutionContext` capsule plus workflow-specific fields:

```typescript
// Request body structure for Marketing Swarm
// apps/langgraph/src/agents/marketing-swarm/dto/marketing-swarm-request.dto.ts
{
  // ExecutionContext capsule (required) - contains all execution metadata
  context: {
    taskId: "task-123",
    conversationId: "conv-456",
    userId: "user-789",
    organizationSlug: "demo-org",
    agentSlug: "marketing-swarm",
    agentType: "api",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    // ... other ExecutionContext fields
  },
  // Optional workflow-specific fields
  userMessage: "Write about AI trends" // Optional, often ignored
}

// The task configuration is stored in the database
// The service fetches it using context.taskId
```

**Key Point**: LangGraph workflows use the **ExecutionContext capsule pattern**:
- Frontend creates the complete `ExecutionContext` object
- Backend receives it whole (never constructs it)
- Passes it through all services, LLM calls, and observability events
- Contains all metadata needed for execution, tracking, and PII handling

### Option 3: External API (n8n or Other)

1. Build your workflow in n8n (or any external API)
2. Create a database record that references that external endpoint:

```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  name,
  description,
  agent_type,
  department,
  io_schema,
  capabilities,
  context,
  endpoint,
  metadata
) VALUES (
  'my-n8n-agent',
  ARRAY['my-org']::TEXT[],
  'My N8N Agent',
  'An agent built with N8N',
  'api',
  'operations',
  '{"input": {"type": "object"}, "output": {"type": "object"}}'::jsonb,
  ARRAY['workflow-automation']::TEXT[],
  'This agent executes N8N workflows.',
  '{
    "url": "https://your-n8n-instance.com/webhook/my-workflow",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "authentication": {
      "type": "api-key",
      "config": {"header": "X-N8N-API-KEY", "value": "your-api-key"}
    }
  }'::jsonb,
  '{
    "provider": "n8n",
    "n8nWorkflowId": "workflow-id-123",
    "n8nWebhookPath": "/my-workflow"
  }'::jsonb
);
```

## Real-World Examples from the Codebase

### Example 1: Context Agent (Blog Post Writer)

This is a complete, production-ready example from `apps/api/supabase/archive/seeds/02_agents.sql`:

**Complete Database Record:**
```sql
INSERT INTO public.agents (
  slug,                    -- 'blog-post-writer'
  organization_slug,       -- ARRAY['demo-org']::TEXT[]
  name,                    -- 'Blog Post Writer'
  description,             -- 'AI-powered blog post creation agent...'
  version,                 -- '1.0.0'
  agent_type,              -- 'context' (uses context runner)
  department,              -- 'marketing'
  tags,                    -- ARRAY['content-creation', 'seo', 'writing', 'marketing']::TEXT[]
  io_schema,               -- Full JSON schema (see seed file for complete schema)
  capabilities,            -- ARRAY['blog-writing', 'content-generation', 'seo-optimization', ...]::TEXT[]
  context,                 -- Detailed system prompt (200+ lines with instructions)
  llm_config,              -- {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022", "parameters": {...}}
  metadata                 -- {"author": "Orchestrator AI Team", "execution_capabilities": {...}}
) VALUES (
  'blog-post-writer',
  ARRAY['demo-org']::TEXT[],
  'Blog Post Writer',
  'AI-powered blog post creation agent that generates high-quality, SEO-optimized content. Supports various tones, lengths, and formats with built-in keyword optimization and readability analysis.',
  '1.0.0',
  'context',
  'marketing',
  ARRAY['content-creation', 'seo', 'writing', 'marketing', 'blog']::TEXT[],
  -- Full io_schema with detailed input/output structure
  '{"input": {"type": "object", "required": ["topic", "targetAudience"], "properties": {...}}, "output": {...}}'::jsonb,
  ARRAY['blog-writing', 'content-generation', 'seo-optimization', 'keyword-integration', 'plan', 'build']::TEXT[],
  -- Comprehensive system prompt (truncated here - see seed file for full 200+ line prompt)
  'You are an expert blog post writer and content strategist specializing in creating engaging, SEO-optimized content...',
  '{"provider": "anthropic", "model": "claude-3-5-sonnet-20241022", "parameters": {"temperature": 0.7, "maxTokens": 4000, "topP": 0.9}}'::jsonb,
  '{"author": "Orchestrator AI Team", "mode_profile": "full", "execution_capabilities": {"can_converse": true, "can_plan": true, "can_build": true}}'::jsonb
);
```

**How it works:**
1. User calls agent with input: `{ topic: "AI Trends", targetAudience: "developers", tone: "technical" }`
2. Context runner fetches relevant context (plans, deliverables, conversation history)
3. Combines context with the detailed system prompt from `context` column
4. Calls LLM using `llm_config` settings (Anthropic Claude Sonnet)
5. Returns structured output matching `io_schema.output` schema

### Example 2: LangGraph API Agent (Marketing Swarm)

**LangGraph Workflow Structure:**
```
apps/langgraph/src/agents/marketing-swarm/
├── marketing-swarm.controller.ts    # REST endpoints (NestJS)
├── marketing-swarm.service.ts        # Workflow orchestration
├── marketing-swarm.graph.ts          # LangGraph state graph
├── marketing-swarm.state.ts          # State definition
└── dto/
    └── marketing-swarm-request.dto.ts # Request DTO
```

**Controller Implementation:**
```typescript
// apps/langgraph/src/agents/marketing-swarm/marketing-swarm.controller.ts
@Controller('marketing-swarm')
export class MarketingSwarmController {
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: MarketingSwarmRequestDto) {
    // ExecutionContext capsule is required
    if (!request.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    const result = await this.marketingSwarmService.execute({
      context: request.context,
      taskId: request.context.taskId,
    });

    return {
      success: result.status === 'completed',
      data: result,
    };
  }

  @Get('status/:taskId')
  async getStatus(@Param('taskId') taskId: string) {
    const status = await this.marketingSwarmService.getStatus(taskId);
    return { success: true, data: status };
  }
}
```

**Request DTO Structure:**
```typescript
// apps/langgraph/src/agents/marketing-swarm/dto/marketing-swarm-request.dto.ts
export class MarketingSwarmRequestDto {
  @IsObject()
  @IsNotEmpty()
  context: ExecutionContext;  // Required ExecutionContext capsule

  @IsString()
  @IsOptional()
  userMessage?: string;  // Optional, often ignored
}
```

**Database Record:**
```sql
INSERT INTO public.agents (
  slug,
  organization_slug,
  name,
  description,
  agent_type,
  department,
  io_schema,
  capabilities,
  context,
  endpoint,
  metadata
) VALUES (
  'marketing-swarm',
  ARRAY['demo-org']::TEXT[],
  'Marketing Swarm',
  'Multi-agent workflow for generating marketing content',
  'api',  -- API agent type
  'marketing',
  '{"input": {...}, "output": {...}}'::jsonb,
  ARRAY['content-generation', 'multi-agent', 'workflow']::TEXT[],
  'Marketing Swarm coordinates multiple agents to create comprehensive marketing content.',
  -- Endpoint points to LangGraph workflow
  '{
    "url": "http://localhost:6200/marketing-swarm/execute",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "timeout": 300000
  }'::jsonb,
  -- Metadata indicates LangGraph provider
  '{
    "provider": "langgraph",
    "langgraphEndpoint": "http://localhost:6200",
    "features": ["hitl", "checkpointing"],
    "statusEndpoint": "/marketing-swarm/status/{taskId}"
  }'::jsonb
);
```

**How it works:**
1. User calls agent via Orchestrator AI API: `POST /agents/demo-org/marketing-swarm/tasks`
2. API runner reads `endpoint` configuration from database
3. Makes HTTP POST to `http://localhost:6200/marketing-swarm/execute` with ExecutionContext
4. LangGraph workflow executes (multi-step LLM calls, agent coordination)
5. Workflow returns result with status
6. API runner stores result as deliverable in database
7. User can check status via `GET /marketing-swarm/status/:taskId`

**Available LangGraph Endpoints:**
- `POST /marketing-swarm/execute` - Start execution
- `GET /marketing-swarm/status/:taskId` - Check status
- `GET /marketing-swarm/state/:taskId` - Get full execution state
- `GET /marketing-swarm/deliverable/:taskId` - Get deliverable
- `DELETE /marketing-swarm/:taskId` - Delete task

### Example 3: Data Analyst LangGraph Agent

**Controller:**
```typescript
// apps/langgraph/src/agents/data-analyst/data-analyst.controller.ts
@Controller('data-analyst')
export class DataAnalystController {
  @Post('analyze')
  async analyze(@Body() request: DataAnalystRequestDto) {
    // ExecutionContext capsule required
    if (!request.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    const result = await this.dataAnalystService.analyze({
      context: request.context,
      userMessage: request.userMessage,
    });

    return {
      success: result.status === 'completed',
      data: result,
    };
  }

  @Get('status/:threadId')
  async getStatus(@Param('threadId') threadId: string) {
    const status = await this.dataAnalystService.getStatus(threadId);
    return { success: true, data: status };
  }
}
```

**Database Record:**
```sql
INSERT INTO public.agents (
  slug,
  agent_type,
  endpoint,
  metadata
) VALUES (
  'data-analyst',
  'api',
  '{
    "url": "http://localhost:6200/data-analyst/analyze",
    "method": "POST",
    "headers": {"Content-Type": "application/json"}
  }'::jsonb,
  '{
    "provider": "langgraph",
    "langgraphEndpoint": "http://localhost:6200",
    "statusEndpoint": "/data-analyst/status/{threadId}"
  }'::jsonb
);
```

## Code Examples

### Creating a Context Agent via API

```typescript
// Create a context agent programmatically
const agent = await supabase
  .from('agents')
  .insert({
    slug: 'blog-writer',
    organization_slug: ['my-org'],
    name: 'Blog Post Writer',
    description: 'Writes blog posts based on topics',
    agent_type: 'context',
    department: 'marketing',
    io_schema: {
      input: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          tone: { type: 'string', enum: ['professional', 'casual', 'technical'] }
        },
        required: ['topic']
      },
      output: { type: 'string' }
    },
    capabilities: ['blog-writing', 'content-generation'],
    context: `You are an expert blog writer. Write engaging blog posts about the given topic.
    
    Guidelines:
    - Use the specified tone
    - Include an introduction, body, and conclusion
    - Make it engaging and informative`,
    llm_config: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      parameters: {
        temperature: 0.7,
        maxTokens: 4000
      }
    }
  });
```

### Creating a RAG Agent

```typescript
// Create a RAG agent that queries a specific collection
const ragAgent = await supabase
  .from('agents')
  .insert({
    slug: 'hr-policy-assistant',
    organization_slug: ['my-org'],
    name: 'HR Policy Assistant',
    description: 'Answers questions about HR policies using RAG',
    agent_type: 'rag-runner',
    department: 'hr',
    io_schema: {
      input: {
        type: 'object',
        properties: {
          question: { type: 'string' }
        },
        required: ['question']
      },
      output: { type: 'string' }
    },
    capabilities: ['policy-query', 'rag-search'],
    context: 'You are an HR policy assistant. Answer questions based on the retrieved policy documents.',
    metadata: {
      rag_config: {
        collection_slug: 'hr-policies',
        top_k: 5,
        similarity_threshold: 0.6
      }
    },
    llm_config: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022'
    }
  });
```

### Using RAG in a Context Agent

```typescript
// Context agents can also use RAG by fetching from collections
// The context runner will automatically query RAG if configured
const contextAgentWithRAG = await supabase
  .from('agents')
  .insert({
    slug: 'research-assistant',
    organization_slug: ['my-org'],
    name: 'Research Assistant',
    description: 'Researches topics using RAG collections',
    agent_type: 'context',
    department: 'research',
    io_schema: {
      input: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      },
      output: { type: 'string' }
    },
    capabilities: ['research', 'rag-query'],
    context: `You are a research assistant. Use the provided context from RAG collections to answer research questions.

    Context sources:
    - RAG collection: research-docs
    - Conversation history
    - Previous deliverables`,
    metadata: {
      context: {
        sources: ['rag:research-docs', 'conversations', 'deliverables'],
        systemPromptTemplate: 'Research Question: {{query}}\n\nContext: {{rag_results}}'
      }
    },
    llm_config: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022'
    }
  });
```

## Agent Database Schema

All agents are stored in the `public.agents` table with this structure:

| Column | Type | Description |
|--------|------|-------------|
| `slug` | TEXT | Primary key - globally unique identifier |
| `organization_slug` | TEXT[] | Array of organization slugs (supports multi-org) |
| `name` | TEXT | Human-readable agent name |
| `description` | TEXT | Detailed description |
| `version` | TEXT | Semantic version (default: '1.0.0') |
| `agent_type` | TEXT | One of: 'context', 'api', 'external', 'rag-runner', 'orchestrator', 'media', 'prediction', 'risk' |
| `department` | TEXT | Department/category (e.g., 'marketing', 'hr', 'engineering') |
| `tags` | TEXT[] | Array of tags for discovery |
| `io_schema` | JSONB | Input/output JSON schema (required) |
| `capabilities` | TEXT[] | Array of capability identifiers (required) |
| `context` | TEXT | System prompt (context agents) or prompt enhancement (API agents) |
| `endpoint` | JSONB | API endpoint config (API/external agents only) |
| `llm_config` | JSONB | LLM provider/parameters (context/rag agents only) |
| `metadata` | JSONB | Flexible extended metadata |

## Tutorial: Building Your First Agent

See [Build Your First Agent Tutorial](tutorials/BUILD_FIRST_AGENT.md) for a complete step-by-step guide.

## Best Practices

### Agent Design

1. **Single Responsibility** - Each agent should do one thing well
2. **Clear IO Schema** - Define explicit input/output schemas
3. **Proper Agent Type** - Choose the right type (context vs API vs RAG)
4. **Error Handling** - Agents should handle failures gracefully
5. **Progress Updates** - Stream progress for long-running tasks

### Security

1. **PII Handling** - Platform automatically handles PII pseudonymization
2. **Organization Scoping** - Always scope agents to correct organizations
3. **RBAC** - Respect role-based permissions
4. **Audit Logging** - All agent executions are logged

### Performance

1. **Context Optimization** - Context agents automatically optimize token usage
2. **Caching** - Consider caching for expensive operations
3. **Streaming** - Use streaming for long responses
4. **Async Processing** - Use async for I/O operations

## Further Reading

- [Agent Development Guide](docs/agents/README.md) - Detailed agent development
- [A2A Protocol Specification](docs/a2a/README.md) - Agent-to-agent communication
- [RAG Documentation](specs/prd-phase-6-rag-infrastructure.md) - RAG infrastructure
- [Architecture Documentation](ARCHITECTURE.md) - System architecture
- [Database Schema](docs/database/schema.md) - Database structure

## Contributing Examples

Have a great example? We'd love to include it!

1. Create your agent in the database (or LangGraph/n8n)
2. Document it clearly
3. Submit a pull request with:
   - Agent description
   - Use case
   - Database record or code/workflow
   - Example usage

---

For questions about examples, contact: golfergeek@orchestratorai.io
