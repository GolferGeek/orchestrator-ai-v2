/**
 * Ambient Agent Orchestrator Service
 *
 * Manages ambient prediction agents that run continuously in the background.
 * Each agent polls data sources at configured intervals and produces recommendations.
 *
 * LIFECYCLE:
 * 1. onModuleInit: Load auto-start agents from database
 * 2. Start polling loop for each agent
 * 3. Poll -> Process -> Store -> Sleep -> Repeat
 * 4. onModuleDestroy: Gracefully stop all agents
 *
 * AGENT STATES:
 * - stopped: Agent is not running
 * - starting: Agent is initializing
 * - running: Agent is actively polling
 * - paused: Agent is paused (state preserved)
 * - stopping: Agent is shutting down
 * - error: Agent encountered an error
 *
 * @module ambient-agent-orchestrator.service
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunnerFactoryService, AgentRecord } from './runner-factory.service';
import {
  AgentStatus,
  AgentLifecycleState,
  RunnerInput,
  RunnerOutput,
  PredictionRunnerConfig,
} from './base/base-prediction.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Internal state for a running agent
 */
interface RunningAgentState {
  agentId: string;
  agentSlug: string;
  orgSlug: string;
  config: PredictionRunnerConfig;
  state: AgentLifecycleState;
  intervalId?: NodeJS.Timeout;
  lastPollAt?: string;
  nextPollAt?: string;
  error?: string;
  stats: {
    pollCount: number;
    recommendationCount: number;
    errorCount: number;
    totalPollDurationMs: number;
  };
}

@Injectable()
export class AmbientAgentOrchestratorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AmbientAgentOrchestratorService.name);
  private runningAgents = new Map<string, RunningAgentState>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly runnerFactory: RunnerFactoryService,
  ) {}

  /**
   * Load and start all auto-start agents on module initialization.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing ambient prediction agents...');

    try {
      // Query agents with auto_start enabled
      const autoStartAgents = await this.loadAutoStartAgents();

      this.logger.log(
        `Found ${autoStartAgents.length} auto-start prediction agents`,
      );

      // Start each agent
      for (const agent of autoStartAgents) {
        try {
          await this.startAgent(agent.id);
        } catch (error) {
          this.logger.error(
            `Failed to start agent ${agent.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(
        `Started ${this.runningAgents.size} ambient prediction agents`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize ambient agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gracefully stop all running agents on module destruction.
   */
  onModuleDestroy(): void {
    this.logger.log('Shutting down ambient prediction agents...');

    const agentIds = Array.from(this.runningAgents.keys());
    for (const agentId of agentIds) {
      try {
        this.stopAgent(agentId);
      } catch (error) {
        this.logger.error(
          `Error stopping agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    this.logger.log('All ambient agents stopped');
  }

  /**
   * Start polling loop for an agent.
   *
   * @param agentId - Agent ID to start
   */
  async startAgent(agentId: string): Promise<void> {
    // Check if already running
    if (this.runningAgents.has(agentId)) {
      const state = this.runningAgents.get(agentId)!;
      if (state.state === 'running') {
        this.logger.warn(`Agent ${agentId} is already running`);
        return;
      }
    }

    try {
      // Load agent from database
      const agent = await this.loadAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Extract runner config
      const runnerConfig = agent.metadata?.runnerConfig;
      if (!runnerConfig) {
        throw new Error(`Agent ${agentId} does not have runnerConfig`);
      }

      // Initialize agent state
      const agentState: RunningAgentState = {
        agentId: agent.id,
        agentSlug: agent.slug,
        orgSlug: agent.org_slug,
        config: runnerConfig,
        state: 'starting',
        stats: {
          pollCount: 0,
          recommendationCount: 0,
          errorCount: 0,
          totalPollDurationMs: 0,
        },
      };

      this.runningAgents.set(agentId, agentState);

      // Start polling loop
      this.startPollLoop(agentState);

      // Update state to running
      agentState.state = 'running';

      this.logger.log(
        `Started agent ${agent.slug} with ${runnerConfig.instruments.length} instruments (poll: ${runnerConfig.pollIntervalMs}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to start agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Update state to error
      const state = this.runningAgents.get(agentId);
      if (state) {
        state.state = 'error';
        state.error = error instanceof Error ? error.message : 'Unknown error';
      }

      throw error;
    }
  }

  /**
   * Stop an agent's polling loop.
   *
   * @param agentId - Agent ID to stop
   */
  stopAgent(agentId: string): void {
    const state = this.runningAgents.get(agentId);
    if (!state) {
      this.logger.warn(`Agent ${agentId} is not running`);
      return;
    }

    try {
      state.state = 'stopping';

      // Clear interval
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }

      // Update state
      state.state = 'stopped';

      this.logger.log(
        `Stopped agent ${state.agentSlug} (${state.stats.pollCount} polls)`,
      );

      // Remove from map
      this.runningAgents.delete(agentId);
    } catch (error) {
      this.logger.error(
        `Error stopping agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Pause an agent without losing state.
   *
   * @param agentId - Agent ID to pause
   */
  pauseAgent(agentId: string): void {
    const state = this.runningAgents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    if (state.state === 'paused') {
      this.logger.warn(`Agent ${agentId} is already paused`);
      return;
    }

    // Clear interval but keep state
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = undefined;
    }

    state.state = 'paused';

    this.logger.log(`Paused agent ${state.agentSlug}`);
  }

  /**
   * Resume a paused agent.
   *
   * @param agentId - Agent ID to resume
   */
  resumeAgent(agentId: string): void {
    const state = this.runningAgents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    if (state.state !== 'paused') {
      throw new Error(`Agent ${agentId} is not paused (state: ${state.state})`);
    }

    // Restart polling loop
    this.startPollLoop(state);
    state.state = 'running';

    this.logger.log(`Resumed agent ${state.agentSlug}`);
  }

  /**
   * Trigger an immediate poll (skip wait interval).
   *
   * @param agentId - Agent ID to poll
   */
  async triggerPollNow(agentId: string): Promise<void> {
    const state = this.runningAgents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    this.logger.log(`Triggering immediate poll for agent ${state.agentSlug}`);

    // Execute poll immediately
    await this.executePoll(state);
  }

  /**
   * Get current status of an agent.
   *
   * @param agentId - Agent ID
   * @returns AgentStatus
   */
  getAgentStatus(agentId: string): AgentStatus {
    const state = this.runningAgents.get(agentId);
    if (!state) {
      return {
        agentId,
        state: 'stopped',
        pollIntervalMs: 0,
        stats: {
          pollCount: 0,
          recommendationCount: 0,
          errorCount: 0,
          avgPollDurationMs: 0,
        },
      };
    }

    return {
      agentId: state.agentId,
      state: state.state,
      lastPollAt: state.lastPollAt,
      nextPollAt: state.nextPollAt,
      pollIntervalMs: state.config.pollIntervalMs,
      error: state.error,
      stats: {
        pollCount: state.stats.pollCount,
        recommendationCount: state.stats.recommendationCount,
        errorCount: state.stats.errorCount,
        avgPollDurationMs:
          state.stats.pollCount > 0
            ? state.stats.totalPollDurationMs / state.stats.pollCount
            : 0,
      },
    };
  }

  /**
   * Get all running agents' statuses.
   */
  getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.runningAgents.keys()).map((agentId) =>
      this.getAgentStatus(agentId),
    );
  }

  /**
   * Start the polling loop for an agent.
   */
  private startPollLoop(state: RunningAgentState): void {
    // Clear existing interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }

    // Execute first poll immediately
    this.executePoll(state).catch((error) => {
      this.logger.error(
        `Initial poll failed for ${state.agentSlug}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

    // Set up recurring poll
    state.intervalId = setInterval(() => {
      this.executePoll(state).catch((error) => {
        this.logger.error(
          `Poll failed for ${state.agentSlug}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
    }, state.config.pollIntervalMs);

    // Calculate next poll time
    state.nextPollAt = new Date(
      Date.now() + state.config.pollIntervalMs,
    ).toISOString();
  }

  /**
   * Execute a single poll cycle for an agent.
   */
  private async executePoll(state: RunningAgentState): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Polling agent ${state.agentSlug}...`);

      // Get runner instance
      const runner = await this.runnerFactory.getRunner({
        id: state.agentId,
        slug: state.agentSlug,
        org_slug: state.orgSlug,
        agent_type: 'prediction',
        metadata: { runnerConfig: state.config },
      });

      // Create runner input
      const input: RunnerInput = {
        agentId: state.agentId,
        agentSlug: state.agentSlug,
        orgSlug: state.orgSlug,
        config: state.config,
        executionContext: {
          taskId: uuidv4(),
          // No userId for ambient agents
        },
      };

      // Execute runner
      const output: RunnerOutput = await runner.execute(input);

      // Update stats
      state.stats.pollCount++;
      state.stats.recommendationCount += output.recommendations.length;
      state.stats.totalPollDurationMs += Date.now() - startTime;
      state.lastPollAt = new Date().toISOString();
      state.nextPollAt = new Date(
        Date.now() + state.config.pollIntervalMs,
      ).toISOString();

      // Clear error if any
      state.error = undefined;

      this.logger.debug(
        `Poll completed for ${state.agentSlug}: ${output.recommendations.length} recommendations (${Date.now() - startTime}ms)`,
      );
    } catch (error) {
      state.stats.errorCount++;
      state.error = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Poll failed for ${state.agentSlug}: ${state.error}`);

      // Don't stop the agent on error - just log and continue
      // The next poll will retry
    }
  }

  /**
   * Load auto-start agents from database.
   */
  private async loadAutoStartAgents(): Promise<AgentRecord[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('agents')
      .select('*')
      .eq('agent_type', 'prediction')
      .eq('is_active', true)
      // Note: auto_start flag may not exist yet - this will be added in Phase 2
      // For now, start all active prediction agents
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load auto-start agents: ${error.message}`);
    }

    return (data || []) as AgentRecord[];
  }

  /**
   * Load a single agent from database.
   */
  private async loadAgent(agentId: string): Promise<AgentRecord | null> {
    const client = this.supabaseService.getServiceClient();

    const result = await client
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to load agent: ${result.error.message}`);
    }

    // Type assertion is safe here as we control the query
    return result.data as AgentRecord;
  }
}
