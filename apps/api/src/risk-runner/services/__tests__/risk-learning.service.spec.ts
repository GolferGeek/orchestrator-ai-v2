import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import {
  RiskLearningService,
  LearningQueueResponse,
  AppliedLearnings,
} from '../risk-learning.service';
import { LearningRepository } from '../../repositories/learning.repository';
import {
  RiskLearning,
  RiskLearningQueueItem,
  PendingLearningView,
} from '../../interfaces/learning.interface';

describe('RiskLearningService', () => {
  let service: RiskLearningService;
  let learningRepo: jest.Mocked<LearningRepository>;

  const mockLearning: RiskLearning = {
    id: 'learning-123',
    scope_level: 'scope',
    domain: 'investment',
    scope_id: 'scope-123',
    subject_id: null,
    dimension_id: null,
    learning_type: 'pattern',
    title: 'High VIX indicates elevated risk',
    description: 'When VIX > 25, risk scores should be elevated',
    config: {
      pattern_signals: ['high_vix', 'market_stress'],
      pattern_effect: 'elevate_risk',
    },
    times_applied: 10,
    times_helpful: 8,
    effectiveness_score: 0.8,
    status: 'active',
    is_test: true,
    source_type: 'ai_approved',
    parent_learning_id: null,
    is_production: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockQueueItem: RiskLearningQueueItem = {
    id: 'queue-123',
    scope_id: 'scope-123',
    subject_id: null,
    evaluation_id: 'eval-123',
    suggested_scope_level: 'scope',
    suggested_learning_type: 'pattern',
    suggested_title: 'VIX threshold pattern',
    suggested_description: 'High VIX correlates with elevated risk',
    suggested_config: {},
    ai_reasoning: 'Observed in 8 out of 10 evaluations',
    ai_confidence: 0.8,
    status: 'pending',
    reviewed_by_user_id: null,
    reviewer_notes: null,
    reviewed_at: null,
    learning_id: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  const mockPendingView: PendingLearningView = {
    ...mockQueueItem,
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'US Tech Stocks',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskLearningService,
        {
          provide: LearningRepository,
          useValue: {
            createLearning: jest.fn(),
            updateLearning: jest.fn(),
            findLearningById: jest.fn(),
            findLearningByIdOrThrow: jest.fn(),
            findLearningsByScope: jest.fn(),
            findAllLearnings: jest.fn(),
            findProductionLearnings: jest.fn(),
            deleteLearning: jest.fn(),
            findPendingQueue: jest.fn(),
            findQueueByScope: jest.fn(),
            findQueueItemById: jest.fn(),
            findQueueItemByIdOrThrow: jest.fn(),
            createQueueItem: jest.fn(),
            updateQueueItem: jest.fn(),
            countPending: jest.fn(),
            incrementApplied: jest.fn(),
            incrementHelpful: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RiskLearningService>(RiskLearningService);
    learningRepo = module.get(LearningRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLearning', () => {
    it('should create a new learning', async () => {
      learningRepo.createLearning.mockResolvedValue(mockLearning);

      const result = await service.createLearning({
        scope_level: 'scope',
        learning_type: 'pattern',
        title: 'Test learning',
        description: 'Test description',
      });

      expect(result).toEqual(mockLearning);
      expect(learningRepo.createLearning).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: 'scope',
          learning_type: 'pattern',
          title: 'Test learning',
        }),
      );
    });
  });

  describe('respondToQueueItem', () => {
    it('should approve a pending queue item and create learning', async () => {
      learningRepo.findQueueItemByIdOrThrow.mockResolvedValue(mockQueueItem);
      learningRepo.createLearning.mockResolvedValue(mockLearning);
      learningRepo.updateQueueItem.mockResolvedValue({
        ...mockQueueItem,
        status: 'approved',
        learning_id: mockLearning.id,
      });

      const response: LearningQueueResponse = {
        decision: 'approved',
        reviewerNotes: 'Looks good',
      };

      const result = await service.respondToQueueItem(
        'queue-123',
        'user-123',
        response,
      );

      expect(result).toEqual(mockLearning);
      expect(learningRepo.createLearning).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockQueueItem.suggested_title,
          status: 'testing',
          is_test: true,
          source_type: 'ai_approved',
        }),
      );
      expect(learningRepo.updateQueueItem).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          status: 'approved',
          reviewed_by_user_id: 'user-123',
          learning_id: mockLearning.id,
        }),
      );
    });

    it('should reject a pending queue item', async () => {
      learningRepo.findQueueItemByIdOrThrow.mockResolvedValue(mockQueueItem);
      learningRepo.updateQueueItem.mockResolvedValue({
        ...mockQueueItem,
        status: 'rejected',
      });

      const response: LearningQueueResponse = {
        decision: 'rejected',
        reviewerNotes: 'Not applicable',
      };

      const result = await service.respondToQueueItem(
        'queue-123',
        'user-123',
        response,
      );

      expect(result).toBeNull();
      expect(learningRepo.createLearning).not.toHaveBeenCalled();
      expect(learningRepo.updateQueueItem).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          status: 'rejected',
          reviewed_by_user_id: 'user-123',
        }),
      );
    });

    it('should modify and create learning with modified values', async () => {
      learningRepo.findQueueItemByIdOrThrow.mockResolvedValue(mockQueueItem);
      learningRepo.createLearning.mockResolvedValue({
        ...mockLearning,
        title: 'Modified title',
        description: 'Modified description',
      });
      learningRepo.updateQueueItem.mockResolvedValue({
        ...mockQueueItem,
        status: 'modified',
      });

      const response: LearningQueueResponse = {
        decision: 'modified',
        modifiedTitle: 'Modified title',
        modifiedDescription: 'Modified description',
        modifiedConfig: { custom: 'value' },
      };

      const result = await service.respondToQueueItem(
        'queue-123',
        'user-123',
        response,
      );

      expect(result?.title).toBe('Modified title');
      expect(learningRepo.createLearning).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Modified title',
          description: 'Modified description',
          config: { custom: 'value' },
        }),
      );
    });

    it('should throw ConflictException if queue item already processed', async () => {
      learningRepo.findQueueItemByIdOrThrow.mockResolvedValue({
        ...mockQueueItem,
        status: 'approved',
      });

      const response: LearningQueueResponse = {
        decision: 'approved',
      };

      await expect(
        service.respondToQueueItem('queue-123', 'user-123', response),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('applyLearningsToPrompt', () => {
    it('should categorize learnings by type', () => {
      const learnings: RiskLearning[] = [
        {
          ...mockLearning,
          learning_type: 'rule',
          title: 'Rule 1',
          description: 'Rule desc',
        },
        {
          ...mockLearning,
          id: 'l2',
          learning_type: 'pattern',
          title: 'Pattern 1',
          description: 'Pattern desc',
        },
        {
          ...mockLearning,
          id: 'l3',
          learning_type: 'avoid',
          title: 'Avoid 1',
          description: 'Avoid desc',
        },
        {
          ...mockLearning,
          id: 'l4',
          learning_type: 'weight_adjustment',
          config: { dimension_slug: 'market', weight_modifier: 1.2 },
        },
        {
          ...mockLearning,
          id: 'l5',
          learning_type: 'threshold',
          config: { threshold_name: 'alert', threshold_value: 75 },
        },
      ];

      const result = service.applyLearningsToPrompt(learnings);

      expect(result.appliedIds.length).toBe(5);
      expect(result.rules.length).toBe(1);
      expect(result.patterns.length).toBe(1);
      expect(result.avoids.length).toBe(1);
      expect(result.weightAdjustments['market']).toBe(1.2);
      expect(result.thresholdAdjustments['alert']).toBe(75);
    });

    it('should format applied learnings as prompt text', () => {
      const applied: AppliedLearnings = {
        appliedIds: ['l1', 'l2', 'l3'],
        rules: ['Rule 1: Description'],
        patterns: ['Pattern 1: Description'],
        avoids: ['Avoid 1: Description'],
        weightAdjustments: {},
        thresholdAdjustments: {},
      };

      const promptText = service.formatLearningsForPrompt(applied);

      expect(promptText).toContain('Required Rules');
      expect(promptText).toContain('Rule 1: Description');
      expect(promptText).toContain('Recognized Patterns');
      expect(promptText).toContain('Anti-Patterns to Avoid');
    });
  });

  describe('validateForPromotion', () => {
    it('should validate test learning for promotion', async () => {
      learningRepo.findLearningById.mockResolvedValue(mockLearning);

      const result = await service.validateForPromotion('learning-123');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.learning).toEqual(mockLearning);
    });

    it('should fail validation if learning not found', async () => {
      learningRepo.findLearningById.mockResolvedValue(null);

      const result = await service.validateForPromotion('non-existent');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Learning not found: non-existent');
    });

    it('should fail validation if already production', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        is_production: true,
      });

      const result = await service.validateForPromotion('learning-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Learning is already in production');
    });

    it('should fail validation if not a test learning', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        is_test: false,
      });

      const result = await service.validateForPromotion('learning-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Learning must be a test learning (is_test=true) to promote',
      );
    });

    it('should warn if learning has never been applied', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        times_applied: 0,
      });

      const result = await service.validateForPromotion('learning-123');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('never been applied');
    });

    it('should warn if effectiveness is low', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        times_applied: 10,
        times_helpful: 3, // 30% effectiveness
      });

      const result = await service.validateForPromotion('learning-123');

      expect(result.warnings.some((w) => w.includes('low effectiveness'))).toBe(
        true,
      );
    });
  });

  describe('promoteLearning', () => {
    it('should promote test learning to production', async () => {
      const productionLearning = {
        ...mockLearning,
        id: 'learning-prod',
        is_test: false,
        is_production: true,
        parent_learning_id: 'learning-123',
      };

      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      learningRepo.createLearning.mockResolvedValue(productionLearning);
      learningRepo.updateLearning.mockResolvedValue({
        ...mockLearning,
        status: 'superseded',
      });

      const result = await service.promoteLearning(
        'learning-123',
        'user-123',
        'Validated successfully',
      );

      expect(result.id).toBe('learning-prod');
      expect(result.is_production).toBe(true);
      expect(result.parent_learning_id).toBe('learning-123');
      expect(learningRepo.createLearning).toHaveBeenCalledWith(
        expect.objectContaining({
          is_test: false,
          is_production: true,
          parent_learning_id: 'learning-123',
        }),
      );
      expect(learningRepo.updateLearning).toHaveBeenCalledWith('learning-123', {
        status: 'superseded',
      });
    });

    it('should throw BadRequestException if validation fails', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        is_production: true,
      });

      await expect(
        service.promoteLearning('learning-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('retireLearning', () => {
    it('should retire active learning', async () => {
      learningRepo.findLearningByIdOrThrow.mockResolvedValue(mockLearning);
      learningRepo.updateLearning.mockResolvedValue({
        ...mockLearning,
        status: 'retired',
      });

      const result = await service.retireLearning(
        'learning-123',
        'user-123',
        'No longer effective',
      );

      expect(result.status).toBe('retired');
      expect(learningRepo.updateLearning).toHaveBeenCalledWith('learning-123', {
        status: 'retired',
      });
    });

    it('should throw ConflictException if already retired', async () => {
      learningRepo.findLearningByIdOrThrow.mockResolvedValue({
        ...mockLearning,
        status: 'retired',
      });

      await expect(
        service.retireLearning('learning-123', 'user-123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getLearningStats', () => {
    it('should calculate learning statistics', async () => {
      const learnings = [
        {
          ...mockLearning,
          is_test: true,
          is_production: false,
          status: 'active' as const,
        },
        {
          ...mockLearning,
          id: 'l2',
          is_test: false,
          is_production: true,
          status: 'active' as const,
        },
        {
          ...mockLearning,
          id: 'l3',
          is_test: true,
          is_production: false,
          status: 'testing' as const,
        },
      ];

      learningRepo.findAllLearnings.mockResolvedValue(learnings);
      learningRepo.countPending.mockResolvedValue(5);

      const stats = await service.getLearningStats();

      expect(stats.totalLearnings).toBe(3);
      expect(stats.testLearnings).toBe(2);
      expect(stats.productionLearnings).toBe(1);
      expect(stats.pendingQueue).toBe(5);
      expect(stats.byType['pattern']).toBe(3);
      expect(stats.byStatus['active']).toBe(2);
    });
  });

  describe('getPendingQueue', () => {
    it('should return pending learning queue items', async () => {
      learningRepo.findPendingQueue.mockResolvedValue([mockPendingView]);

      const result = await service.getPendingQueue();

      expect(result).toEqual([mockPendingView]);
      expect(learningRepo.findPendingQueue).toHaveBeenCalled();
    });
  });

  describe('recordApplication', () => {
    it('should increment times_applied', async () => {
      await service.recordApplication('learning-123');

      expect(learningRepo.incrementApplied).toHaveBeenCalledWith(
        'learning-123',
      );
    });
  });

  describe('recordHelpful', () => {
    it('should increment times_helpful', async () => {
      await service.recordHelpful('learning-123');

      expect(learningRepo.incrementHelpful).toHaveBeenCalledWith(
        'learning-123',
      );
    });
  });
});
