/**
 * Test Target Mirror Dashboard Handler
 *
 * Handles dashboard mode requests for test target mirrors.
 * Part of Phase 3: Test Data Management UI.
 *
 * Test target mirrors map production targets to their T_ prefixed test counterparts.
 * This enables test data isolation while referencing real targets.
 *
 * Supports:
 * - List mirrors with optional target details
 * - Get mirror by ID, production target, or test symbol
 * - Create new mirrors
 * - Ensure mirror exists (create if not)
 * - Delete mirrors
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  TestTargetMirrorRepository,
  TestTargetMirror,
  CreateTestTargetMirrorData,
} from '../../repositories/test-target-mirror.repository';
import { TargetRepository } from '../../repositories/target.repository';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';

interface TestTargetMirrorParams {
  id?: string;
  productionTargetId?: string;
  testSymbol?: string;
  includeTargetDetails?: boolean;
  page?: number;
  pageSize?: number;
}

interface CreateMirrorParams {
  production_target_id: string;
  test_symbol: string;
}

interface EnsureMirrorParams {
  productionTargetId: string;
  baseSymbol?: string;
}

interface MirrorWithTarget extends TestTargetMirror {
  production_target?: {
    id: string;
    name: string;
    symbol: string;
    universe_id: string;
    target_type: string;
  };
}

@Injectable()
export class TestTargetMirrorHandler implements IDashboardHandler {
  private readonly logger = new Logger(TestTargetMirrorHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'get-by-production-target',
    'get-by-test-symbol',
    'create',
    'ensure',
    'delete',
    'list-with-targets',
  ];

  constructor(
    private readonly testTargetMirrorRepository: TestTargetMirrorRepository,
    private readonly targetRepository: TargetRepository,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[TEST-TARGET-MIRROR-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as TestTargetMirrorParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(context, params);
      case 'get':
        return this.handleGet(params);
      case 'get-by-production-target':
      case 'getbyproductiontarget':
        return this.handleGetByProductionTarget(params);
      case 'get-by-test-symbol':
      case 'getbytestsymbol':
        return this.handleGetByTestSymbol(params);
      case 'create':
        return this.handleCreate(context, payload);
      case 'ensure':
        return this.handleEnsure(context, payload);
      case 'delete':
        return this.handleDelete(params);
      case 'list-with-targets':
      case 'listwithtargets':
        return this.handleListWithTargets(context, params);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported action: ${action}`,
          { supportedActions: this.supportedActions },
        );
    }
  }

  getSupportedActions(): string[] {
    return this.supportedActions;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // List Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleList(
    context: ExecutionContext,
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    try {
      const mirrors = await this.testTargetMirrorRepository.findByOrganization(
        context.orgSlug,
      );

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 50;
      const startIndex = (page - 1) * pageSize;
      const paginatedMirrors = mirrors.slice(startIndex, startIndex + pageSize);

      return buildDashboardSuccess(
        paginatedMirrors,
        buildPaginationMetadata(mirrors.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list test target mirrors: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to list test target mirrors',
      );
    }
  }

  private async handleListWithTargets(
    context: ExecutionContext,
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    try {
      const mirrors = await this.testTargetMirrorRepository.findByOrganization(
        context.orgSlug,
      );

      // Enrich with production target details
      const mirrorsWithTargets: MirrorWithTarget[] = await Promise.all(
        mirrors.map(async (mirror) => {
          try {
            const target = await this.targetRepository.findById(
              mirror.production_target_id,
            );
            return {
              ...mirror,
              production_target: target
                ? {
                    id: target.id,
                    name: target.name,
                    symbol: target.symbol,
                    universe_id: target.universe_id,
                    target_type: target.target_type,
                  }
                : undefined,
            };
          } catch {
            // If target fetch fails, return mirror without target details
            return mirror;
          }
        }),
      );

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 50;
      const startIndex = (page - 1) * pageSize;
      const paginatedMirrors = mirrorsWithTargets.slice(
        startIndex,
        startIndex + pageSize,
      );

      return buildDashboardSuccess(
        paginatedMirrors,
        buildPaginationMetadata(mirrorsWithTargets.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list test target mirrors with targets: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_WITH_TARGETS_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to list test target mirrors with targets',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Get Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleGet(
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Mirror ID is required');
    }

    try {
      const mirror = await this.testTargetMirrorRepository.findById(params.id);
      if (!mirror) {
        return buildDashboardError(
          'NOT_FOUND',
          `Mirror not found: ${params.id}`,
        );
      }

      // Optionally include target details
      if (params.includeTargetDetails) {
        const target = await this.targetRepository.findById(
          mirror.production_target_id,
        );
        const mirrorWithTarget: MirrorWithTarget = {
          ...mirror,
          production_target: target
            ? {
                id: target.id,
                name: target.name,
                symbol: target.symbol,
                universe_id: target.universe_id,
                target_type: target.target_type,
              }
            : undefined,
        };
        return buildDashboardSuccess(mirrorWithTarget);
      }

      return buildDashboardSuccess(mirror);
    } catch (error) {
      this.logger.error(
        `Failed to get test target mirror: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get test target mirror',
      );
    }
  }

  private async handleGetByProductionTarget(
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    if (!params?.productionTargetId) {
      return buildDashboardError(
        'MISSING_PRODUCTION_TARGET_ID',
        'productionTargetId is required',
      );
    }

    try {
      const mirror =
        await this.testTargetMirrorRepository.findByProductionTarget(
          params.productionTargetId,
        );

      if (!mirror) {
        return buildDashboardError(
          'NOT_FOUND',
          `No mirror found for production target: ${params.productionTargetId}`,
        );
      }

      return buildDashboardSuccess(mirror);
    } catch (error) {
      this.logger.error(
        `Failed to get mirror by production target: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_BY_PRODUCTION_TARGET_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get mirror by production target',
      );
    }
  }

  private async handleGetByTestSymbol(
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    if (!params?.testSymbol) {
      return buildDashboardError(
        'MISSING_TEST_SYMBOL',
        'testSymbol is required',
      );
    }

    try {
      const mirror = await this.testTargetMirrorRepository.findByTestSymbol(
        params.testSymbol,
      );

      if (!mirror) {
        return buildDashboardError(
          'NOT_FOUND',
          `No mirror found for test symbol: ${params.testSymbol}`,
        );
      }

      return buildDashboardSuccess(mirror);
    } catch (error) {
      this.logger.error(
        `Failed to get mirror by test symbol: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_BY_TEST_SYMBOL_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get mirror by test symbol',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Create Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleCreate(
    context: ExecutionContext,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const data = payload.params as unknown as CreateMirrorParams;

    if (!data.production_target_id || !data.test_symbol) {
      return buildDashboardError(
        'INVALID_DATA',
        'production_target_id and test_symbol are required',
      );
    }

    // Validate test symbol has T_ prefix
    if (!data.test_symbol.startsWith('T_')) {
      return buildDashboardError(
        'INVALID_TEST_SYMBOL',
        'test_symbol must start with T_ prefix',
      );
    }

    try {
      // Verify production target exists
      const target = await this.targetRepository.findById(
        data.production_target_id,
      );
      if (!target) {
        return buildDashboardError(
          'PRODUCTION_TARGET_NOT_FOUND',
          `Production target not found: ${data.production_target_id}`,
        );
      }

      // Check if mirror already exists
      const existing =
        await this.testTargetMirrorRepository.findByProductionTarget(
          data.production_target_id,
        );
      if (existing) {
        return buildDashboardError(
          'MIRROR_EXISTS',
          `Mirror already exists for production target: ${data.production_target_id}`,
          { existing_mirror: existing },
        );
      }

      const createData: CreateTestTargetMirrorData = {
        organization_slug: context.orgSlug,
        production_target_id: data.production_target_id,
        test_symbol: data.test_symbol,
      };

      const mirror = await this.testTargetMirrorRepository.create(createData);
      return buildDashboardSuccess(mirror);
    } catch (error) {
      this.logger.error(
        `Failed to create test target mirror: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CREATE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to create test target mirror',
      );
    }
  }

  private async handleEnsure(
    context: ExecutionContext,
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const data = payload.params as unknown as EnsureMirrorParams;

    if (!data.productionTargetId) {
      return buildDashboardError(
        'INVALID_DATA',
        'productionTargetId is required',
      );
    }

    try {
      // Verify production target exists and get symbol
      const target = await this.targetRepository.findById(
        data.productionTargetId,
      );
      if (!target) {
        return buildDashboardError(
          'PRODUCTION_TARGET_NOT_FOUND',
          `Production target not found: ${data.productionTargetId}`,
        );
      }

      // Use production target symbol as base if not provided
      const baseSymbol = data.baseSymbol ?? target.symbol;

      const mirror = await this.testTargetMirrorRepository.ensureMirrorExists(
        data.productionTargetId,
        context.orgSlug,
        baseSymbol,
      );

      return buildDashboardSuccess({
        mirror,
        created: mirror.created_at
          ? new Date(mirror.created_at).getTime() > Date.now() - 1000
          : false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to ensure test target mirror: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'ENSURE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to ensure test target mirror',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Delete Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleDelete(
    params?: TestTargetMirrorParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Mirror ID is required');
    }

    try {
      // Verify mirror exists
      const mirror = await this.testTargetMirrorRepository.findById(params.id);
      if (!mirror) {
        return buildDashboardError(
          'NOT_FOUND',
          `Mirror not found: ${params.id}`,
        );
      }

      await this.testTargetMirrorRepository.delete(params.id);
      return buildDashboardSuccess({
        deleted: true,
        id: params.id,
        test_symbol: mirror.test_symbol,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete test target mirror: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to delete test target mirror',
      );
    }
  }
}
