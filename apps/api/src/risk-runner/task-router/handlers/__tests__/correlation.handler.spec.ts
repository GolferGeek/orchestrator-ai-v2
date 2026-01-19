import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationHandler } from '../correlation.handler';
import { CorrelationAnalysisService } from '../../../services/correlation-analysis.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  SubjectCorrelation,
  CorrelationMatrix,
  ConcentrationRisk,
} from '../../../interfaces/correlation.interface';

describe('CorrelationHandler', () => {
  let handler: CorrelationHandler;
  let correlationService: jest.Mocked<CorrelationAnalysisService>;

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'investment-risk-agent',
    agentType: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockSubjectCorrelation: SubjectCorrelation = {
    subject_a_id: 'subject-1',
    subject_a_identifier: 'AAPL',
    subject_b_id: 'subject-2',
    subject_b_identifier: 'MSFT',
    correlation_coefficient: 0.75,
    strength: 'strong_positive',
    dimension_correlations: [
      {
        dimension_slug: 'market',
        dimension_name: 'Market Risk',
        correlation_coefficient: 0.8,
        score_a: 70,
        score_b: 65,
      },
      {
        dimension_slug: 'fundamental',
        dimension_name: 'Fundamental Risk',
        correlation_coefficient: 0.7,
        score_a: 60,
        score_b: 55,
      },
    ],
    calculated_at: '2026-01-15T00:00:00Z',
  };

  const mockCorrelationMatrix: CorrelationMatrix = {
    scope_id: 'scope-1',
    scope_name: 'US Tech Stocks',
    subjects: [
      {
        id: 'subject-1',
        identifier: 'AAPL',
        name: 'Apple Inc.',
        current_score: 65,
      },
      {
        id: 'subject-2',
        identifier: 'MSFT',
        name: 'Microsoft Corp.',
        current_score: 55,
      },
      {
        id: 'subject-3',
        identifier: 'GOOGL',
        name: 'Alphabet Inc.',
        current_score: 45,
      },
    ],
    matrix: [
      { subject_a_index: 0, subject_b_index: 1, correlation: 0.75 },
      { subject_a_index: 0, subject_b_index: 2, correlation: 0.6 },
      { subject_a_index: 1, subject_b_index: 2, correlation: 0.5 },
    ],
    average_correlation: 0.617,
    highest_correlation: {
      subject_a_identifier: 'AAPL',
      subject_b_identifier: 'MSFT',
      correlation: 0.75,
    },
    lowest_correlation: {
      subject_a_identifier: 'MSFT',
      subject_b_identifier: 'GOOGL',
      correlation: 0.5,
    },
    calculated_at: '2026-01-15T00:00:00Z',
  };

  const mockConcentrationRisk: ConcentrationRisk = {
    scope_id: 'scope-1',
    total_subjects: 3,
    highly_correlated_pairs: 1,
    concentration_score: 45,
    risk_level: 'moderate',
    recommendations: [
      'Portfolio diversification is moderate. Monitor highly correlated pairs.',
    ],
    top_correlated_pairs: [mockSubjectCorrelation],
    calculated_at: '2026-01-15T00:00:00Z',
  };

  const createPayload = (
    action: string,
    params?: Record<string, unknown>,
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationHandler,
        {
          provide: CorrelationAnalysisService,
          useValue: {
            calculateSubjectCorrelation: jest.fn(),
            generateCorrelationMatrix: jest.fn(),
            analyzeConcentrationRisk: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<CorrelationHandler>(CorrelationHandler);
    correlationService = module.get(CorrelationAnalysisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('matrix');
      expect(actions).toContain('pair');
      expect(actions).toContain('concentration');
    });
  });

  describe('execute - matrix', () => {
    it('should generate correlation matrix for a scope', async () => {
      correlationService.generateCorrelationMatrix.mockResolvedValue(
        mockCorrelationMatrix,
      );

      const payload = createPayload('correlations.matrix', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'matrix',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCorrelationMatrix);
      expect(result.metadata?.subjectCount).toBe(3);
      expect(result.metadata?.pairCount).toBe(3);
      expect(correlationService.generateCorrelationMatrix).toHaveBeenCalledWith(
        'scope-1',
        { includeInactiveSubjects: undefined },
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('correlations.matrix');
      const result = await handler.execute(
        'matrix',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should pass includeInactive option', async () => {
      correlationService.generateCorrelationMatrix.mockResolvedValue(
        mockCorrelationMatrix,
      );

      const payload = createPayload('correlations.matrix', {
        scopeId: 'scope-1',
        includeInactive: true,
      });
      await handler.execute('matrix', payload, mockExecutionContext);

      expect(correlationService.generateCorrelationMatrix).toHaveBeenCalledWith(
        'scope-1',
        { includeInactiveSubjects: true },
      );
    });

    it('should handle service error', async () => {
      correlationService.generateCorrelationMatrix.mockRejectedValue(
        new Error('Scope not found: invalid-scope'),
      );

      const payload = createPayload('correlations.matrix', {
        scopeId: 'invalid-scope',
      });
      const result = await handler.execute(
        'matrix',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MATRIX_GENERATION_FAILED');
      expect(result.error?.message).toContain('Scope not found');
    });
  });

  describe('execute - pair', () => {
    it('should calculate correlation between two subjects', async () => {
      correlationService.calculateSubjectCorrelation.mockResolvedValue(
        mockSubjectCorrelation,
      );

      const payload = createPayload('correlations.pair', {
        subjectAId: 'subject-1',
        subjectBId: 'subject-2',
      });
      const result = await handler.execute(
        'pair',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubjectCorrelation);
      expect(
        correlationService.calculateSubjectCorrelation,
      ).toHaveBeenCalledWith('subject-1', 'subject-2');
    });

    it('should return error when subjectAId is missing', async () => {
      const payload = createPayload('correlations.pair', {
        subjectBId: 'subject-2',
      });
      const result = await handler.execute(
        'pair',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SUBJECT_IDS');
    });

    it('should return error when subjectBId is missing', async () => {
      const payload = createPayload('correlations.pair', {
        subjectAId: 'subject-1',
      });
      const result = await handler.execute(
        'pair',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SUBJECT_IDS');
    });

    it('should handle null correlation result (insufficient data)', async () => {
      correlationService.calculateSubjectCorrelation.mockResolvedValue(null);

      const payload = createPayload('correlations.pair', {
        subjectAId: 'subject-1',
        subjectBId: 'subject-2',
      });
      const result = await handler.execute(
        'pair',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.metadata?.message).toContain(
        'Insufficient shared dimensions',
      );
    });

    it('should handle service error', async () => {
      correlationService.calculateSubjectCorrelation.mockRejectedValue(
        new Error('Subject not found'),
      );

      const payload = createPayload('correlations.pair', {
        subjectAId: 'invalid',
        subjectBId: 'subject-2',
      });
      const result = await handler.execute(
        'pair',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CORRELATION_FAILED');
    });
  });

  describe('execute - concentration', () => {
    it('should analyze concentration risk for a scope', async () => {
      correlationService.analyzeConcentrationRisk.mockResolvedValue(
        mockConcentrationRisk,
      );

      const payload = createPayload('correlations.concentration', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'concentration',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConcentrationRisk);
      expect(result.metadata?.riskLevel).toBe('moderate');
      expect(correlationService.analyzeConcentrationRisk).toHaveBeenCalledWith(
        'scope-1',
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('correlations.concentration');
      const result = await handler.execute(
        'concentration',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should handle service error', async () => {
      correlationService.analyzeConcentrationRisk.mockRejectedValue(
        new Error('Scope not found: invalid-scope'),
      );

      const payload = createPayload('correlations.concentration', {
        scopeId: 'invalid-scope',
      });
      const result = await handler.execute(
        'concentration',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONCENTRATION_ANALYSIS_FAILED');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('correlations.unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });
});
