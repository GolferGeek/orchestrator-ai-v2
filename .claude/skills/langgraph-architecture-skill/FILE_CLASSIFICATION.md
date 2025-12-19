# LangGraph File Classification

How to classify LangGraph files by type and location.

## File Types

### Workflow Graph (`*.graph.ts`)

**Location:** `src/agents/[agent-name]/[agent-name].graph.ts`

**Pattern:**
```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseStateAnnotation } from "../../state/base-state.annotation";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";

export function createMyWorkflowGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  const graph = new StateGraph(MyWorkflowStateAnnotation);
  
  // Add nodes
  graph.addNode("start", startNode);
  
  // Add edges
  graph.addEdge("start", END);
  
  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getCheckpointer(),
  });
}
```

**Key Indicators:**
- Exports function `create[AgentName]Graph()`
- Uses `StateGraph` from LangGraph
- Takes services as parameters (LLM, observability, checkpointer)
- Returns compiled graph

### State Annotation (`*.state.ts`)

**Location:** `src/agents/[agent-name]/[agent-name].state.ts`

**Pattern:**
```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseStateAnnotation } from "../../state/base-state.annotation";

export const MyWorkflowStateAnnotation = Annotation.Root({
  ...BaseStateAnnotation.spec, // Includes ExecutionContext fields
  
  // Workflow-specific fields
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
});

export type MyWorkflowState = typeof MyWorkflowStateAnnotation.State;
```

**Key Indicators:**
- Uses `Annotation.Root()` from LangGraph
- Extends `BaseStateAnnotation` for ExecutionContext
- Defines workflow-specific state fields
- Exports state type

### Service (`*.service.ts`)

**Location:** `src/agents/[agent-name]/[agent-name].service.ts`

**Pattern:**
```typescript
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createMyWorkflowGraph } from "./my-workflow.graph";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";

@Injectable()
export class MyWorkflowService implements OnModuleInit {
  private graph: CompiledStateGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
  ) {}

  async onModuleInit() {
    this.graph = createMyWorkflowGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
    );
  }

  async execute(input: MyWorkflowInput): Promise<MyWorkflowResult> {
    // Execute workflow
  }
}
```

**Key Indicators:**
- NestJS service (`@Injectable`)
- Implements `OnModuleInit`
- Creates graph in `onModuleInit()`
- Manages workflow lifecycle

### Controller (`*.controller.ts`)

**Location:** `src/agents/[agent-name]/[agent-name].controller.ts`

**Pattern:**
```typescript
import { Controller, Post, Body } from "@nestjs/common";
import { MyWorkflowService } from "./my-workflow.service";
import { MyWorkflowRequestDto } from "./dto/my-workflow-request.dto";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

@Controller("workflows/my-workflow")
export class MyWorkflowController {
  constructor(private readonly service: MyWorkflowService) {}

  @Post()
  async execute(@Body() dto: MyWorkflowRequestDto) {
    const context: ExecutionContext = {
      // Extract ExecutionContext from DTO
    };
    
    return await this.service.execute({
      executionContext: context,
      // ... other input
    });
  }
}
```

**Key Indicators:**
- NestJS controller (`@Controller`)
- HTTP endpoints (`@Post`, `@Get`, etc.)
- Validates ExecutionContext from request
- Delegates to service

### Module (`*.module.ts`)

**Location:** `src/agents/[agent-name]/[agent-name].module.ts`

**Pattern:**
```typescript
import { Module } from "@nestjs/common";
import { MyWorkflowController } from "./my-workflow.controller";
import { MyWorkflowService } from "./my-workflow.service";
import { SharedServicesModule } from "../../services/shared-services.module";

@Module({
  imports: [SharedServicesModule],
  controllers: [MyWorkflowController],
  providers: [MyWorkflowService],
  exports: [MyWorkflowService],
})
export class MyWorkflowModule {}
```

**Key Indicators:**
- NestJS module (`@Module`)
- Dependency injection configuration
- Imports, controllers, providers, exports

### Tool (`*.tool.ts`)

**Location:** `src/tools/[category]/[tool-name].tool.ts`

**Pattern:**
```typescript
import { BaseTool } from "@langchain/core/tools";

export class MyTool extends BaseTool {
  name = "my_tool";
  description = "Tool description";

  async _call(input: string): Promise<string> {
    // Tool implementation
    return "Tool result";
  }
}
```

**Key Indicators:**
- Extends `BaseTool` from LangChain
- Implements `_call()` method
- Defines name and description

### DTO (`*.dto.ts`)

**Location:** `src/agents/[agent-name]/dto/[dto-name].dto.ts`

**Pattern:**
```typescript
import { IsString, IsUUID } from "class-validator";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

export class MyWorkflowRequestDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  conversationId: string;

  @IsUUID()
  userId: string;

  @IsString()
  prompt: string;

  // ... other fields
}
```

**Key Indicators:**
- Uses class-validator decorators
- Contains ExecutionContext fields
- Request/response DTOs

## File Location Patterns

### Agent Directory Structure

```
src/agents/[agent-name]/
├── [agent-name].graph.ts      # Workflow graph
├── [agent-name].state.ts      # State annotation
├── [agent-name].service.ts   # Service
├── [agent-name].controller.ts # Controller
├── [agent-name].module.ts     # Module
├── dto/                       # DTOs
│   ├── [agent-name]-request.dto.ts
│   └── index.ts
└── utils/                     # Utilities (optional)
```

### Services Directory

```
src/services/
├── llm-http-client.service.ts    # LLM service client
├── observability.service.ts       # Observability service
├── llm-usage-reporter.service.ts  # LLM usage reporting
├── hitl-helper.service.ts        # HITL helper
└── shared-services.module.ts     # Shared services module
```

### Tools Directory

```
src/tools/
├── [category]/
│   ├── [tool-name].tool.ts
│   └── index.ts
└── tools.module.ts
```

### State Directory

```
src/state/
├── base-state.annotation.ts  # Base state with ExecutionContext
└── index.ts
```

### Persistence Directory

```
src/persistence/
├── postgres-checkpointer.service.ts  # Checkpointing service
├── persistence.module.ts
└── index.ts
```

## Classification Rules

1. **Workflow Graph**: Function that creates StateGraph, exports `create[Name]Graph()`
2. **State Annotation**: Uses `Annotation.Root()`, extends `BaseStateAnnotation`
3. **Service**: NestJS `@Injectable`, manages workflow lifecycle
4. **Controller**: NestJS `@Controller`, HTTP endpoints
5. **Module**: NestJS `@Module`, DI configuration
6. **Tool**: Extends `BaseTool`, implements `_call()`
7. **DTO**: Class with validation decorators, contains ExecutionContext fields

