/**
 * Risk Dashboard Router
 *
 * Routes dashboard mode requests to appropriate handlers based on entity and action.
 * All UI data access for the risk system uses this router via A2A dashboard mode.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  DashboardActionResult,
  buildDashboardError,
} from './dashboard-handler.interface';

// Import entity handlers
import { ScopeHandler } from './handlers/scope.handler';
import { SubjectHandler } from './handlers/subject.handler';
import { CompositeScoreHandler } from './handlers/composite-score.handler';
import { AssessmentHandler } from './handlers/assessment.handler';
import { DebateHandler } from './handlers/debate.handler';

/**
 * Supported dashboard entities
 */
export type RiskDashboardEntity =
  | 'scopes'
  | 'subjects'
  | 'composite-scores'
  | 'assessments'
  | 'debates';

/**
 * Dashboard router response
 */
export interface DashboardRouterResponse {
  success: boolean;
  content?: unknown;
  metadata?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

@Injectable()
export class RiskDashboardRouter {
  private readonly logger = new Logger(RiskDashboardRouter.name);

  constructor(
    private readonly scopeHandler: ScopeHandler,
    private readonly subjectHandler: SubjectHandler,
    private readonly compositeScoreHandler: CompositeScoreHandler,
    private readonly assessmentHandler: AssessmentHandler,
    private readonly debateHandler: DebateHandler,
  ) {}

  /**
   * Route a dashboard request to the appropriate handler
   *
   * @param action - Action string in format '<entity>.<operation>' (e.g., 'scopes.list')
   * @param payload - Dashboard request payload with params, filters, pagination
   * @param context - ExecutionContext capsule
   * @returns Dashboard response
   */
  async route(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardRouterResponse> {
    this.logger.debug(
      `[RISK-DASHBOARD-ROUTER] Routing action: ${action} for org: ${context.orgSlug}`,
    );

    // Parse action into entity and operation
    const { entity, operation } = this.parseAction(action);

    if (!entity || !operation) {
      this.logger.warn(
        `[RISK-DASHBOARD-ROUTER] Invalid action format: ${action}`,
      );
      return this.buildErrorResponse(
        'INVALID_ACTION',
        `Invalid action format: ${action}. Expected format: '<entity>.<operation>'`,
      );
    }

    // Route to appropriate handler
    try {
      const result = await this.routeToHandler(
        entity,
        operation,
        payload,
        context,
      );
      return this.buildResponse(result);
    } catch (error) {
      this.logger.error(
        `[RISK-DASHBOARD-ROUTER] Error handling ${action}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.buildErrorResponse(
        'HANDLER_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Parse action string into entity and operation
   */
  private parseAction(action: string): {
    entity: string | null;
    operation: string | null;
  } {
    if (!action || typeof action !== 'string') {
      return { entity: null, operation: null };
    }

    const parts = action.split('.');

    if (parts.length === 2) {
      return { entity: parts[0] ?? null, operation: parts[1] ?? null };
    }

    if (parts.length > 2) {
      return {
        entity: parts[parts.length - 2] ?? null,
        operation: parts[parts.length - 1] ?? null,
      };
    }

    return { entity: null, operation: null };
  }

  /**
   * Route to the appropriate handler based on entity
   */
  private async routeToHandler(
    entity: string,
    operation: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const normalizedEntity = entity.toLowerCase();

    switch (normalizedEntity) {
      case 'scopes':
      case 'scope':
        return this.scopeHandler.execute(operation, payload, context);

      case 'subjects':
      case 'subject':
        return this.subjectHandler.execute(operation, payload, context);

      case 'composite-scores':
      case 'compositescores':
      case 'composite-score':
        return this.compositeScoreHandler.execute(operation, payload, context);

      case 'assessments':
      case 'assessment':
        return this.assessmentHandler.execute(operation, payload, context);

      case 'debates':
      case 'debate':
        return this.debateHandler.execute(operation, payload, context);

      default:
        return buildDashboardError(
          'UNKNOWN_ENTITY',
          `Unknown dashboard entity: ${entity}`,
          { supportedEntities: this.getSupportedEntities() },
        );
    }
  }

  /**
   * Build success response from handler result
   */
  private buildResponse(
    result: DashboardActionResult,
  ): DashboardRouterResponse {
    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      content: result.data,
      metadata: result.metadata,
    };
  }

  /**
   * Build error response
   */
  private buildErrorResponse(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): DashboardRouterResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * Get list of supported entities
   */
  getSupportedEntities(): RiskDashboardEntity[] {
    return ['scopes', 'subjects', 'composite-scores', 'assessments', 'debates'];
  }

  /**
   * Get supported actions for an entity
   */
  getSupportedActions(entity: RiskDashboardEntity): string[] {
    switch (entity) {
      case 'scopes':
        return this.scopeHandler.getSupportedActions();
      case 'subjects':
        return this.subjectHandler.getSupportedActions();
      case 'composite-scores':
        return this.compositeScoreHandler.getSupportedActions();
      case 'assessments':
        return this.assessmentHandler.getSupportedActions();
      case 'debates':
        return this.debateHandler.getSupportedActions();
      default:
        return [];
    }
  }
}
