import { ExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * Standard response format for all workflow operations.
 *
 * This DTO maintains backward compatibility with existing fields (taskId, conversationId)
 * while adding ExecutionContext for improved context continuity and observability.
 *
 * @property success - Whether the workflow execution succeeded
 * @property taskId - DEPRECATED: Use context.taskId instead. Kept for backward compatibility.
 * @property conversationId - DEPRECATED: Use context.conversationId instead. Kept for backward compatibility.
 * @property data - Workflow-specific output data
 * @property metadata - Optional execution metadata (timing, model info, etc.)
 * @property context - RECOMMENDED: Full ExecutionContext for context continuity across operations
 */
export class WorkflowResponseDto {
  success: boolean;
  taskId: string;
  conversationId: string;
  data: Record<string, unknown>; // Workflow-specific output
  metadata?: {
    executionTime?: number;
    stepsCompleted?: number;
    provider?: string;
    model?: string;
  };

  /**
   * Full ExecutionContext capsule for context continuity.
   *
   * Including ExecutionContext in responses enables:
   * - Context continuity across multi-step workflows
   * - Updated context (e.g., planId, deliverableId) propagation
   * - Complete observability trail
   * - Simplified downstream operations (no field reassembly needed)
   *
   * The frontend can use this to update its executionContextStore,
   * ensuring all subsequent operations have the latest context.
   */
  context?: ExecutionContext;
}
