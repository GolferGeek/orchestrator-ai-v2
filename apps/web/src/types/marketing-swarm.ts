/**
 * Marketing Swarm Types
 *
 * Types for the multi-agent marketing content generation system
 */

// =============================================================================
// Agent Configuration Types
// =============================================================================

export interface AgentConfig {
  agentSlug: string;
  llmConfigId: string;
  llmProvider: string;
  llmModel: string;
  displayName?: string;
}

export interface SwarmConfig {
  writers: AgentConfig[];
  editors: AgentConfig[];
  evaluators: AgentConfig[];
  maxEditCycles: number;
}

// =============================================================================
// Content Types
// =============================================================================

export interface MarketingContentType {
  id: string;
  slug: string;
  name: string;
  description?: string;
  systemPromptTemplate?: string;
  requiredFields?: string[];
  isActive: boolean;
}

// =============================================================================
// Agent Definitions (from database)
// =============================================================================

export type MarketingAgentRole = 'writer' | 'editor' | 'evaluator';

export interface AgentPersonality {
  system_context: string;
  style_guidelines?: string[];
  strengths?: string[];
  weaknesses?: string[];
  review_focus?: string[];
  approval_criteria?: string;
  feedback_style?: string;
  evaluation_criteria?: Record<string, string>;
  scoring_approach?: string;
  score_anchors?: Record<string, string>;
}

export interface MarketingAgent {
  id: string;
  slug: string;
  name: string;
  role: MarketingAgentRole;
  description?: string;
  systemPrompt?: string;
  isActive: boolean;
}

export interface AgentLLMConfig {
  id: string;
  agentId: string;
  llmProvider: string;
  llmModel: string;
  displayName?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault: boolean;
  isActive: boolean;
}

// Marketing agent with embedded LLM configs
export interface MarketingAgentWithConfigs extends MarketingAgent {
  llmConfigs: AgentLLMConfig[];
}

// Swarm configuration response from API
export interface SwarmConfigurationResponse {
  contentTypes: MarketingContentType[];
  writers: MarketingAgentWithConfigs[];
  editors: MarketingAgentWithConfigs[];
  evaluators: MarketingAgentWithConfigs[];
}

// =============================================================================
// Prompt Data (8-question interview)
// =============================================================================

export interface PromptData {
  topic: string;
  audience: string;
  goal: string;
  keyPoints: string[];
  tone: string;
  constraints?: string;
  examples?: string;
  additionalContext?: string;
}

// =============================================================================
// Execution Queue
// =============================================================================

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface QueueItem {
  id: string;
  stepType: 'write' | 'edit' | 'evaluate';
  sequence: number;
  agentSlug: string;
  llmConfigId: string;
  provider: string;
  dependsOn: string[];
  inputOutputId?: string;
  status: QueueItemStatus;
  resultId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// =============================================================================
// Outputs and Evaluations
// =============================================================================

export type OutputStatus = 'draft' | 'editing' | 'approved' | 'final';

export interface SwarmOutput {
  id: string;
  taskId: string;
  writerAgentSlug: string;
  writerLlmConfigId: string;
  editorAgentSlug?: string;
  editorLlmConfigId?: string;
  content: string;
  editCycle: number;
  status: OutputStatus;
  editorFeedback?: string;
  editorApproved?: boolean;
  llmMetadata?: {
    tokensUsed?: number;
    latencyMs?: number;
  };
  createdAt: string;
}

export interface SwarmEvaluation {
  id: string;
  taskId: string;
  outputId: string;
  evaluatorAgentSlug: string;
  evaluatorLlmConfigId: string;
  score: number;
  reasoning: string;
  criteriaScores?: Record<string, number>;
  llmMetadata?: {
    tokensUsed?: number;
    latencyMs?: number;
  };
  createdAt: string;
}

// =============================================================================
// Swarm Task
// =============================================================================

export type SwarmTaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SwarmPhase = 'initializing' | 'writing' | 'editing' | 'evaluating' | 'ranking' | 'completed' | 'failed';

export interface SwarmTask {
  taskId: string;
  organizationSlug: string;
  userId: string;
  conversationId?: string;
  contentTypeSlug: string;
  promptData: PromptData;
  config: SwarmConfig;
  status: SwarmTaskStatus;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  phase?: SwarmPhase;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// =============================================================================
// Ranked Results
// =============================================================================

export interface RankedResult {
  outputId: string;
  averageScore: number;
  weightedScore?: number;
  rank?: number;
}

// =============================================================================
// Request/Response DTOs
// =============================================================================

export interface CreateSwarmTaskRequest {
  contentTypeSlug: string;
  promptData: PromptData;
  config: SwarmConfig;
}

export interface SwarmTaskResponse {
  taskId: string;
  status: SwarmTaskStatus;
  phase?: SwarmPhase;
  outputs: SwarmOutput[];
  evaluations: SwarmEvaluation[];
  rankedResults: RankedResult[];
  error?: string;
  duration?: number;
}

export interface SwarmStatusResponse {
  taskId: string;
  phase: SwarmPhase;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  error?: string;
}

export interface SwarmStateResponse {
  taskId: string;
  phase: SwarmPhase;
  contentTypeSlug: string;
  promptData: PromptData;
  config: SwarmConfig;
  executionQueue: QueueItem[];
  outputs: SwarmOutput[];
  evaluations: SwarmEvaluation[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

// =============================================================================
// SSE Message Types
// =============================================================================

export type SSEMessageType =
  | 'queue_built'
  | 'step_started'
  | 'step_completed'
  | 'edit_cycle_added'
  | 'phase_changed'
  | 'error';

export interface SSEQueueBuiltMessage {
  type: 'queue_built';
  taskId: string;
  totalSteps: number;
  writers: { slug: string; llmConfig: string }[];
  editors: { slug: string; llmConfig: string }[];
  evaluators: { slug: string; llmConfig: string }[];
}

export interface SSEStepStartedMessage {
  type: 'step_started';
  taskId: string;
  stepId: string;
  stepType: 'write' | 'edit' | 'evaluate';
  sequence: number;
  agent: {
    slug: string;
    name: string;
    role: MarketingAgentRole;
  };
  llmConfig: {
    provider: string;
    model: string;
    displayName: string;
  };
  editCycle?: number;
  inputOutputId?: string;
}

export interface SSEStepCompletedMessage {
  type: 'step_completed';
  taskId: string;
  stepId: string;
  stepType: 'write' | 'edit' | 'evaluate';
  agent: { slug: string; name: string };
  llmConfig: { provider: string; model: string };
  result: {
    outputId: string;
    content?: string;
    feedback?: string;
    approved?: boolean;
    score?: number;
    reasoning?: string;
  };
  metadata: {
    tokensUsed: number;
    latencyMs: number;
  };
}

export interface SSEPhaseChangedMessage {
  type: 'phase_changed';
  taskId: string;
  phase: SwarmPhase;
  progress: {
    completedSteps: number;
    totalSteps: number;
    percentage: number;
  };
}

export interface SSEErrorMessage {
  type: 'error';
  taskId: string;
  stepId?: string;
  message: string;
  recoverable: boolean;
}

export type SSEMessage =
  | SSEQueueBuiltMessage
  | SSEStepStartedMessage
  | SSEStepCompletedMessage
  | SSEPhaseChangedMessage
  | SSEErrorMessage;

// =============================================================================
// UI State Types
// =============================================================================

export interface MarketingSwarmUIState {
  currentView: 'config' | 'progress' | 'results';
  selectedOutputId?: string;
  compareOutputIds?: string[];
  showDetailedEvaluations: boolean;
}

export interface AgentCardState {
  agentSlug: string;
  llmConfigId: string;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  outputId?: string;
  score?: number;
}
