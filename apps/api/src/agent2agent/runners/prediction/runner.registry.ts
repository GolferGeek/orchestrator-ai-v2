/**
 * Prediction Runner Registry
 *
 * Registry of all available prediction runners.
 * Used by RunnerFactoryService to instantiate the correct runner
 * based on agent configuration.
 *
 * HOW RUNNERS ARE REGISTERED:
 * 1. Runner implementations call RUNNER_REGISTRY.register() on module load
 * 2. RunnerFactoryService queries the registry to create runners
 * 3. Each runner type maps to a single implementation
 *
 * @module runner.registry
 */

import { Type } from '@nestjs/common';
import {
  PredictionRunnerType,
  TargetType,
  RunnerInput,
  RunnerOutput,
} from './base/base-prediction.types';

/**
 * Interface that all prediction runners must implement.
 * Generic runner interface - specific methods defined in BaseRunner abstract class.
 */
export interface IPredictionRunner {
  /** Runner type identifier */
  readonly runnerType: PredictionRunnerType;

  /** Runner name for logging */
  readonly runnerName: string;

  /** Execute the prediction runner */
  execute(input: RunnerInput): Promise<RunnerOutput>;
}

/**
 * Registry entry for a runner implementation
 */
export interface RunnerRegistryEntry {
  /** Runner type (e.g., 'financial-asset-predictor') */
  type: PredictionRunnerType;

  /** Runner class (NestJS injectable) */
  runnerClass: Type<IPredictionRunner>;

  /** Human-readable name */
  name: string;

  /** Description of what this runner does */
  description: string;

  /** Required tools for this runner type */
  requiredTools: string[];

  /** Default poll interval in ms */
  defaultPollIntervalMs: number;

  /** Supported risk profiles */
  supportedRiskProfiles: string[];

  /** Supported target types (optional - domain-specific) */
  supportedTargetTypes?: TargetType[];
}

/**
 * Runner Registry singleton.
 * Maintains the mapping of runner types to implementations.
 */
class RunnerRegistry {
  private readonly entries = new Map<
    PredictionRunnerType,
    RunnerRegistryEntry
  >();

  /**
   * Register a runner implementation.
   * Called by runner modules during initialization.
   */
  register(entry: RunnerRegistryEntry): void {
    if (this.entries.has(entry.type)) {
      throw new Error(
        `Runner type '${entry.type}' is already registered. ` +
          `Existing: ${this.entries.get(entry.type)?.name}, New: ${entry.name}`,
      );
    }
    this.entries.set(entry.type, entry);
  }

  /**
   * Get a registered runner entry by type.
   */
  get(type: PredictionRunnerType): RunnerRegistryEntry | undefined {
    return this.entries.get(type);
  }

  /**
   * Get all registered runner types.
   */
  getTypes(): PredictionRunnerType[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all registered entries.
   */
  getAll(): RunnerRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Check if a runner type is registered.
   */
  has(type: PredictionRunnerType): boolean {
    return this.entries.has(type);
  }

  /**
   * Clear the registry (for testing).
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Global runner registry instance.
 * Use this to register and query prediction runners.
 */
export const RUNNER_REGISTRY = new RunnerRegistry();

/**
 * Decorator to register a runner class.
 * Apply to runner classes to auto-register them.
 *
 * @example
 * ```typescript
 * @RegisterRunner({
 *   type: 'stock-predictor',
 *   name: 'Stock Predictor',
 *   description: 'Predicts stock price movements',
 *   requiredTools: ['yahoo-finance', 'alpha-vantage'],
 *   defaultPollIntervalMs: 60000,
 *   supportedRiskProfiles: ['conservative', 'moderate', 'aggressive'],
 * })
 * @Injectable()
 * export class StockPredictorRunner implements IPredictionRunner {
 *   // ...
 * }
 * ```
 */
export function RegisterRunner(
  config: Omit<RunnerRegistryEntry, 'runnerClass'>,
): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return function <T extends Function>(target: T): T {
    RUNNER_REGISTRY.register({
      ...config,
      runnerClass: target as unknown as Type<IPredictionRunner>,
    });
    return target;
  };
}
