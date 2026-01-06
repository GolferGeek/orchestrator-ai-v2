import { LegalDepartmentState } from "../legal-department.state";
import { LLMHttpClientService } from "../../../services/llm-http-client.service";
import { ObservabilityService } from "../../../services/observability.service";

const AGENT_SLUG = "legal-department";

/**
 * Echo Node - M0 Testing Node
 *
 * Purpose: Proves LLM integration works by echoing the user's message
 * through the LLM service with legal department context.
 *
 * This is a simple test node for Phase 3 (M0) that:
 * 1. Receives user message from state
 * 2. Calls LLM service via API's /llm/generate endpoint
 * 3. Returns LLM response
 * 4. Emits observability events
 *
 * Future phases will replace this with:
 * - Document analysis nodes
 * - Legal metadata extraction nodes
 * - Compliance checking nodes
 */
export function createEchoNode(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
) {
  return async function echoNode(
    state: LegalDepartmentState,
  ): Promise<Partial<LegalDepartmentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Processing legal department request (M0 echo mode)",
      { step: "echo", progress: 50 },
    );

    try {
      // M0: Simple echo through LLM with legal context
      const systemMessage = `You are a Legal Department AI assistant.
This is a test message (M0 phase). Please acknowledge the user's message
and confirm that the Legal Department AI system is operational.

In future phases, you will be able to:
- Analyze legal documents
- Extract key terms and clauses
- Assess compliance requirements
- Compare multiple documents
- Flag potential risks

For now, simply acknowledge the user's message in a professional legal assistant tone.`;

      // Call LLM service via API endpoint
      // Pass full ExecutionContext capsule - never cherry-pick fields
      const response = await llmClient.callLLM({
        context: ctx, // Full ExecutionContext
        systemMessage,
        userMessage: state.userMessage,
        callerName: AGENT_SLUG,
        temperature: 0.7,
        maxTokens: 1000,
      });

      await observability.emitProgress(
        ctx,
        ctx.taskId,
        "Legal department response generated",
        { step: "echo_complete", progress: 90 },
      );

      return {
        response: response.text,
        status: "completed",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await observability.emitFailed(
        ctx,
        ctx.taskId,
        `Echo node failed: ${errorMessage}`,
        Date.now() - state.startedAt,
      );

      return {
        error: errorMessage,
        status: "failed",
      };
    }
  };
}
