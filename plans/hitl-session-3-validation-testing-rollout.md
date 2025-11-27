# HITL Refactoring Session 3: Validation, Error Handling, Testing & Rollout

## Goal
Add production-ready validation, error handling, comprehensive testing, and migration strategy.

## Prerequisites
- Session 1 completed (foundation)
- Session 2 completed (factory and refactor)
- Extended Post Writer working with new factory

---

## Overview

This session covers:
1. Request validation with class-validator DTOs (NestJS pattern)
2. Authorization checks
3. Error handling and error codes
4. Response format standardization
5. Comprehensive test cases
6. Migration and rollout strategy

---

## Task 1: Request Validation

### 1.1 Create Validation DTOs

Uses class-validator and class-transformer (NestJS pattern) for validation.

**File**: `apps/api/src/agent2agent/dto/hitl-payload.dto.ts`

```typescript
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * HITL Decision enum
 */
export enum HitlDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  REGENERATE = 'regenerate',
  REPLACE = 'replace',
  SKIP = 'skip',
}

/**
 * Generated content DTO (flexible for different agent types)
 */
export class HitlGeneratedContentDto {
  @IsOptional()
  @IsString()
  blogPost?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  socialPosts?: string[];

  // Additional fields can be added by extending this class
  // or using @Allow() for pass-through fields
}

/**
 * HITL Resume payload DTO
 */
export class HitlResumePayloadDto {
  @IsString()
  @IsNotEmpty({ message: 'action is required' })
  action: 'resume';

  @IsString()
  @IsNotEmpty({ message: 'threadId is required' })
  threadId: string;

  @IsEnum(HitlDecision, { message: 'Invalid decision value' })
  decision: HitlDecision;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => HitlGeneratedContentDto)
  content?: HitlGeneratedContentDto;

  // Custom validation: REGENERATE requires feedback
  @ValidateIf(o => o.decision === HitlDecision.REGENERATE)
  @IsNotEmpty({ message: 'Feedback is required for regenerate decision' })
  get feedbackForRegenerate(): string | undefined {
    return this.feedback;
  }

  // Custom validation: REPLACE requires content
  @ValidateIf(o => o.decision === HitlDecision.REPLACE)
  @IsNotEmpty({ message: 'Content is required for replace decision' })
  get contentForReplace(): HitlGeneratedContentDto | undefined {
    return this.content;
  }
}

/**
 * HITL Status payload DTO
 */
export class HitlStatusPayloadDto {
  @IsString()
  @IsNotEmpty({ message: 'action is required' })
  action: 'status';

  @IsString()
  @IsNotEmpty({ message: 'threadId is required' })
  threadId: string;
}

/**
 * HITL History payload DTO
 */
export class HitlHistoryPayloadDto {
  @IsString()
  @IsNotEmpty({ message: 'action is required' })
  action: 'history';

  @IsString()
  @IsNotEmpty({ message: 'threadId is required' })
  threadId: string;

  @IsOptional()
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 10;
}
```

### 1.2 Create Validation Service

**File**: `apps/api/src/agent2agent/services/hitl-validation.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  HitlResumePayloadDto,
  HitlStatusPayloadDto,
  HitlHistoryPayloadDto,
  HitlDecision,
  HitlGeneratedContentDto,
} from '../dto/hitl-payload.dto';

export interface ValidationResult<T> {
  valid: boolean;
  error?: string;
  data?: T;
}

@Injectable()
export class HitlValidationService {
  private readonly logger = new Logger(HitlValidationService.name);

  /**
   * Format validation errors into a readable string
   */
  private formatErrors(errors: ValidationError[]): string {
    return errors
      .map(error => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Invalid value';
        return `${error.property}: ${constraints}`;
      })
      .join('; ');
  }

  /**
   * Validate resume payload with decision-specific rules
   */
  async validateResumePayload(payload: unknown): Promise<ValidationResult<HitlResumePayloadDto>> {
    // Transform plain object to DTO instance
    const dto = plainToInstance(HitlResumePayloadDto, payload);

    // Run class-validator
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false, // Allow pass-through fields in content
    });

    if (errors.length > 0) {
      return {
        valid: false,
        error: this.formatErrors(errors),
      };
    }

    // Additional decision-specific validation
    const additionalError = this.validateDecisionSpecificRules(dto);
    if (additionalError) {
      return {
        valid: false,
        error: additionalError,
      };
    }

    return { valid: true, data: dto };
  }

  /**
   * Decision-specific validation rules that can't be expressed with decorators
   */
  private validateDecisionSpecificRules(dto: HitlResumePayloadDto): string | null {
    switch (dto.decision) {
      case HitlDecision.REGENERATE:
        if (!dto.feedback?.trim()) {
          return 'Feedback is required for regenerate decision';
        }
        break;

      case HitlDecision.REPLACE:
        if (!dto.content) {
          return 'Content is required for replace decision';
        }
        // Validate content has at least one non-empty field
        const hasContent = Object.entries(dto.content).some(([key, value]) => {
          if (key.startsWith('_')) return false; // Skip internal fields
          if (value === undefined || value === null || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        });
        if (!hasContent) {
          return 'Content must have at least one non-empty field';
        }
        break;

      case HitlDecision.APPROVE:
      case HitlDecision.REJECT:
      case HitlDecision.SKIP:
        // No additional validation needed
        break;
    }

    return null;
  }

  /**
   * Validate status payload
   */
  async validateStatusPayload(payload: unknown): Promise<ValidationResult<HitlStatusPayloadDto>> {
    const dto = plainToInstance(HitlStatusPayloadDto, payload);
    const errors = await validate(dto, { whitelist: true });

    if (errors.length > 0) {
      return {
        valid: false,
        error: this.formatErrors(errors),
      };
    }

    return { valid: true, data: dto };
  }

  /**
   * Validate history payload
   */
  async validateHistoryPayload(payload: unknown): Promise<ValidationResult<HitlHistoryPayloadDto>> {
    const dto = plainToInstance(HitlHistoryPayloadDto, payload);
    const errors = await validate(dto, { whitelist: true });

    if (errors.length > 0) {
      return {
        valid: false,
        error: this.formatErrors(errors),
      };
    }

    return { valid: true, data: dto };
  }
}
```

---

## Task 2: Authorization

### 2.1 Create Authorization Service

**File**: `apps/api/src/agent2agent/services/hitl-authorization.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { WorkflowVersionsService } from './workflow-versions.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';

export interface AuthorizationResult {
  authorized: boolean;
  error?: string;
}

@Injectable()
export class HitlAuthorizationService {
  private readonly logger = new Logger(HitlAuthorizationService.name);

  constructor(
    private readonly versionsService: WorkflowVersionsService,
    private readonly conversationsService: Agent2AgentConversationsService,
  ) {}

  /**
   * Authorize an HITL request
   *
   * Checks:
   * 1. User is authenticated
   * 2. User belongs to the organization
   * 3. User has access to the conversation/thread
   */
  async authorizeHitlRequest(
    userId: string | undefined,
    threadId: string,
    organizationSlug: string,
  ): Promise<AuthorizationResult> {
    // 1. Verify user is authenticated
    if (!userId) {
      return {
        authorized: false,
        error: 'Authentication required',
      };
    }

    // 2. Check if thread exists and get associated conversation
    const currentVersion = await this.versionsService.getCurrentVersion(threadId);

    // If thread has no versions yet, it might be a new thread
    // Allow if user is authenticated (thread will be created)
    if (!currentVersion) {
      this.logger.debug(`No versions for thread ${threadId}, allowing new thread creation`);
      return { authorized: true };
    }

    // 3. Verify user has access to the conversation
    if (currentVersion.conversationId) {
      const canAccess = await this.conversationsService.canUserAccess(
        userId,
        currentVersion.conversationId,
        organizationSlug,
      );

      if (!canAccess) {
        return {
          authorized: false,
          error: 'Not authorized for this thread',
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Check if user can access a specific version
   */
  async canAccessVersion(
    userId: string,
    threadId: string,
    versionNumber: number,
    organizationSlug: string,
  ): Promise<boolean> {
    const version = await this.versionsService.getVersionByNumber(threadId, versionNumber);
    if (!version) return false;

    if (!version.conversationId) return true;

    return this.conversationsService.canUserAccess(
      userId,
      version.conversationId,
      organizationSlug,
    );
  }
}
```

---

## Task 3: Error Handling

### 3.1 Create Error Types

**File**: `apps/api/src/agent2agent/errors/hitl.errors.ts`

```typescript
/**
 * HITL Error Codes
 */
export enum HitlErrorCode {
  // Validation errors (4xx)
  VALIDATION_ERROR = 'HITL_VALIDATION_ERROR',
  INVALID_DECISION = 'HITL_INVALID_DECISION',
  MISSING_FEEDBACK = 'HITL_MISSING_FEEDBACK',
  MISSING_CONTENT = 'HITL_MISSING_CONTENT',
  INVALID_CONTENT = 'HITL_INVALID_CONTENT',

  // Authorization errors (4xx)
  AUTHORIZATION_ERROR = 'HITL_AUTHORIZATION_ERROR',
  NOT_AUTHENTICATED = 'HITL_NOT_AUTHENTICATED',
  NOT_AUTHORIZED = 'HITL_NOT_AUTHORIZED',

  // Not found errors (4xx)
  THREAD_NOT_FOUND = 'HITL_THREAD_NOT_FOUND',
  VERSION_NOT_FOUND = 'HITL_VERSION_NOT_FOUND',
  AGENT_NOT_FOUND = 'HITL_AGENT_NOT_FOUND',

  // Conflict errors (4xx)
  VERSION_CONFLICT = 'HITL_VERSION_CONFLICT',
  WORKFLOW_NOT_PAUSED = 'HITL_WORKFLOW_NOT_PAUSED',
  DUPLICATE_RESUME = 'HITL_DUPLICATE_RESUME',

  // LangGraph errors (5xx)
  LANGGRAPH_ERROR = 'HITL_LANGGRAPH_ERROR',
  LANGGRAPH_TIMEOUT = 'HITL_LANGGRAPH_TIMEOUT',
  LANGGRAPH_UNAVAILABLE = 'HITL_LANGGRAPH_UNAVAILABLE',

  // Internal errors (5xx)
  INTERNAL_ERROR = 'HITL_INTERNAL_ERROR',
  DATABASE_ERROR = 'HITL_DATABASE_ERROR',
}

/**
 * Base HITL Error class
 */
export class HitlError extends Error {
  constructor(
    public readonly code: HitlErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HitlError';
  }
}

/**
 * Validation Error
 */
export class HitlValidationError extends HitlError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HitlErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'HitlValidationError';
  }
}

/**
 * Authorization Error
 */
export class HitlAuthorizationError extends HitlError {
  constructor(message: string) {
    super(HitlErrorCode.AUTHORIZATION_ERROR, message);
    this.name = 'HitlAuthorizationError';
  }
}

/**
 * Not Found Error
 */
export class HitlNotFoundError extends HitlError {
  constructor(code: HitlErrorCode, message: string) {
    super(code, message);
    this.name = 'HitlNotFoundError';
  }
}

/**
 * LangGraph Error
 */
export class HitlLangGraphError extends HitlError {
  constructor(
    code: HitlErrorCode.LANGGRAPH_ERROR | HitlErrorCode.LANGGRAPH_TIMEOUT | HitlErrorCode.LANGGRAPH_UNAVAILABLE,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = 'HitlLangGraphError';
  }
}

/**
 * Map error to HTTP status code
 */
export function getHttpStatusForError(error: HitlError): number {
  switch (error.code) {
    // 400 Bad Request
    case HitlErrorCode.VALIDATION_ERROR:
    case HitlErrorCode.INVALID_DECISION:
    case HitlErrorCode.MISSING_FEEDBACK:
    case HitlErrorCode.MISSING_CONTENT:
    case HitlErrorCode.INVALID_CONTENT:
      return 400;

    // 401 Unauthorized
    case HitlErrorCode.NOT_AUTHENTICATED:
      return 401;

    // 403 Forbidden
    case HitlErrorCode.AUTHORIZATION_ERROR:
    case HitlErrorCode.NOT_AUTHORIZED:
      return 403;

    // 404 Not Found
    case HitlErrorCode.THREAD_NOT_FOUND:
    case HitlErrorCode.VERSION_NOT_FOUND:
    case HitlErrorCode.AGENT_NOT_FOUND:
      return 404;

    // 409 Conflict
    case HitlErrorCode.VERSION_CONFLICT:
    case HitlErrorCode.WORKFLOW_NOT_PAUSED:
    case HitlErrorCode.DUPLICATE_RESUME:
      return 409;

    // 503 Service Unavailable
    case HitlErrorCode.LANGGRAPH_UNAVAILABLE:
      return 503;

    // 504 Gateway Timeout
    case HitlErrorCode.LANGGRAPH_TIMEOUT:
      return 504;

    // 500 Internal Server Error
    default:
      return 500;
  }
}
```

### 3.2 Create Error Handler

**File**: `apps/api/src/agent2agent/services/base-agent-runner/hitl-error-handler.ts`

```typescript
import { Logger } from '@nestjs/common';
import { TaskResponseDto, AgentTaskMode } from '../../dto/task-response.dto';
import {
  HitlError,
  HitlErrorCode,
  HitlValidationError,
  HitlAuthorizationError,
  HitlNotFoundError,
  HitlLangGraphError,
} from '../../errors/hitl.errors';

const logger = new Logger('HitlErrorHandler');

/**
 * Convert any error to a TaskResponseDto
 */
export function handleHitlError(error: unknown, context: string): TaskResponseDto {
  logger.error(`[HITL] Error in ${context}:`, error);

  // Known HITL errors
  if (error instanceof HitlError) {
    return TaskResponseDto.failure(AgentTaskMode.HITL, error.message, {
      code: error.code,
      details: error.details,
    });
  }

  // Axios/HTTP errors from LangGraph calls
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 404) {
      return TaskResponseDto.failure(AgentTaskMode.HITL, 'Thread not found', {
        code: HitlErrorCode.THREAD_NOT_FOUND,
      });
    }

    if (status === 503 || status === 502) {
      return TaskResponseDto.failure(AgentTaskMode.HITL, 'LangGraph service unavailable', {
        code: HitlErrorCode.LANGGRAPH_UNAVAILABLE,
      });
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return TaskResponseDto.failure(AgentTaskMode.HITL, 'LangGraph request timed out', {
        code: HitlErrorCode.LANGGRAPH_TIMEOUT,
      });
    }

    return TaskResponseDto.failure(AgentTaskMode.HITL, `LangGraph error: ${message}`, {
      code: HitlErrorCode.LANGGRAPH_ERROR,
    });
  }

  // Database errors
  if (isDatabaseError(error)) {
    return TaskResponseDto.failure(AgentTaskMode.HITL, 'Database error occurred', {
      code: HitlErrorCode.DATABASE_ERROR,
    });
  }

  // Unknown errors - don't expose internals
  return TaskResponseDto.failure(AgentTaskMode.HITL, 'An unexpected error occurred', {
    code: HitlErrorCode.INTERNAL_ERROR,
  });
}

/**
 * Type guard for Axios errors
 */
function isAxiosError(error: unknown): error is {
  isAxiosError: true;
  response?: { status: number; data?: { message?: string } };
  message: string;
  code?: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: unknown }).isAxiosError === true
  );
}

/**
 * Type guard for database errors
 */
function isDatabaseError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return typeof code === 'string' && code.startsWith('PGRST');
}
```

---

## Task 4: Response Format Standardization

### 4.1 Update TaskResponseDto

**File**: `apps/api/src/agent2agent/dto/task-response.dto.ts` (add methods)

```typescript
// Add these static factory methods to TaskResponseDto class

/**
 * Create HITL waiting response (workflow paused for review)
 */
static hitlWaiting(payload: HitlPendingPayload, metadata?: Record<string, unknown>): TaskResponseDto {
  return new TaskResponseDto({
    mode: AgentTaskMode.HITL,
    success: true,
    hitlPending: true,
    payload: {
      content: payload,
    },
    metadata,
  });
}

/**
 * Create HITL completed response (workflow finished after approval)
 */
static hitlCompleted(payload: HitlCompletedPayload, metadata?: Record<string, unknown>): TaskResponseDto {
  return new TaskResponseDto({
    mode: AgentTaskMode.HITL,
    success: true,
    hitlPending: false,
    payload: {
      content: payload,
    },
    humanResponse: {
      message: 'Content approved and workflow completed',
    },
    metadata,
  });
}

/**
 * Create HITL rejected response
 */
static hitlRejected(payload: HitlRejectedPayload, metadata?: Record<string, unknown>): TaskResponseDto {
  return new TaskResponseDto({
    mode: AgentTaskMode.HITL,
    success: true,
    hitlPending: false,
    payload: {
      content: payload,
    },
    humanResponse: {
      message: payload.feedback || 'Content rejected',
    },
    metadata,
  });
}

/**
 * Create HITL error response
 */
static hitlError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): TaskResponseDto {
  return new TaskResponseDto({
    mode: AgentTaskMode.HITL,
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
```

---

## Task 5: Comprehensive Test Cases

### 5.1 Unit Tests for Validation

**File**: `apps/api/src/agent2agent/services/hitl-validation.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HitlValidationService } from './hitl-validation.service';
import { HitlDecision } from '../dto/hitl-payload.dto';

describe('HitlValidationService', () => {
  let service: HitlValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HitlValidationService],
    }).compile();

    service = module.get<HitlValidationService>(HitlValidationService);
  });

  describe('validateResumePayload', () => {
    it('should accept valid approve decision', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'approve',
      });
      expect(result.valid).toBe(true);
      expect(result.data?.decision).toBe(HitlDecision.APPROVE);
    });

    it('should require threadId', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: '',
        decision: 'approve',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('threadId');
    });

    it('should reject invalid decision', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('decision');
    });

    it('should require feedback for regenerate', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'regenerate',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Feedback');
    });

    it('should accept regenerate with feedback', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'regenerate',
        feedback: 'Make it shorter',
      });
      expect(result.valid).toBe(true);
      expect(result.data?.decision).toBe(HitlDecision.REGENERATE);
    });

    it('should require content for replace', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'replace',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Content');
    });

    it('should accept replace with content', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'replace',
        content: {
          blogPost: 'My edited content',
        },
      });
      expect(result.valid).toBe(true);
      expect(result.data?.decision).toBe(HitlDecision.REPLACE);
    });

    it('should reject replace with empty content', async () => {
      const result = await service.validateResumePayload({
        action: 'resume',
        threadId: 'thread-123',
        decision: 'replace',
        content: {},
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty');
    });

    it('should accept all valid decision types', async () => {
      const decisions = ['approve', 'reject', 'skip'];
      for (const decision of decisions) {
        const result = await service.validateResumePayload({
          action: 'resume',
          threadId: 'thread-123',
          decision,
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateStatusPayload', () => {
    it('should accept valid status request', async () => {
      const result = await service.validateStatusPayload({
        action: 'status',
        threadId: 'thread-123',
      });
      expect(result.valid).toBe(true);
    });

    it('should require threadId', async () => {
      const result = await service.validateStatusPayload({
        action: 'status',
        threadId: '',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('threadId');
    });
  });

  describe('validateHistoryPayload', () => {
    it('should accept valid history request', async () => {
      const result = await service.validateHistoryPayload({
        action: 'history',
        threadId: 'thread-123',
      });
      expect(result.valid).toBe(true);
    });

    it('should default limit to 10', async () => {
      const result = await service.validateHistoryPayload({
        action: 'history',
        threadId: 'thread-123',
      });
      expect(result.valid).toBe(true);
      expect(result.data?.limit).toBe(10);
    });

    it('should accept custom limit within range', async () => {
      const result = await service.validateHistoryPayload({
        action: 'history',
        threadId: 'thread-123',
        limit: 50,
      });
      expect(result.valid).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it('should reject limit over 100', async () => {
      const result = await service.validateHistoryPayload({
        action: 'history',
        threadId: 'thread-123',
        limit: 150,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('100');
    });

    it('should reject limit below 1', async () => {
      const result = await service.validateHistoryPayload({
        action: 'history',
        threadId: 'thread-123',
        limit: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1');
    });
  });
});
```

### 5.2 Integration Tests for Workflow

**File**: `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.e2e.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExtendedPostWriterService } from './extended-post-writer.service';
// ... imports

describe('Extended Post Writer E2E', () => {
  let service: ExtendedPostWriterService;

  beforeAll(async () => {
    // Setup test module
  });

  describe('Happy Path', () => {
    it('should generate blog post and pause at HITL', async () => {
      const result = await service.generate({
        taskId: 'test-1',
        userId: 'user-1',
        organizationSlug: 'demo',
        userMessage: 'Write about AI',
      });

      expect(result.status).toBe('hitl_waiting');
      expect(result.generatedContent?.blogPost).toBeTruthy();
    });

    it('should complete after APPROVE', async () => {
      // Generate
      const gen = await service.generate({
        taskId: 'test-2',
        userId: 'user-1',
        organizationSlug: 'demo',
        userMessage: 'Write about AI',
      });

      // Resume with approve
      const result = await service.resume(gen.threadId, {
        decision: 'approve',
      });

      expect(result.status).toBe('completed');
      expect(result.finalContent?.seoDescription).toBeTruthy();
      expect(result.finalContent?.socialPosts?.length).toBeGreaterThan(0);
    });

    it('should regenerate after REGENERATE with feedback', async () => {
      // Generate
      const gen = await service.generate({
        taskId: 'test-3',
        userId: 'user-1',
        organizationSlug: 'demo',
        userMessage: 'Write about AI',
      });

      const originalBlogPost = gen.generatedContent?.blogPost;

      // Resume with regenerate
      const result = await service.resume(gen.threadId, {
        decision: 'regenerate',
        feedback: 'Make it shorter and more casual',
      });

      // Should be waiting again with new content
      expect(result.status).toBe('hitl_waiting');
      expect(result.generatedContent?.blogPost).not.toBe(originalBlogPost);
    });

    it('should use edited content after REPLACE', async () => {
      // Generate
      const gen = await service.generate({
        taskId: 'test-4',
        userId: 'user-1',
        organizationSlug: 'demo',
        userMessage: 'Write about AI',
      });

      // Resume with replace
      const result = await service.resume(gen.threadId, {
        decision: 'replace',
        editedContent: {
          blogPost: 'My custom blog post content',
          seoDescription: '',
          socialPosts: [],
        },
      });

      // Should complete with custom content
      expect(result.status).toBe('completed');
      expect(result.finalContent?.blogPost).toBe('My custom blog post content');
    });
  });

  describe('Error Cases', () => {
    it('should return error for non-existent thread', async () => {
      await expect(
        service.resume('non-existent-thread', { decision: 'approve' }),
      ).rejects.toThrow();
    });

    it('should handle LLM failure gracefully', async () => {
      // Mock LLM to fail
      // Test that error is captured in state
    });
  });

  describe('Version Tracking', () => {
    it('should create version on initial generation', async () => {
      const gen = await service.generate({
        taskId: 'test-v1',
        userId: 'user-1',
        organizationSlug: 'demo',
        userMessage: 'Write about AI',
      });

      // Check versions in database
      // Should have 1 version with source 'ai_generated'
    });

    it('should create version on regenerate', async () => {
      // Generate → Regenerate → Check versions
      // Should have 2 versions, second with source 'ai_regenerated'
    });

    it('should create version on replace', async () => {
      // Generate → Replace → Check versions
      // Should have 2 versions, second with source 'user_replaced'
    });
  });
});
```

---

## Task 6: Migration & Rollout

### 6.1 Feature Flag

**File**: `apps/api/src/config/feature-flags.ts` (add)

```typescript
export const FEATURE_FLAGS = {
  // HITL v2 with factory pattern and versions
  HITL_V2_ENABLED: process.env.HITL_V2_ENABLED === 'true',

  // Enable version tracking
  HITL_VERSIONS_ENABLED: process.env.HITL_VERSIONS_ENABLED === 'true',
};
```

### 6.2 Migration Handler

Update HITL handlers to check feature flag and route accordingly:

```typescript
async handleHitlResume(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string,
): Promise<TaskResponseDto> {
  // Check if this thread should use v2
  if (FEATURE_FLAGS.HITL_V2_ENABLED) {
    return this.handleHitlResumeV2(definition, request, organizationSlug);
  }

  // Legacy handler
  return this.handleHitlResumeLegacy(definition, request, organizationSlug);
}
```

### 6.3 Rollout Checklist

```markdown
## HITL V2 Rollout Checklist

### Pre-Deployment
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Database migration tested in staging
- [ ] Feature flag set to FALSE in production

### Phase 1: Silent Deploy (Day 1)
- [ ] Deploy all code changes with flag OFF
- [ ] Monitor error rates
- [ ] Verify no regressions in existing HITL

### Phase 2: Internal Testing (Day 2-3)
- [ ] Enable flag for test organization only
- [ ] Run full manual test suite
- [ ] Verify version creation in database
- [ ] Test all 5 decision types

### Phase 3: Limited Rollout (Day 4-7)
- [ ] Enable for 10% of new threads (hash-based)
- [ ] Monitor metrics:
  - [ ] Error rates
  - [ ] Latency (p50, p95, p99)
  - [ ] Version creation success rate
  - [ ] LangGraph call success rate

### Phase 4: Full Rollout (Week 2)
- [ ] Enable for 100% of new threads
- [ ] Continue monitoring
- [ ] Address any issues

### Phase 5: Cleanup (Week 3+)
- [ ] Remove legacy code paths
- [ ] Remove feature flag checks
- [ ] Update documentation
```

---

## Success Criteria

1. [ ] Validation schemas catch all invalid inputs
2. [ ] Authorization prevents unauthorized access
3. [ ] All error codes have appropriate HTTP status
4. [ ] Error messages don't expose internals
5. [ ] All test cases pass
6. [ ] Feature flag controls v2 activation
7. [ ] Rollout checklist completed
8. [ ] All tests pass: `npm run test`
9. [ ] Build passes: `npm run build`

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `apps/api/src/agent2agent/dto/hitl-payload.dto.ts` | class-validator DTOs for HITL payloads |
| `apps/api/src/agent2agent/services/hitl-validation.service.ts` | Validation service using class-validator |
| `apps/api/src/agent2agent/services/hitl-authorization.service.ts` | Authorization checks |
| `apps/api/src/agent2agent/errors/hitl.errors.ts` | Error types and codes |
| `apps/api/src/agent2agent/services/base-agent-runner/hitl-error-handler.ts` | Error handling |
| `apps/api/src/agent2agent/services/hitl-validation.service.spec.ts` | Validation service tests |
| `apps/langgraph/src/agents/extended-post-writer/extended-post-writer.e2e.spec.ts` | E2E tests |
| `apps/api/src/config/feature-flags.ts` | Feature flag config |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/src/agent2agent/dto/task-response.dto.ts` | Add HITL factory methods |
| `apps/api/src/agent2agent/services/base-agent-runner/hitl.handlers.ts` | Add validation, auth, error handling |

---

## Post-Implementation

After all three sessions are complete:
1. Update frontend HITL panel to use version selector
2. Add monitoring dashboards for HITL metrics
3. Document the pattern for creating new HITL agents
4. Consider adding streaming support (future enhancement)
