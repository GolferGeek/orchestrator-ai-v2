# LangGraph Workflow Pattern Examples

Examples demonstrating different LangGraph workflow patterns and when to use them.

---

## Pattern 1: Simple Linear Workflow

**Use Case:** Sequential steps with no branching.

```typescript
// apps/langgraph/src/workflows/simple-linear.workflow.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/core/annotations';

// State annotation
interface SimpleState {
  input: string;
  step1Result: string;
  step2Result: string;
  finalResult: string;
}

const stateAnnotation = Annotation.Root({
  input: Annotation<string>,
  step1Result: Annotation<string>,
  step2Result: Annotation<string>,
  finalResult: Annotation<string>
});

// Nodes
async function step1(state: SimpleState): Promise<Partial<SimpleState>> {
  return {
    step1Result: `Processed: ${state.input}`
  };
}

async function step2(state: SimpleState): Promise<Partial<SimpleState>> {
  return {
    step2Result: `Enhanced: ${state.step1Result}`
  };
}

async function finalize(state: SimpleState): Promise<Partial<SimpleState>> {
  return {
    finalResult: `Final: ${state.step2Result}`
  };
}

// Build workflow
const workflow = new StateGraph(stateAnnotation)
  .addNode('step1', step1)
  .addNode('step2', step2)
  .addNode('finalize', finalize)
  .addEdge(START, 'step1')
  .addEdge('step1', 'step2')
  .addEdge('step2', 'finalize')
  .addEdge('finalize', END);

export const simpleLinearWorkflow = workflow.compile();
```

**When to Use:**
- ✅ Simple sequential processing
- ✅ No conditional logic
- ✅ No loops or retries
- ✅ Fast execution

---

## Pattern 2: Conditional Branching Workflow

**Use Case:** Different paths based on conditions.

```typescript
// apps/langgraph/src/workflows/conditional-branch.workflow.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/core/annotations';

interface ConditionalState {
  input: string;
  needsApproval: boolean;
  approved: boolean;
  result: string;
}

const stateAnnotation = Annotation.Root({
  input: Annotation<string>,
  needsApproval: Annotation<boolean>,
  approved: Annotation<boolean>,
  result: Annotation<string>
});

// Nodes
async function checkApproval(state: ConditionalState): Promise<Partial<ConditionalState>> {
  const needsApproval = state.input.length > 100;
  return { needsApproval };
}

async function processDirectly(state: ConditionalState): Promise<Partial<ConditionalState>> {
  return {
    result: `Processed directly: ${state.input}`
  };
}

async function requestApproval(state: ConditionalState): Promise<Partial<ConditionalState>> {
  // Create HITL task
  // Workflow pauses here
  return {
    approved: false // Will be updated by HITL
  };
}

async function processAfterApproval(state: ConditionalState): Promise<Partial<ConditionalState>> {
  return {
    result: `Processed after approval: ${state.input}`
  };
}

// Conditional edge function
function routeAfterCheck(state: ConditionalState): string {
  return state.needsApproval ? 'requestApproval' : 'processDirectly';
}

function routeAfterApproval(state: ConditionalState): string {
  return state.approved ? 'processAfterApproval' : END;
}

// Build workflow
const workflow = new StateGraph(stateAnnotation)
  .addNode('checkApproval', checkApproval)
  .addNode('processDirectly', processDirectly)
  .addNode('requestApproval', requestApproval)
  .addNode('processAfterApproval', processAfterApproval)
  .addEdge(START, 'checkApproval')
  .addConditionalEdges('checkApproval', routeAfterCheck)
  .addEdge('processDirectly', END)
  .addConditionalEdges('requestApproval', routeAfterApproval)
  .addEdge('processAfterApproval', END);

export const conditionalBranchWorkflow = workflow.compile();
```

**When to Use:**
- ✅ Conditional logic needed
- ✅ Different processing paths
- ✅ HITL integration
- ✅ Decision points

---

## Pattern 3: Database-Driven State Machine

**Use Case:** Complex, long-running workflows with parallel steps.

```typescript
// apps/langgraph/src/workflows/database-driven.workflow.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/core/annotations';
import { DatabaseStateService } from '../services/database-state.service';

interface DatabaseState {
  swarmId: string;
  conversationId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep: string;
  data: Record<string, any>;
}

const stateAnnotation = Annotation.Root({
  swarmId: Annotation<string>,
  conversationId: Annotation<string>,
  userId: Annotation<string>,
  status: Annotation<string>,
  currentStep: Annotation<string>,
  data: Annotation<Record<string, any>>
});

// Database service
const dbStateService = new DatabaseStateService();

// Nodes that read/write database state
async function initialize(state: DatabaseState): Promise<Partial<DatabaseState>> {
  // Create database entry
  await dbStateService.createState({
    swarmId: state.swarmId,
    conversationId: state.conversationId,
    userId: state.userId,
    status: 'processing',
    currentStep: 'initialization',
    data: {}
  });

  return {
    status: 'processing',
    currentStep: 'initialization'
  };
}

async function processStep(state: DatabaseState): Promise<Partial<DatabaseState>> {
  // Read current state from database
  const dbState = await dbStateService.getState(state.swarmId);

  // Process based on current step
  const result = await processCurrentStep(dbState);

  // Update database state
  await dbStateService.updateState(state.swarmId, {
    currentStep: 'content_generation',
    data: { ...dbState.data, ...result }
  });

  return {
    currentStep: 'content_generation',
    data: { ...dbState.data, ...result }
  };
}

async function finalize(state: DatabaseState): Promise<Partial<DatabaseState>> {
  // Update database to completed
  await dbStateService.updateState(state.swarmId, {
    status: 'completed',
    currentStep: 'completed'
  });

  return {
    status: 'completed'
  };
}

// Build workflow
const workflow = new StateGraph(stateAnnotation)
  .addNode('initialize', initialize)
  .addNode('processStep', processStep)
  .addNode('finalize', finalize)
  .addEdge(START, 'initialize')
  .addEdge('initialize', 'processStep')
  .addEdge('processStep', 'finalize')
  .addEdge('finalize', END);

export const databaseDrivenWorkflow = workflow.compile();
```

**When to Use:**
- ✅ Complex workflows
- ✅ Long-running processes
- ✅ Parallel steps
- ✅ State persistence needed
- ✅ Resume from checkpoint

---

## Pattern 4: HITL Workflow

**Use Case:** Workflows requiring human approval or input.

```typescript
// apps/langgraph/src/workflows/hitl-workflow.workflow.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/core/annotations';
import { HITLService } from '../services/hitl.service';

interface HITLState {
  taskId: string;
  content: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  finalContent: string;
}

const stateAnnotation = Annotation.Root({
  taskId: Annotation<string>,
  content: Annotation<string>,
  approvalStatus: Annotation<string>,
  finalContent: Annotation<string>
});

const hitlService = new HITLService();

// Nodes
async function generateContent(state: HITLState): Promise<Partial<HITLState>> {
  // Generate content (via LLM service)
  const content = await generateViaLLM(state.taskId);
  return { content };
}

async function requestApproval(state: HITLState): Promise<Partial<HITLState>> {
  // Create HITL task - workflow pauses here
  await hitlService.createTask({
    taskId: state.taskId,
    type: 'content_approval',
    content: state.content,
    status: 'pending'
  });

  return {
    approvalStatus: 'pending'
  };
}

async function processApproval(state: HITLState): Promise<Partial<HITLState>> {
  // Check approval status from database
  const task = await hitlService.getTask(state.taskId);

  if (task.status === 'approved') {
    return {
      approvalStatus: 'approved',
      finalContent: state.content
    };
  } else if (task.status === 'rejected') {
    return {
      approvalStatus: 'rejected'
    };
  }

  // Still pending
  return {
    approvalStatus: 'pending'
  };
}

async function handleRejection(state: HITLState): Promise<Partial<HITLState>> {
  // Regenerate content if rejected
  const newContent = await generateViaLLM(state.taskId);
  return {
    content: newContent,
    approvalStatus: 'pending'
  };
}

// Conditional routing
function routeAfterApproval(state: HITLState): string {
  if (state.approvalStatus === 'approved') return 'finalize';
  if (state.approvalStatus === 'rejected') return 'handleRejection';
  return 'processApproval'; // Still pending
}

async function finalize(state: HITLState): Promise<Partial<HITLState>> {
  return {
    finalContent: state.finalContent
  };
}

// Build workflow
const workflow = new StateGraph(stateAnnotation)
  .addNode('generateContent', generateContent)
  .addNode('requestApproval', requestApproval)
  .addNode('processApproval', processApproval)
  .addNode('handleRejection', handleRejection)
  .addNode('finalize', finalize)
  .addEdge(START, 'generateContent')
  .addEdge('generateContent', 'requestApproval')
  .addConditionalEdges('requestApproval', routeAfterApproval)
  .addEdge('processApproval', 'requestApproval') // Loop until approved/rejected
  .addEdge('handleRejection', 'requestApproval') // Retry with new content
  .addEdge('finalize', END);

export const hitlWorkflow = workflow.compile();
```

**When to Use:**
- ✅ Human approval needed
- ✅ Content review required
- ✅ Quality gates
- ✅ Long-running with pauses

---

## Pattern 5: Parallel Processing Workflow

**Use Case:** Multiple independent steps that can run in parallel.

```typescript
// apps/langgraph/src/workflows/parallel-processing.workflow.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/core/annotations';

interface ParallelState {
  input: string;
  result1: string;
  result2: string;
  result3: string;
  combined: string;
}

const stateAnnotation = Annotation.Root({
  input: Annotation<string>,
  result1: Annotation<string>,
  result2: Annotation<string>,
  result3: Annotation<string>,
  combined: Annotation<string>
});

// Parallel nodes
async function process1(state: ParallelState): Promise<Partial<ParallelState>> {
  return {
    result1: `Process 1: ${state.input}`
  };
}

async function process2(state: ParallelState): Promise<Partial<ParallelState>> {
  return {
    result2: `Process 2: ${state.input}`
  };
}

async function process3(state: ParallelState): Promise<Partial<ParallelState>> {
  return {
    result3: `Process 3: ${state.input}`
  };
}

async function combine(state: ParallelState): Promise<Partial<ParallelState>> {
  return {
    combined: `${state.result1} | ${state.result2} | ${state.result3}`
  };
}

// Build workflow with parallel paths
const workflow = new StateGraph(stateAnnotation)
  .addNode('process1', process1)
  .addNode('process2', process2)
  .addNode('process3', process3)
  .addNode('combine', combine)
  .addEdge(START, 'process1')
  .addEdge(START, 'process2')
  .addEdge(START, 'process3')
  .addEdge('process1', 'combine')
  .addEdge('process2', 'combine')
  .addEdge('process3', 'combine')
  .addEdge('combine', END);

export const parallelProcessingWorkflow = workflow.compile();
```

**When to Use:**
- ✅ Independent processing steps
- ✅ Performance optimization
- ✅ Multiple data sources
- ✅ Concurrent operations

---

## Pattern Selection Guide

| Pattern | Complexity | Use Case | State Storage |
|---------|-----------|----------|---------------|
| **Simple Linear** | Low | Sequential steps | In-memory |
| **Conditional Branch** | Medium | Decision points | In-memory |
| **Database-Driven** | High | Complex, long-running | Database |
| **HITL** | Medium-High | Human approval | Database |
| **Parallel** | Medium | Independent steps | In-memory |

---

## Related

- `SKILL.md` - Core LangGraph architecture principles
- `ARCHITECTURE.md` - LangGraph architecture details
- `DATABASE_STATE.md` - Database-driven state patterns
- `HITL.md` - HITL patterns
- `PATTERNS.md` - General LangGraph patterns

