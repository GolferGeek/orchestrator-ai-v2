/**
 * Debate Handler
 *
 * Dashboard handler for Red Team / Blue Team debate operations.
 * Supports viewing debates, triggering new debates, and managing debate contexts.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { DebateService } from '../../services/debate.service';
import { DebateRepository } from '../../repositories/debate.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import { AssessmentRepository } from '../../repositories/assessment.repository';
import { ScopeRepository } from '../../repositories/scope.repository';

@Injectable()
export class DebateHandler implements IDashboardHandler {
  private readonly logger = new Logger(DebateHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'view',
    'trigger',
    'getBySubject',
    'by-subject',
    'getLatest',
    'latest',
    'contexts.list',
    'contexts.get',
  ];

  constructor(
    private readonly debateService: DebateService,
    private readonly debateRepo: DebateRepository,
    private readonly compositeScoreRepo: CompositeScoreRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly scopeRepo: ScopeRepository,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(`Executing debate action: ${action}`);

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(payload);
      case 'get':
      case 'view':
        return this.handleGet(payload);
      case 'trigger':
        return this.handleTrigger(payload, context);
      case 'getbysubject':
      case 'by-subject':
        return this.handleGetBySubject(payload);
      case 'getlatest':
      case 'latest':
      case 'get-latest':
        return this.handleGetLatest(payload);
      case 'contexts.list':
        return this.handleListContexts(payload);
      case 'contexts.get':
        return this.handleGetContext(payload);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported debate action: ${action}`,
          { supportedActions: this.supportedActions },
        );
    }
  }

  getSupportedActions(): string[] {
    return this.supportedActions;
  }

  /**
   * List all debates for a subject
   */
  private async handleList(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectId = params?.subjectId as string | undefined;

    if (!subjectId) {
      return buildDashboardError(
        'MISSING_FILTER',
        'Subject ID is required. Use debates.by-subject for subject-specific queries.',
        { supportedFilters: ['subjectId'] },
      );
    }

    const debates = await this.debateRepo.findBySubject(subjectId);

    // Apply pagination
    const page = payload.pagination?.page ?? 1;
    const pageSize = payload.pagination?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paginatedDebates = debates.slice(start, start + pageSize);

    return buildDashboardSuccess(
      paginatedDebates,
      buildPaginationMetadata(debates.length, page, pageSize),
    );
  }

  /**
   * Get a specific debate by ID
   */
  private async handleGet(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const id = params?.id as string | undefined;
    const subjectId = params?.subjectId as string | undefined;

    // If no ID but subjectId provided, get latest for that subject
    if (!id && subjectId) {
      return this.handleGetLatest(payload);
    }

    if (!id) {
      return buildDashboardError(
        'MISSING_ID',
        'Debate ID or Subject ID is required',
      );
    }

    const debate = await this.debateRepo.findById(id);

    if (!debate) {
      return buildDashboardError('NOT_FOUND', `Debate not found: ${id}`);
    }

    return buildDashboardSuccess(debate);
  }

  /**
   * Trigger a new debate for a subject
   */
  private async handleTrigger(
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectId = params?.subjectId as string | undefined;

    if (!subjectId) {
      return buildDashboardError(
        'MISSING_SUBJECT_ID',
        'Subject ID is required',
      );
    }

    // Get the subject
    const subject = await this.subjectRepo.findById(subjectId);
    if (!subject) {
      return buildDashboardError(
        'NOT_FOUND',
        `Subject not found: ${subjectId}`,
      );
    }

    // Get the current composite score
    const compositeScore =
      await this.compositeScoreRepo.findActiveBySubject(subjectId);
    if (!compositeScore) {
      return buildDashboardError(
        'NO_SCORE',
        'No active composite score found for subject. Run Risk Radar first.',
      );
    }

    // Get the assessments for context
    const assessments = await this.assessmentRepo.findByTask(
      compositeScore.task_id ?? '',
    );

    // Get the scope for the subject
    const scope = await this.scopeRepo.findById(subject.scope_id);
    if (!scope) {
      return buildDashboardError(
        'NOT_FOUND',
        `Scope not found for subject: ${subjectId}`,
      );
    }

    try {
      // Run the debate
      const result = await this.debateService.runDebate({
        subject,
        compositeScore,
        assessments,
        scopeId: scope.id,
        context,
      });

      return buildDashboardSuccess(
        {
          debateId: result.debate.id,
          originalScore: compositeScore.overall_score,
          adjustedScore: result.adjustedScore,
          adjustment: result.adjustment,
          status: result.debate.status,
        },
        {
          message: `Debate completed. Score adjusted from ${compositeScore.overall_score} to ${result.adjustedScore} (${result.adjustment >= 0 ? '+' : ''}${result.adjustment})`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to trigger debate: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DEBATE_FAILED',
        error instanceof Error ? error.message : 'Failed to run debate',
      );
    }
  }

  /**
   * Get all debates for a subject
   */
  private async handleGetBySubject(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectId = params?.subjectId as string | undefined;
    const limit = (params?.limit as number | undefined) ?? 10;

    if (!subjectId) {
      return buildDashboardError(
        'MISSING_SUBJECT_ID',
        'Subject ID is required',
      );
    }

    const debates = await this.debateRepo.findBySubject(subjectId);
    const limitedDebates = debates.slice(0, limit);

    return buildDashboardSuccess(limitedDebates, {
      totalCount: debates.length,
    });
  }

  /**
   * Get the latest completed debate for a subject
   */
  private async handleGetLatest(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectId = params?.subjectId as string | undefined;

    if (!subjectId) {
      return buildDashboardError(
        'MISSING_SUBJECT_ID',
        'Subject ID is required',
      );
    }

    const debate = await this.debateRepo.findLatestBySubject(subjectId);

    if (!debate) {
      return buildDashboardSuccess(null, {
        message: 'No completed debates found for this subject',
      });
    }

    return buildDashboardSuccess(debate);
  }

  /**
   * List debate contexts for a scope
   */
  private async handleListContexts(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError('MISSING_SCOPE_ID', 'Scope ID is required');
    }

    const contexts = await this.debateRepo.findContextsByScope(scopeId);

    return buildDashboardSuccess(contexts, {
      totalCount: contexts.length,
    });
  }

  /**
   * Get a specific debate context
   */
  private async handleGetContext(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;
    const role = params?.role as 'blue' | 'red' | 'arbiter' | undefined;

    if (!scopeId) {
      return buildDashboardError('MISSING_SCOPE_ID', 'Scope ID is required');
    }

    if (!role) {
      return buildDashboardError('MISSING_ROLE', 'Role is required');
    }

    if (!['blue', 'red', 'arbiter'].includes(role)) {
      return buildDashboardError(
        'INVALID_ROLE',
        'Role must be one of: blue, red, arbiter',
      );
    }

    const context = await this.debateRepo.findActiveContextByRole(
      scopeId,
      role,
    );

    if (!context) {
      return buildDashboardError(
        'NOT_FOUND',
        `No active context found for role: ${role}`,
      );
    }

    return buildDashboardSuccess(context);
  }
}
