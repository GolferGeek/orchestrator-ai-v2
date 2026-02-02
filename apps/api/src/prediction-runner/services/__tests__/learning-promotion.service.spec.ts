import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LearningPromotionService } from '../learning-promotion.service';
import { LearningRepository } from '../../repositories/learning.repository';
import { LearningLineageRepository } from '../../repositories/learning-lineage.repository';
import { TestAuditLogRepository } from '../../repositories/test-audit-log.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Learning, LearningLineage } from '../../interfaces/learning.interface';

describe('LearningPromotionService', () => {
  let service: LearningPromotionService;
  let learningRepository: jest.Mocked<LearningRepository>;
  let lineageRepository: jest.Mocked<LearningLineageRepository>;
  let auditRepository: jest.Mocked<TestAuditLogRepository>;
  let _supabaseService: jest.Mocked<SupabaseService>;

  const mockTestLearning: Learning = {
    id: 'test-learning-123',
    scope_level: 'target',
    domain: 'stocks',
    universe_id: 'universe-123',
    target_id: 'target-123',
    analyst_id: null,
    learning_type: 'pattern',
    title: 'Bull flag pattern',
    description: 'Recognize bull flag patterns',
    config: { indicators: ['bullFlag'] },
    source_type: 'ai_approved',
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    status: 'active',
    superseded_by: null,
    version: 1,
    times_applied: 10,
    times_helpful: 8,
    is_test: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockProductionLearning: Learning = {
    ...mockTestLearning,
    id: 'prod-learning-123',
    is_test: false,
  };

  const mockLineage: LearningLineage = {
    id: 'lineage-123',
    organization_slug: 'test-org',
    test_learning_id: 'test-learning-123',
    production_learning_id: 'prod-learning-123',
    scenario_runs: ['run-1', 'run-2'],
    validation_metrics: {
      times_applied: 10,
      times_helpful: 8,
      success_rate: 0.8,
    },
    backtest_result: null,
    promoted_by: 'user-123',
    promoted_at: new Date().toISOString(),
    notes: 'Promoting after successful validation',
    created_at: new Date().toISOString(),
  };

  const mockLineageWithDetails = {
    ...mockLineage,
    promoter_email: 'user@test.com',
    promoter_name: 'Test User',
    test_learning_title: 'Bull flag pattern',
    production_learning_title: 'Bull flag pattern',
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const createChain = () => {
      const chain: Record<string, jest.Mock> = {};
      chain.single = jest
        .fn()
        .mockResolvedValue(overrides?.single ?? { data: null, error: null });
      chain.select = jest.fn().mockImplementation(() => ({
        ...chain,
        then: (resolve: (v: unknown) => void) =>
          resolve(overrides?.select ?? { data: [], error: null }),
      }));
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.lte = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      return chain;
    };

    const chain = createChain();

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningPromotionService,
        {
          provide: LearningRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockTestLearning),
            findByIdOrThrow: jest.fn().mockResolvedValue(mockTestLearning),
            create: jest.fn().mockResolvedValue(mockProductionLearning),
            update: jest
              .fn()
              .mockResolvedValue({ ...mockTestLearning, status: 'disabled' }),
            findByScope: jest.fn().mockResolvedValue([mockTestLearning]),
          },
        },
        {
          provide: LearningLineageRepository,
          useValue: {
            isTestLearningPromoted: jest.fn().mockResolvedValue(false),
            create: jest.fn().mockResolvedValue(mockLineage),
            getPromotionHistory: jest
              .fn()
              .mockResolvedValue([mockLineageWithDetails]),
            findByTestLearning: jest.fn().mockResolvedValue([mockLineage]),
            findByOrganization: jest.fn().mockResolvedValue([mockLineage]),
          },
        },
        {
          provide: TestAuditLogRepository,
          useValue: {
            log: jest.fn().mockResolvedValue({ id: 'audit-123' }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LearningPromotionService>(LearningPromotionService);
    learningRepository = module.get(LearningRepository);
    lineageRepository = module.get(LearningLineageRepository);
    auditRepository = module.get(TestAuditLogRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateForPromotion', () => {
    it('should return valid for promotable learning', async () => {
      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.learning).toEqual(mockTestLearning);
    });

    it('should return error when learning not found', async () => {
      learningRepository.findById.mockResolvedValue(null);

      const result = await service.validateForPromotion('nonexistent');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Learning not found: nonexistent');
    });

    it('should return error when learning is not a test learning', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockTestLearning,
        is_test: false,
      });

      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Learning must have is_test=true to be promoted',
      );
    });

    it('should return error when already promoted', async () => {
      lineageRepository.isTestLearningPromoted.mockResolvedValue(true);

      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Learning has already been promoted to production',
      );
    });

    it('should return error when learning status is not active', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockTestLearning,
        status: 'disabled',
      });

      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Learning must be active to promote (current status: disabled)',
      );
    });

    it('should return warning when never applied', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockTestLearning,
        times_applied: 0,
      });

      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'Learning has never been applied in test scenarios. Consider validating before promotion.',
      );
    });

    it('should return warning when low success rate', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockTestLearning,
        times_applied: 10,
        times_helpful: 3,
      });

      const result = await service.validateForPromotion('test-learning-123');

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('low success rate'))).toBe(
        true,
      );
    });
  });

  describe('promoteLearning', () => {
    it('should promote learning to production', async () => {
      const result = await service.promoteLearning(
        'test-learning-123',
        'user-123',
        'test-org',
        'Promoting after validation',
      );

      expect(learningRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: mockTestLearning.scope_level,
          title: mockTestLearning.title,
          status: 'active',
        }),
      );
      expect(lineageRepository.create).toHaveBeenCalled();
      expect(auditRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'learning_promoted',
          resource_type: 'learning',
          resource_id: 'test-learning-123',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when validation fails', async () => {
      learningRepository.findById.mockResolvedValue(null);

      await expect(
        service.promoteLearning('nonexistent', 'user-123', 'test-org'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include backtest result when provided', async () => {
      const backtestResult = {
        pass: true,
        improvement_score: 0.15,
        window_days: 30,
      };

      await service.promoteLearning(
        'test-learning-123',
        'user-123',
        'test-org',
        'Notes',
        backtestResult,
      );

      expect(lineageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          backtest_result: backtestResult,
        }),
      );
    });

    it('should include scenario runs when provided', async () => {
      const scenarioRuns = ['run-1', 'run-2', 'run-3'];

      await service.promoteLearning(
        'test-learning-123',
        'user-123',
        'test-org',
        'Notes',
        undefined,
        scenarioRuns,
      );

      expect(lineageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scenario_runs: scenarioRuns,
        }),
      );
    });
  });

  describe('getPromotionHistory', () => {
    it('should return promotion history for organization', async () => {
      const result = await service.getPromotionHistory('test-org');

      expect(lineageRepository.getPromotionHistory).toHaveBeenCalledWith(
        'test-org',
      );
      expect(result).toEqual([mockLineageWithDetails]);
    });

    it('should return empty array when no promotions', async () => {
      lineageRepository.getPromotionHistory.mockResolvedValue([]);

      const result = await service.getPromotionHistory('empty-org');

      expect(result).toEqual([]);
    });
  });

  describe('getLineage', () => {
    it('should return lineage for promoted learning', async () => {
      const result = await service.getLineage('test-learning-123');

      expect(lineageRepository.findByTestLearning).toHaveBeenCalledWith(
        'test-learning-123',
      );
      expect(result).toBeDefined();
    });

    it('should return null when not promoted', async () => {
      lineageRepository.findByTestLearning.mockResolvedValue([]);

      const result = await service.getLineage('not-promoted');

      expect(result).toBeNull();
    });
  });

  describe('rejectLearning', () => {
    it('should reject and disable learning', async () => {
      const result = await service.rejectLearning(
        'test-learning-123',
        'user-123',
        'test-org',
        'Not effective',
      );

      expect(learningRepository.update).toHaveBeenCalledWith(
        'test-learning-123',
        {
          status: 'disabled',
        },
      );
      expect(auditRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'learning_rejected',
          resource_type: 'learning',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when learning not found', async () => {
      learningRepository.findById.mockResolvedValue(null);

      await expect(
        service.rejectLearning('nonexistent', 'user-123', 'test-org', 'Reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-test learning', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockTestLearning,
        is_test: false,
      });

      await expect(
        service.rejectLearning(
          'test-learning-123',
          'user-123',
          'test-org',
          'Reason',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when already promoted', async () => {
      lineageRepository.isTestLearningPromoted.mockResolvedValue(true);

      await expect(
        service.rejectLearning(
          'test-learning-123',
          'user-123',
          'test-org',
          'Reason',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('backtestLearning', () => {
    it('should run backtest on test learning', async () => {
      const result = await service.backtestLearning('test-learning-123', 30);

      expect(result).toHaveProperty('pass');
      expect(result).toHaveProperty('improvement_score');
      expect(result).toHaveProperty('window_days', 30);
    });

    it('should throw BadRequestException for non-test learning', async () => {
      learningRepository.findByIdOrThrow.mockResolvedValue({
        ...mockTestLearning,
        is_test: false,
      });

      await expect(
        service.backtestLearning('test-learning-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return no pass when no historical data', async () => {
      const result = await service.backtestLearning('test-learning-123');

      expect(result.pass).toBe(false);
      expect(result.details?.error).toBe(
        'No historical data available for backtest',
      );
    });

    it('should use default window of 30 days', async () => {
      const result = await service.backtestLearning('test-learning-123');

      expect(result.window_days).toBe(30);
    });
  });

  describe('getPromotionStats', () => {
    it('should return promotion statistics', async () => {
      const result = await service.getPromotionStats('test-org');

      expect(result).toHaveProperty('total_test_learnings');
      expect(result).toHaveProperty('total_promoted');
      expect(result).toHaveProperty('total_rejected');
      expect(result).toHaveProperty('pending_review');
      expect(result).toHaveProperty('avg_times_applied');
      expect(result).toHaveProperty('avg_success_rate');
    });

    it('should calculate correct averages', async () => {
      learningRepository.findByScope.mockResolvedValue([
        { ...mockTestLearning, times_applied: 10, times_helpful: 8 },
        {
          ...mockTestLearning,
          id: 'learning-2',
          times_applied: 20,
          times_helpful: 15,
        },
      ]);
      lineageRepository.findByOrganization.mockResolvedValue([
        { ...mockLineage, test_learning_id: 'test-learning-123' },
      ]);

      const result = await service.getPromotionStats('test-org');

      expect(result.total_test_learnings).toBe(2);
      expect(result.total_promoted).toBe(1);
    });
  });
});
