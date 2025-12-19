---
name: api-architecture-skill
description: "Classify API files and validate against NestJS API application patterns. Use when working with controllers, services, modules, runners, DTOs, or any API application code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# API Architecture Skill

Classify API files and validate against NestJS API application patterns, module/controller/service architecture, and agent runner patterns.

## Purpose

This skill enables agents to:
1. **Classify Files**: Identify file types (controller, service, module, runner, dto, interface)
2. **Validate Patterns**: Check compliance with API-specific patterns
3. **Check Architecture**: Ensure module/controller/service architecture is followed
4. **Validate Decisions**: Check compliance with architectural decisions

## When to Use

- **Classifying Files**: When determining what type of file you're working with
- **Validating Patterns**: When checking if code follows API patterns
- **Architecture Compliance**: When ensuring module/controller/service architecture is maintained
- **Code Review**: When reviewing API code for compliance

## Core Principles

### 1. NestJS Module/Controller/Service Pattern

**Module** (`*.module.ts`):
- Dependency injection configuration
- Imports, controllers, providers, exports
- Uses `@Module` decorator

**Controller** (`*.controller.ts`):
- HTTP request/response handling
- Uses `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete` decorators
- Delegates to services for business logic

**Service** (`*.service.ts`):
- Business logic
- Uses `@Injectable` decorator
- Dependency injection via constructor

### 2. Agent Runner Pattern

- Extend `BaseAgentRunner` abstract class
- Implement mode handlers (`handleConverse`, `handlePlan`, `handleBuild`, `handleHitl`)
- Register runner in `AgentRunnerRegistryService`
- Support mode routing (CONVERSE, PLAN, BUILD, HITL)

### 3. ExecutionContext Flow

- ExecutionContext created by frontend, flows through unchanged
- Backend can ONLY mutate: taskId, deliverableId, planId (when first created)
- Backend must VALIDATE: userId matches JWT auth
- ExecutionContext passed whole, never cherry-picked

### 4. A2A Protocol

- JSON-RPC 2.0 format
- Transport types match mode
- `.well-known/agent.json` discovery

## Detailed Documentation

For specific aspects of API architecture, see:

- **`FILE_CLASSIFICATION.md`**: How to classify API files
- **`PATTERNS.md`**: API-specific patterns and best practices
- **`ARCHITECTURE.md`**: Module/controller/service architecture details
- **`RUNNERS.md`**: Agent runner patterns
- **`LLM_SERVICE.md`**: LLM service patterns (usage tracking, costing, external API endpoint)
- **`OBSERVABILITY.md`**: Observability patterns (SSE streaming, event sending)
- **`VIOLATIONS.md`**: Common violations and how to fix them

## File Classification

### Controller Files
- **Location**: `apps/api/src/[feature]/[name].controller.ts`
- **Pattern**: `[name].controller.ts`
- **Structure**: `@Controller`, HTTP method decorators, constructor injection
- **Responsibilities**: HTTP request/response handling, validation, delegation to services

### Service Files
- **Location**: `apps/api/src/[feature]/[name].service.ts`
- **Pattern**: `[name].service.ts`
- **Structure**: `@Injectable`, constructor injection, business logic methods
- **Responsibilities**: Business logic, data processing, service coordination

### Module Files
- **Location**: `apps/api/src/[feature]/[name].module.ts`
- **Pattern**: `[name].module.ts`
- **Structure**: `@Module`, imports, controllers, providers, exports
- **Responsibilities**: Dependency injection configuration

### Runner Files
- **Location**: `apps/api/src/agent2agent/services/[type]-agent-runner.service.ts`
- **Pattern**: `[type]-agent-runner.service.ts`
- **Structure**: Extends `BaseAgentRunner`, implements mode handlers
- **Responsibilities**: Agent execution, mode routing

### DTO Files
- **Location**: `apps/api/src/[feature]/dto/[name].dto.ts`
- **Pattern**: `[name].dto.ts`
- **Structure**: Class with validation decorators
- **Responsibilities**: Data transfer object definitions

### Interface Files
- **Location**: `apps/api/src/[feature]/[name].interface.ts` or `interfaces/[name].interface.ts`
- **Pattern**: `[name].interface.ts`
- **Structure**: TypeScript interface definitions
- **Responsibilities**: Type definitions

## Validation Checklist

When validating API code:

- [ ] File is in correct location (controllers/, services/, modules/, etc.)
- [ ] File follows naming convention
- [ ] Module/controller/service architecture is maintained
- [ ] ExecutionContext flows correctly (if applicable)
- [ ] A2A calls use JSON-RPC 2.0 format (if applicable)
- [ ] NestJS decorators used correctly
- [ ] Dependency injection used correctly
- [ ] Runner extends BaseAgentRunner (if applicable)

## Critical Services

### LLM Service

**Purpose**: External API endpoint for LLM calls from LangGraph, N8N, and other external systems.

**Key Features**:
- Automatic usage tracking via `RunMetadataService`
- Automatic cost calculation via `LLMPricingService`
- PII processing and sanitization
- Provider routing and selection
- Observability event emission

**Usage**: External callers call `POST /llm/generate` with ExecutionContext.

### Observability Service

**Purpose**: Real-time monitoring and event streaming for all agent executions.

**Key Features**:
- SSE streaming endpoint (`GET /observability/stream`)
- In-memory event buffer (RxJS Subject)
- Database persistence for historical queries
- Username enrichment from cache/database
- Non-blocking event sending

**Usage**: Services use `ObservabilityWebhookService.sendEvent()` with ExecutionContext.

## Related

- **`execution-context-skill/`**: ExecutionContext flow validation
- **`transport-types-skill/`**: A2A protocol compliance
- **`api-architecture-agent.md`**: Autonomous API specialist

## Notes

- This skill is **progressive** - detailed documentation in supporting files
- Classification happens **before** writing code
- Validation happens **during and after** writing code
- Architecture compliance is **non-negotiable**

