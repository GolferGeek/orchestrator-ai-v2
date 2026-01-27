// Types for message evaluation system
import type { JsonObject } from '@orchestrator-ai/transport-types';
export type UserRatingScale = 1 | 2 | 3 | 4 | 5;
export interface MessageEvaluation {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}
export interface EvaluationRequest {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}
export interface EvaluationResponse {
  id: string;
  messageId: string;
  userId: string;
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: JsonObject;
  createdAt: string;
  updatedAt: string;
}
export interface AllEvaluationsFilters {
  page?: number;
  limit?: number;
  minRating?: UserRatingScale;
  hasNotes?: boolean;
  agentName?: string;
}
export interface WorkflowSteps {
  completedSteps: number;
  totalSteps: number;
  failedSteps: number;
  progressPercent: number;
  stepDetails?: Array<{
    name: string;
    status: string;
    duration?: number;
    error?: string;
  }>;
}

export interface LLMConstraints {
  activeStateModifiers?: string[];
  responseModifiers?: string[];
  executedCommands?: string[];
  constraintEffectiveness?: {
    modifierCompliance: number;
    constraintImpact: string;
    overallEffectiveness?: number;
  };
}

export interface LLMInfo {
  provider: string;
  model: string;
  responseTimeMs: number;
  cost: number;
  tokenUsage: {
    input: number;
    output: number;
  };
  temperature?: number;
  maxTokens?: number;
}

export interface TaskInfo {
  id: string;
  agentName: string;
  method: string;
  prompt: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  progress?: number;
  response?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  roles: string[];
}

export interface EvaluationInfo {
  userRating: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationTimestamp: string;
  evaluationDetails?: JsonObject;
}

export interface EvaluationWithMessage {
  id: string;
  content: string;
  role: string;
  sessionId: string;
  userId: string;
  timestamp: string;
  order: number;
  // Nested structures for admin views
  task: TaskInfo;
  user: UserInfo;
  evaluation: EvaluationInfo;
  llmInfo: LLMInfo;
  workflowSteps?: WorkflowSteps;
  llmConstraints?: LLMConstraints;
  // Evaluation fields (direct, not nested) - for backwards compatibility
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationTimestamp?: string;
  evaluationDetails?: JsonObject;
  // Metadata for task evaluations
  metadata?: (JsonObject & {
    agentName?: string;
    taskType?: string;
    status?: string;
    taskPrompt?: string;
    taskResponse?: string;
    responseMetadata?: JsonObject;
    llmMetadata?: JsonObject;
    taskMetadata?: JsonObject;
    deliverableType?: string;
    workflowStepsCompleted?: string[];
    userEmail?: string;
  });
  // Optional fields
  providerName?: string;
  modelName?: string;
  responseTimeMs?: number;
  cost?: number;
  provider?: {
    id: string;
    name: string;
    description?: string;
  };
  model?: {
    id: string;
    name: string;
    description?: string;
    providerName: string;
  };
}
export interface AllEvaluationsResponse {
  evaluations: EvaluationWithMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AgentLLMRecommendation {
  providerId?: string;
  providerName: string;
  modelId?: string;
  modelName: string;
  averageRating: number;
  evaluationCount: number;
  lastEvaluatedAt?: string;
}
