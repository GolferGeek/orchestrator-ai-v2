/**
 * Runner Factory Service
 *
 * Creates prediction runner instances based on agent configuration.
 * Uses RUNNER_REGISTRY to map runner types to implementations.
 *
 * USAGE:
 * 1. Agent is loaded from database with metadata.runnerConfig
 * 2. Factory extracts runner type from config
 * 3. Factory instantiates the appropriate runner from registry
 * 4. Runner is configured with agent-specific settings
 *
 * @module runner-factory.service
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  RUNNER_REGISTRY,
  IPredictionRunner,
  RunnerRegistryEntry,
} from './runner.registry';
import {
  PredictionRunnerType,
  PredictionRunnerConfig,
} from './base/base-prediction.types';

/**
 * Agent metadata with runner configuration.
 * This is the shape of the metadata column in agents table.
 */
export interface AgentMetadataWithRunner {
  /** Agent description */
  description?: string;

  /** Agent capabilities */
  capabilities?: string[];

  /** Runner configuration for prediction agents */
  runnerConfig?: PredictionRunnerConfig;

  /** Other metadata fields */
  [key: string]: unknown;
}

/**
 * Minimal agent record needed for runner creation
 */
export interface AgentRecord {
  id: string;
  slug: string;
  org_slug: string;
  agent_type: string;
  metadata: AgentMetadataWithRunner | null;
  llm_config?: {
    provider?: string;
    model?: string;
    [key: string]: unknown;
  } | null;
}

/**
 * Factory service for creating prediction runner instances.
 */
@Injectable()
export class RunnerFactoryService {
  private readonly logger = new Logger(RunnerFactoryService.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Get a runner instance for an agent.
   *
   * @param agent - Agent record from database
   * @returns Configured runner instance
   * @throws NotFoundException if runner type not registered or config missing
   */
  async getRunner(agent: AgentRecord): Promise<IPredictionRunner> {
    // Extract runner config from metadata
    const runnerConfig = this.extractRunnerConfig(agent);

    // Look up runner in registry
    const entry = RUNNER_REGISTRY.get(runnerConfig.runner);
    if (!entry) {
      throw new NotFoundException(
        `Runner type '${runnerConfig.runner}' is not registered. ` +
          `Available: ${RUNNER_REGISTRY.getTypes().join(', ')}`,
      );
    }

    // Validate required tools
    this.validateRequiredTools(entry, runnerConfig);

    // Instantiate runner via NestJS DI
    const runner = await this.moduleRef.resolve(entry.runnerClass);

    this.logger.debug(
      `Created runner '${entry.name}' for agent '${agent.slug}' (${runnerConfig.instruments.length} instruments)`,
    );

    return runner;
  }

  /**
   * Get runner entry without instantiating.
   * Useful for validation and UI display.
   */
  getRunnerEntry(type: PredictionRunnerType): RunnerRegistryEntry | undefined {
    return RUNNER_REGISTRY.get(type);
  }

  /**
   * Get all registered runner types.
   * Useful for admin UI dropdowns.
   */
  getAvailableRunners(): RunnerRegistryEntry[] {
    return RUNNER_REGISTRY.getAll();
  }

  /**
   * Check if a runner type is available.
   */
  isRunnerAvailable(type: PredictionRunnerType): boolean {
    return RUNNER_REGISTRY.has(type);
  }

  /**
   * Extract and validate runner config from agent metadata.
   *
   * @throws NotFoundException if runnerConfig is missing or invalid
   */
  private extractRunnerConfig(agent: AgentRecord): PredictionRunnerConfig {
    if (!agent.metadata?.runnerConfig) {
      throw new NotFoundException(
        `Agent '${agent.slug}' does not have runnerConfig in metadata. ` +
          `Expected: metadata.runnerConfig.runner to be one of: ${RUNNER_REGISTRY.getTypes().join(', ')}`,
      );
    }

    const config = agent.metadata.runnerConfig;

    // Validate required fields
    if (!config.runner) {
      throw new NotFoundException(
        `Agent '${agent.slug}' runnerConfig is missing 'runner' field. ` +
          `Expected one of: ${RUNNER_REGISTRY.getTypes().join(', ')}`,
      );
    }

    if (!config.instruments || config.instruments.length === 0) {
      throw new NotFoundException(
        `Agent '${agent.slug}' runnerConfig is missing 'instruments' array.`,
      );
    }

    if (!config.riskProfile) {
      throw new NotFoundException(
        `Agent '${agent.slug}' runnerConfig is missing 'riskProfile'.`,
      );
    }

    return config;
  }

  /**
   * Validate that runner has access to required tools.
   * This is a soft validation - logs warning but doesn't fail.
   */
  private validateRequiredTools(
    entry: RunnerRegistryEntry,
    config: PredictionRunnerConfig,
  ): void {
    // For now, just log. In future, could check tool availability.
    const configuredTools = config.toolOverrides
      ? Object.keys(config.toolOverrides)
      : [];

    this.logger.debug(
      `Runner '${entry.name}' requires tools: ${entry.requiredTools.join(', ')}. ` +
        `Config overrides: ${configuredTools.length > 0 ? configuredTools.join(', ') : 'none'}`,
    );
  }
}
