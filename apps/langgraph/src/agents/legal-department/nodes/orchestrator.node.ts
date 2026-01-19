import { LegalDepartmentState } from "../legal-department.state";
import { ObservabilityService } from "../../../services/observability.service";
import { LLMHttpClientService } from "../../../services/llm-http-client.service";

// Import all specialist node creators
import { createContractAgentNode } from "./contract-agent.node";
import { createComplianceAgentNode } from "./compliance-agent.node";
import { createIpAgentNode } from "./ip-agent.node";
import { createPrivacyAgentNode } from "./privacy-agent.node";
import { createEmploymentAgentNode } from "./employment-agent.node";
import { createCorporateAgentNode } from "./corporate-agent.node";
import { createLitigationAgentNode } from "./litigation-agent.node";
import { createRealEstateAgentNode } from "./real-estate-agent.node";

/**
 * Multi-Agent Orchestrator Node - M11
 *
 * Purpose: Invoke multiple specialists sequentially for complex documents.
 *
 * This node:
 * 1. Checks if multi-agent mode is enabled
 * 2. Sequentially invokes each required specialist
 * 3. Collects all outputs in specialistOutputs
 * 4. Returns control to graph for synthesis
 *
 * M11 Demo Approach:
 * - Sequential execution (simpler than parallel for demo)
 * - Each specialist runs independently
 * - Outputs are collected and will be synthesized later
 */
export function createOrchestratorNode(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
) {
  // Create specialist node functions
  const specialists = {
    contract: createContractAgentNode(llmClient, observability),
    compliance: createComplianceAgentNode(llmClient, observability),
    ip: createIpAgentNode(llmClient, observability),
    privacy: createPrivacyAgentNode(llmClient, observability),
    employment: createEmploymentAgentNode(llmClient, observability),
    corporate: createCorporateAgentNode(llmClient, observability),
    litigation: createLitigationAgentNode(llmClient, observability),
    realEstate: createRealEstateAgentNode(llmClient, observability),
  };

  return async function orchestratorNode(
    state: LegalDepartmentState,
  ): Promise<Partial<LegalDepartmentState>> {
    const ctx = state.executionContext;

    // Check if multi-agent mode is enabled
    const multiAgent = state.routingDecision?.multiAgent;
    const specialistsList = state.routingDecision?.specialists || [];

    if (!multiAgent || specialistsList.length === 0) {
      // Single agent mode - should not reach here, but handle gracefully
      return {};
    }

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      `Orchestrator: Invoking ${specialistsList.length} specialists`,
      { step: "orchestrator_start", progress: 55, specialists: specialistsList },
    );

    try {
      // Sequentially invoke each specialist
      let currentState = { ...state };
      const completed: string[] = [];

      for (const specialistName of specialistsList) {
        const specialist = specialists[specialistName as keyof typeof specialists];

        if (!specialist) {
          console.warn(`Specialist ${specialistName} not found, skipping`);
          continue;
        }

        await observability.emitProgress(
          ctx,
          ctx.taskId,
          `Orchestrator: Invoking ${specialistName} specialist`,
          { step: `orchestrator_${specialistName}`, progress: 55 + (completed.length * 30 / specialistsList.length) },
        );

        // Invoke specialist
        const result = await specialist(currentState);

        // Check for errors
        if (result.error || result.status === "failed") {
          // Log error but continue with other specialists
          console.error(`Specialist ${specialistName} failed:`, result.error);
          await observability.emitProgress(
            ctx,
            ctx.taskId,
            `Orchestrator: ${specialistName} specialist failed, continuing`,
            { step: `orchestrator_${specialistName}_failed`, error: result.error },
          );
          continue;
        }

        // Update state with specialist output
        currentState = {
          ...currentState,
          ...result,
          specialistOutputs: {
            ...currentState.specialistOutputs,
            ...result.specialistOutputs,
          },
        };

        completed.push(specialistName);
      }

      await observability.emitProgress(
        ctx,
        ctx.taskId,
        `Orchestrator: All specialists completed (${completed.length}/${specialistsList.length})`,
        { step: "orchestrator_complete", progress: 85, completed },
      );

      // Return updated state with all specialist outputs
      return {
        specialistOutputs: currentState.specialistOutputs,
        orchestration: {
          specialists: specialistsList,
          completed,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await observability.emitFailed(
        ctx,
        ctx.taskId,
        `Orchestrator failed: ${errorMessage}`,
        Date.now() - state.startedAt,
      );

      return {
        error: `Orchestrator: ${errorMessage}`,
        status: "failed",
      };
    }
  };
}
