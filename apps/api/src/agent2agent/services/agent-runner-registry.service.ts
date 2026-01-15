import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { IAgentRunner } from '../interfaces/agent-runner.interface';
import { ContextAgentRunnerService } from './context-agent-runner.service';
import { ApiAgentRunnerService } from './api-agent-runner.service';
import { ExternalAgentRunnerService } from './external-agent-runner.service';
import { OrchestratorAgentRunnerService } from './orchestrator-agent-runner.service';
import { RagAgentRunnerService } from './rag-agent-runner.service';
import { MediaAgentRunnerService } from './media-agent-runner.service';
import { PredictionAgentRunnerService } from './prediction-agent-runner.service';
import { RiskAgentRunnerService } from './risk-agent-runner.service';

/**
 * Registry service for agent runners.
 *
 * Maps agent types to their corresponding runner implementations.
 * This allows the router to dynamically select the appropriate runner
 * based on the agent's type.
 *
 * @example
 * ```typescript
 * const runner = this.registry.getRunner('context');
 * const result = await runner.execute(definition, request, organizationSlug);
 * ```
 */
@Injectable()
export class AgentRunnerRegistryService {
  private readonly logger = new Logger(AgentRunnerRegistryService.name);
  private readonly runners: Map<string, IAgentRunner>;

  constructor(
    @Inject(forwardRef(() => ContextAgentRunnerService))
    private readonly contextAgentRunner: ContextAgentRunnerService,
    @Inject(forwardRef(() => ApiAgentRunnerService))
    private readonly apiAgentRunner: ApiAgentRunnerService,
    @Inject(forwardRef(() => ExternalAgentRunnerService))
    private readonly externalAgentRunner: ExternalAgentRunnerService,
    @Inject(forwardRef(() => OrchestratorAgentRunnerService))
    private readonly orchestratorAgentRunner: OrchestratorAgentRunnerService,
    @Inject(forwardRef(() => RagAgentRunnerService))
    private readonly ragAgentRunner: RagAgentRunnerService,
    @Inject(forwardRef(() => MediaAgentRunnerService))
    private readonly mediaAgentRunner: MediaAgentRunnerService,
    @Inject(forwardRef(() => PredictionAgentRunnerService))
    private readonly predictionAgentRunner: PredictionAgentRunnerService,
    @Inject(forwardRef(() => RiskAgentRunnerService))
    private readonly riskAgentRunner: RiskAgentRunnerService,
  ) {
    this.runners = new Map();

    // Register runners
    this.registerRunner('context', this.contextAgentRunner);
    this.registerRunner('api', this.apiAgentRunner);
    this.registerRunner('external', this.externalAgentRunner);
    this.registerRunner('orchestrator', this.orchestratorAgentRunner);
    this.registerRunner('rag-runner', this.ragAgentRunner);
    this.registerRunner('media', this.mediaAgentRunner);
    this.registerRunner('prediction', this.predictionAgentRunner);
    this.registerRunner('risk', this.riskAgentRunner);
  }

  /**
   * Register a runner for a specific agent type.
   *
   * @param agentType - The agent type (e.g., 'context', 'tool', 'api')
   * @param runner - The runner instance
   */
  registerRunner(agentType: string, runner: IAgentRunner): void {
    if (this.runners.has(agentType)) {
      this.logger.warn(
        `Runner for agent type '${agentType}' is being overwritten`,
      );
    }

    this.runners.set(agentType, runner);
  }

  /**
   * Get the runner for a specific agent type.
   *
   * @param agentType - The agent type
   * @returns The runner instance, or null if not found
   */
  getRunner(agentType: string): IAgentRunner | null {
    const runner = this.runners.get(agentType);

    if (!runner) {
      this.logger.warn(`No runner found for agent type: ${agentType}`);
      return null;
    }

    return runner;
  }

  /**
   * Check if a runner is registered for an agent type.
   *
   * @param agentType - The agent type
   * @returns True if a runner is registered
   */
  hasRunner(agentType: string): boolean {
    return this.runners.has(agentType);
  }

  /**
   * Get all registered agent types.
   *
   * @returns Array of agent type strings
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.runners.keys());
  }

  /**
   * Get the count of registered runners.
   *
   * @returns Number of registered runners
   */
  getRunnerCount(): number {
    return this.runners.size;
  }
}
