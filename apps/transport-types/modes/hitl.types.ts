/**
 * HITL (Human-in-the-Loop) Mode Types
 * Defines mode-specific payloads and metadata for HITL operations
 *
 * HITL flow:
 * 1. Agent task returns with status 'hitl_waiting' and generated content
 * 2. Frontend displays content for human review
 * 3. Human makes decision (approve/edit/reject)
 * 4. Frontend sends HITL resume request with decision
 * 5. Agent completes or handles rejection
 */

// ============================================================================
// HITL STATUS
// ============================================================================

/**
 * HITL Status values
 */
export type HitlStatus =
  | 'started'
  | 'generating'
  | 'hitl_waiting'
  | 'completed'
  | 'rejected'
  | 'failed';

/**
 * HITL Decision types
 */
export type HitlDecision = 'approve' | 'edit' | 'reject';

// ============================================================================
// HITL ACTIONS
// ============================================================================

/**
 * HITL Actions
 */
export type HitlAction =
  | 'resume'      // Resume from HITL with decision
  | 'status'      // Get current HITL status
  | 'history';    // Get HITL state history

// ============================================================================
// GENERATED CONTENT (Response from Agent)
// ============================================================================

/**
 * Generated content structure for Extended Post Writer
 * This is what the agent produces and sends back for review
 */
export interface HitlGeneratedContent {
  /** Blog post content */
  blogPost?: string;
  /** SEO meta description */
  seoDescription?: string;
  /** Social media posts (array or newline-separated string) */
  socialPosts?: string[] | string;
}

/**
 * HITL Content wrapper - can be extended for different agent types
 */
export interface HitlContent {
  /** Content type identifier (e.g., 'extended-post-writer', 'data-analyst') */
  contentType: string;
  /** The generated content (structure varies by contentType) */
  content: HitlGeneratedContent | Record<string, unknown>;
}

// ============================================================================
// HITL RESPONSE (API → Web)
// ============================================================================

/**
 * HITL Status Response Payload
 * Returned when a task enters hitl_waiting status or when status is queried
 */
export interface HitlStatusResponsePayload {
  /** Thread/execution ID for resuming */
  threadId: string;
  /** Current HITL status */
  status: HitlStatus;
  /** Topic/subject of the content */
  topic: string;
  /** Whether HITL is pending review */
  hitlPending: boolean;
  /** Generated content awaiting review (present when status is hitl_waiting) */
  generatedContent?: HitlGeneratedContent;
  /** Final approved/edited content (present when status is completed) */
  finalContent?: HitlGeneratedContent;
  /** Error message if status is failed */
  error?: string;
  /** Duration in ms (present when completed) */
  duration?: number;
}

/**
 * HITL Response Metadata
 */
export interface HitlResponseMetadata {
  /** Agent type that produced the content */
  agentType: string;
  /** Agent slug */
  agentSlug: string;
  /** LLM provider used for generation */
  provider?: string;
  /** LLM model used for generation */
  model?: string;
  /** Token usage for generation */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost?: number;
  };
  /** Timestamp when HITL was triggered */
  hitlTriggeredAt?: string;
  /** Timestamp when decision was made */
  decisionAt?: string;
}

// ============================================================================
// HITL REQUEST (Web → API)
// ============================================================================

/**
 * HITL Resume Action Payload
 * Sent when user makes a decision on HITL content
 */
export interface HitlResumePayload {
  action: 'resume';
  /** Thread ID to resume */
  threadId: string;
  /** User's decision */
  decision: HitlDecision;
  /** Edited content (required if decision is 'edit') */
  editedContent?: Partial<HitlGeneratedContent>;
  /** Optional feedback from user */
  feedback?: string;
}

/**
 * HITL Status Action Payload
 * Request current HITL status for a thread
 */
export interface HitlStatusPayload {
  action: 'status';
  /** Thread ID to check */
  threadId: string;
}

/**
 * HITL History Action Payload
 * Request HITL state history for a thread
 */
export interface HitlHistoryPayload {
  action: 'history';
  /** Thread ID to get history for */
  threadId: string;
}

/**
 * HITL Mode Payload (union of all HITL actions)
 */
export type HitlModePayload =
  | HitlResumePayload
  | HitlStatusPayload
  | HitlHistoryPayload;

/**
 * HITL Request Metadata
 */
export interface HitlRequestMetadata {
  /** Source of the request (e.g., 'web-ui', 'api') */
  source: string;
  /** User ID making the decision */
  userId: string;
  /** Conversation ID */
  conversationId: string;
  /** Organization slug */
  organizationSlug?: string;
  /** Original task ID that triggered HITL */
  originalTaskId?: string;
}

// ============================================================================
// HITL RESPONSE CONTENT
// ============================================================================

/**
 * HITL Resume Response Content
 * Returned after processing a resume decision
 */
export interface HitlResumeResponseContent {
  /** Thread ID */
  threadId: string;
  /** Final status after resume */
  status: HitlStatus;
  /** Topic of the content */
  topic: string;
  /** Original generated content */
  generatedContent?: HitlGeneratedContent;
  /** Final content (may be edited) */
  finalContent?: HitlGeneratedContent;
  /** The decision that was made */
  decision: HitlDecision;
  /** Duration from start to completion */
  duration?: number;
  /** Error if something went wrong */
  error?: string;
}

/**
 * HITL Status Response Content
 * Returned from status check
 */
export interface HitlStatusResponseContent {
  /** Thread ID */
  threadId: string;
  /** Current status */
  status: HitlStatus;
  /** Topic of the content */
  topic: string;
  /** Whether HITL is pending */
  hitlPending: boolean;
  /** Generated content (if available) */
  generatedContent?: HitlGeneratedContent;
  /** Final content (if completed) */
  finalContent?: HitlGeneratedContent;
  /** Error message (if failed) */
  error?: string;
}

/**
 * HITL History Entry
 */
export interface HitlHistoryEntry {
  /** Thread ID */
  threadId: string;
  /** Status at this point in history */
  status: HitlStatus;
  /** Topic */
  topic: string;
  /** Generated content at this point */
  generatedContent?: HitlGeneratedContent;
  /** Final content at this point */
  finalContent?: HitlGeneratedContent;
  /** Timestamp */
  timestamp: string;
}

/**
 * HITL History Response Content
 */
export interface HitlHistoryResponseContent {
  /** Thread ID */
  threadId: string;
  /** Array of history entries */
  entries: HitlHistoryEntry[];
  /** Total count */
  count: number;
}
