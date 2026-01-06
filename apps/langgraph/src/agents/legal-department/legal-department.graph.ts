import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  LegalDepartmentStateAnnotation,
  LegalDepartmentState,
} from "./legal-department.state";
import { createEchoNode } from "./nodes/echo.node";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";

const AGENT_SLUG = "legal-department";

/**
 * Create the Legal Department graph
 *
 * Phase 3 (M0) Flow:
 * 1. Start → Initialize workflow
 * 2. Echo → Call LLM service to echo user message (proves integration)
 * 3. Complete → Finalize and emit completion event
 * 4. End
 *
 * Future phases will expand this to:
 * - Document analysis nodes
 * - Legal metadata extraction nodes
 * - Multi-document comparison nodes
 * - Compliance checking nodes
 * - Risk assessment nodes
 */
export function createLegalDepartmentGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Create echo node with dependencies
  const echoNode = createEchoNode(llmClient, observability);

  // Node: Start workflow
  async function startNode(
    state: LegalDepartmentState,
  ): Promise<Partial<LegalDepartmentState>> {
    const ctx = state.executionContext;

    await observability.emitStarted(
      ctx,
      ctx.taskId,
      `Starting Legal Department AI workflow (M0): ${state.userMessage}`,
    );

    return {
      status: "processing",
      startedAt: Date.now(),
      messages: [new HumanMessage(state.userMessage)],
    };
  }

  // Node: Complete workflow
  async function completeNode(
    state: LegalDepartmentState,
  ): Promise<Partial<LegalDepartmentState>> {
    const ctx = state.executionContext;

    // Only emit completion if we haven't failed
    if (state.status !== "failed") {
      await observability.emitCompleted(
        ctx,
        ctx.taskId,
        { response: state.response },
        Date.now() - state.startedAt,
      );

      return {
        status: "completed",
        completedAt: Date.now(),
        messages: [
          ...state.messages,
          new AIMessage(state.response || "No response generated"),
        ],
      };
    }

    return {
      completedAt: Date.now(),
    };
  }

  // Node: Handle errors
  async function handleErrorNode(
    state: LegalDepartmentState,
  ): Promise<Partial<LegalDepartmentState>> {
    const ctx = state.executionContext;

    await observability.emitFailed(
      ctx,
      ctx.taskId,
      state.error || "Unknown error",
      Date.now() - state.startedAt,
    );

    return {
      status: "failed",
      completedAt: Date.now(),
    };
  }

  // Build the graph
  const graph = new StateGraph(LegalDepartmentStateAnnotation)
    .addNode("start", startNode)
    .addNode("echo", echoNode)
    .addNode("complete", completeNode)
    .addNode("handle_error", handleErrorNode)
    // Edges
    .addEdge("__start__", "start")
    .addEdge("start", "echo")
    .addConditionalEdges("echo", (state) => {
      if (state.error || state.status === "failed") {
        return "handle_error";
      }
      return "complete";
    })
    .addEdge("complete", END)
    .addEdge("handle_error", END);

  // Compile with Postgres checkpointer for state persistence
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type LegalDepartmentGraph = ReturnType<
  typeof createLegalDepartmentGraph
>;
