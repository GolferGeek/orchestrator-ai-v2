import { Injectable, Logger } from '@nestjs/common';
import { TestTargetMirrorRepository } from '../repositories/test-target-mirror.repository';
import { TargetRepository } from '../repositories/target.repository';
import { Target } from '../interfaces/target.interface';

/**
 * Test Target Mirror Service
 *
 * Manages T_ prefixed mirror targets for production targets (INV-11).
 * Part of the Test Data Injection Framework (Phase 3).
 *
 * Key responsibilities:
 * - Create and manage mirror relationships between production and test targets
 * - Auto-create T_ mirror when production target is accessed for testing
 * - Ensure 1:1 mapping between production and test symbols
 *
 * Database schema:
 * - prediction.test_target_mirrors maps real_target_id to test_target_id
 * - Both IDs reference prediction.targets table
 * - Test targets have symbols starting with 'T_'
 * - Trigger auto_create_test_mirror automatically creates mirrors on target insert
 */
@Injectable()
export class TestTargetMirrorService {
  private readonly logger = new Logger(TestTargetMirrorService.name);

  constructor(
    private readonly testTargetMirrorRepository: TestTargetMirrorRepository,
    private readonly targetRepository: TargetRepository,
  ) {}

  /**
   * Ensure a test mirror exists for a production target
   * Creates the mirror relationship if it doesn't exist
   *
   * Note: The database trigger should auto-create mirrors when targets are created,
   * but this method provides explicit control for testing scenarios.
   *
   * @param productionTargetId - The production target ID to mirror
   * @param orgSlug - The organization slug (for context/logging)
   * @returns The test target (with T_ symbol)
   */
  async ensureMirror(
    productionTargetId: string,
    orgSlug: string,
  ): Promise<Target> {
    this.logger.log(
      `Ensuring test mirror exists for production target ${productionTargetId} (org: ${orgSlug})`,
    );

    // Get the production target
    const productionTarget =
      await this.targetRepository.findByIdOrThrow(productionTargetId);

    // Validate it's not already a test target
    if (productionTarget.symbol.startsWith('T_')) {
      throw new Error(
        `Target ${productionTargetId} is already a test target (symbol: ${productionTarget.symbol})`,
      );
    }

    // Check if mirror already exists in the mapping table
    const existingMirror =
      await this.testTargetMirrorRepository.findByProductionTarget(
        productionTargetId,
      );

    if (existingMirror) {
      this.logger.debug(
        `Test mirror already exists for ${productionTarget.symbol}`,
      );
      // Get the test target entity using the test symbol
      const testTarget = await this.targetRepository.findBySymbol(
        productionTarget.universe_id,
        existingMirror.test_symbol,
      );
      if (!testTarget) {
        throw new Error(
          `Test target ${existingMirror.test_symbol} not found for mirror ${existingMirror.id}`,
        );
      }
      return testTarget;
    }

    // Generate test symbol
    const testSymbol = `T_${productionTarget.symbol}`;

    // Check if test target already exists (might have been created by trigger)
    let testTarget = await this.targetRepository.findBySymbol(
      productionTarget.universe_id,
      testSymbol,
    );

    // Create test target if it doesn't exist
    if (!testTarget) {
      this.logger.log(
        `Creating test target ${testSymbol} for ${productionTarget.symbol}`,
      );
      testTarget = await this.targetRepository.create({
        universe_id: productionTarget.universe_id,
        symbol: testSymbol,
        name: `TEST: ${productionTarget.name}`,
        target_type: productionTarget.target_type,
        context: `Test mirror of ${productionTarget.symbol}. ${productionTarget.context || ''}`,
        is_active: productionTarget.is_active,
        metadata: {
          is_test_mirror: true,
          real_target_id: productionTarget.id,
          real_symbol: productionTarget.symbol,
        },
      });
    }

    // Create the mirror mapping
    await this.testTargetMirrorRepository.create({
      organization_slug: orgSlug,
      production_target_id: productionTargetId,
      test_symbol: testSymbol,
    });

    this.logger.log(
      `Created test mirror mapping: ${productionTarget.symbol} -> ${testSymbol}`,
    );

    return testTarget;
  }

  /**
   * Get the existing mirror for a production target
   * Returns null if no mirror exists
   *
   * @param productionTargetId - The production target ID
   * @returns The test target or null
   */
  async getMirror(productionTargetId: string): Promise<Target | null> {
    const mirror =
      await this.testTargetMirrorRepository.findByProductionTarget(
        productionTargetId,
      );

    if (!mirror) {
      return null;
    }

    // Get the test target entity from the repository
    // Note: The repository stores test_target_id but we need to map through test_symbol
    const testSymbol = mirror.test_symbol;
    const productionTarget =
      await this.targetRepository.findById(productionTargetId);

    if (!productionTarget) {
      this.logger.warn(
        `Production target ${productionTargetId} not found for mirror lookup`,
      );
      return null;
    }

    const testTarget = await this.targetRepository.findBySymbol(
      productionTarget.universe_id,
      testSymbol,
    );

    return testTarget;
  }

  /**
   * Get the test symbol (T_ prefixed) for a production target
   * Returns null if no mirror exists
   *
   * @param productionTargetId - The production target ID
   * @returns The test symbol (e.g., 'T_AAPL') or null
   */
  async getTestSymbol(productionTargetId: string): Promise<string | null> {
    const testTarget = await this.getMirror(productionTargetId);
    return testTarget?.symbol ?? null;
  }

  /**
   * Get the production target for a test symbol
   * Reverse lookup from test symbol to production target
   *
   * @param testSymbol - The test symbol (e.g., 'T_AAPL')
   * @returns The production target or null
   */
  async getProductionTarget(testSymbol: string): Promise<Target | null> {
    // Validate test symbol format
    if (!testSymbol.startsWith('T_')) {
      throw new Error(
        `Invalid test symbol: ${testSymbol} (must start with T_)`,
      );
    }

    const mirror =
      await this.testTargetMirrorRepository.findByTestSymbol(testSymbol);

    if (!mirror) {
      return null;
    }

    return this.targetRepository.findById(mirror.production_target_id);
  }

  /**
   * List all test mirror mappings for an organization
   *
   * @param orgSlug - The organization slug
   * @returns Array of mirror mappings with both production and test targets
   */
  async listMirrors(orgSlug: string): Promise<
    Array<{
      mirror: {
        id: string;
        production_target_id: string;
        test_symbol: string;
        created_at: string;
      };
      productionTarget: Target;
      testTarget: Target | null;
    }>
  > {
    this.logger.log(`Listing test mirrors for organization: ${orgSlug}`);

    const mirrors =
      await this.testTargetMirrorRepository.findByOrganization(orgSlug);

    // Fetch both production and test targets for each mirror
    const results = await Promise.all(
      mirrors.map(async (mirror) => {
        const productionTarget = await this.targetRepository.findById(
          mirror.production_target_id,
        );

        if (!productionTarget) {
          this.logger.warn(
            `Production target ${mirror.production_target_id} not found for mirror ${mirror.id}`,
          );
          return null;
        }

        const testTarget = await this.targetRepository.findBySymbol(
          productionTarget.universe_id,
          mirror.test_symbol,
        );

        return {
          mirror: {
            id: mirror.id,
            production_target_id: mirror.production_target_id,
            test_symbol: mirror.test_symbol,
            created_at: mirror.created_at,
          },
          productionTarget,
          testTarget,
        };
      }),
    );

    // Filter out null results (where production target was not found)
    return results.filter((result) => result !== null) as Array<{
      mirror: {
        id: string;
        production_target_id: string;
        test_symbol: string;
        created_at: string;
      };
      productionTarget: Target;
      testTarget: Target | null;
    }>;
  }

  /**
   * Delete a test mirror mapping
   * Note: This only deletes the mapping, not the actual test target
   *
   * @param mirrorId - The mirror mapping ID
   */
  async deleteMirror(mirrorId: string): Promise<void> {
    this.logger.log(`Deleting test mirror mapping: ${mirrorId}`);
    await this.testTargetMirrorRepository.delete(mirrorId);
  }

  /**
   * Check if a target is a test mirror (symbol starts with T_)
   *
   * @param target - The target to check
   * @returns True if the target is a test mirror
   */
  isTestMirror(target: Target): boolean {
    return target.symbol.startsWith('T_');
  }

  /**
   * Get the production symbol from a test symbol
   * Simply removes the T_ prefix
   *
   * @param testSymbol - The test symbol (e.g., 'T_AAPL')
   * @returns The production symbol (e.g., 'AAPL')
   */
  getProductionSymbol(testSymbol: string): string {
    if (!testSymbol.startsWith('T_')) {
      throw new Error(
        `Invalid test symbol: ${testSymbol} (must start with T_)`,
      );
    }
    return testSymbol.substring(2);
  }
}
