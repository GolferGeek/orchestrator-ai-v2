import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LearningQueueService } from '../learning-queue.service';
import { LearningQueueRepository } from '../../repositories/learning-queue.repository';
import { LearningService } from '../learning.service';
import { LearningQueue } from '../../interfaces/learning.interface';

describe('LearningQueueService', () => {
  let service: LearningQueueService;
  let learningQueueRepository: jest.Mocked<LearningQueueRepository>;
  let learningService: jest.Mocked<LearningService>;

  const mockLearningQueueItem: LearningQueue = {
    id: 'queue-123',
    suggested_scope_level: 'target',
    suggested_domain: 'stocks',
    suggested_universe_id: 'universe-123',
    suggested_target_id: 'target-123',
    suggested_analyst_id: null,
    suggested_learning_type: 'pattern',
    suggested_title: 'Bull flag pattern recognition',
    suggested_description: 'Recognize bull flag patterns in price action',
    suggested_config: { indicators: ['bullFlag', 'volume'] },
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    ai_reasoning: 'This pattern has shown 70% success rate',
    ai_confidence: 0.75,
    status: 'pending',
    reviewed_at: null,
    reviewed_by_user_id: null,
    reviewer_notes: null,
    final_scope_level: null,
    final_domain: null,
    final_universe_id: null,
    final_target_id: null,
    final_analyst_id: null,
    learning_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockLearning = {
    id: 'learning-123',
    scope_level: 'target' as const,
    domain: 'stocks',
    universe_id: 'universe-123',
    target_id: 'target-123',
    analyst_id: null,
    learning_type: 'pattern' as const,
    title: 'Bull flag pattern recognition',
    description: 'Recognize bull flag patterns in price action',
    config: { indicators: ['bullFlag', 'volume'] },
    source_type: 'ai_approved' as const,
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    status: 'active' as const,
    superseded_by: null,
    version: 1,
    times_applied: 0,
    times_helpful: 0,
    is_test: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningQueueService,
        {
          provide: LearningQueueRepository,
          useValue: {
            findPending: jest.fn().mockResolvedValue([mockLearningQueueItem]),
            findByStatus: jest.fn().mockResolvedValue([mockLearningQueueItem]),
            findById: jest.fn().mockResolvedValue(mockLearningQueueItem),
            findByIdOrThrow: jest.fn().mockResolvedValue(mockLearningQueueItem),
            create: jest.fn().mockResolvedValue(mockLearningQueueItem),
            update: jest.fn().mockResolvedValue({ ...mockLearningQueueItem, status: 'approved' }),
            findBySourceEvaluation: jest.fn().mockResolvedValue([mockLearningQueueItem]),
            findBySourceMissedOpportunity: jest.fn().mockResolvedValue([mockLearningQueueItem]),
          },
        },
        {
          provide: LearningService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockLearning),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LearningQueueService>(LearningQueueService);
    learningQueueRepository = module.get(LearningQueueRepository);
    learningService = module.get(LearningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingItems', () => {
    it('should return pending items', async () => {
      const result = await service.getPendingItems();

      expect(learningQueueRepository.findPending).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([mockLearningQueueItem]);
    });

    it('should respect limit parameter', async () => {
      await service.getPendingItems(10);

      expect(learningQueueRepository.findPending).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no pending items', async () => {
      learningQueueRepository.findPending.mockResolvedValue([]);

      const result = await service.getPendingItems();

      expect(result).toEqual([]);
    });
  });

  describe('getItemsByStatus', () => {
    it('should return items by status', async () => {
      const result = await service.getItemsByStatus('pending');

      expect(learningQueueRepository.findByStatus).toHaveBeenCalledWith('pending');
      expect(result).toEqual([mockLearningQueueItem]);
    });

    it('should return approved items', async () => {
      const approvedItem = { ...mockLearningQueueItem, status: 'approved' as const };
      learningQueueRepository.findByStatus.mockResolvedValue([approvedItem]);

      const result = await service.getItemsByStatus('approved');

      expect(learningQueueRepository.findByStatus).toHaveBeenCalledWith('approved');
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('approved');
    });

    it('should return rejected items', async () => {
      learningQueueRepository.findByStatus.mockResolvedValue([]);

      const result = await service.getItemsByStatus('rejected');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return item by ID', async () => {
      const result = await service.findById('queue-123');

      expect(learningQueueRepository.findById).toHaveBeenCalledWith('queue-123');
      expect(result).toEqual(mockLearningQueueItem);
    });

    it('should return null when not found', async () => {
      learningQueueRepository.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return item when found', async () => {
      const result = await service.findByIdOrThrow('queue-123');

      expect(learningQueueRepository.findByIdOrThrow).toHaveBeenCalledWith('queue-123');
      expect(result).toEqual(mockLearningQueueItem);
    });
  });

  describe('createSuggestion', () => {
    it('should create a learning suggestion', async () => {
      const createDto = {
        suggested_scope_level: 'target' as const,
        suggested_learning_type: 'pattern' as const,
        suggested_title: 'New pattern',
        suggested_description: 'Description',
        suggested_config: {},
        ai_reasoning: 'AI reasoning',
        ai_confidence: 0.8,
      };

      const result = await service.createSuggestion(createDto);

      expect(learningQueueRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: 'pending',
      });
      expect(result).toBeDefined();
    });

    it('should set status to pending', async () => {
      const createDto = {
        suggested_scope_level: 'runner' as const,
        suggested_learning_type: 'rule' as const,
        suggested_title: 'New rule',
        suggested_description: 'Description',
        suggested_config: { trigger_condition: 'always' },
        ai_reasoning: 'Based on analysis',
        ai_confidence: 0.9,
      };

      await service.createSuggestion(createDto);

      expect(learningQueueRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  describe('respond', () => {
    it('should handle approve decision and create learning', async () => {
      const reviewDto = {
        status: 'approved' as const,
        reviewer_notes: 'Looks good',
      };

      const result = await service.respond('queue-123', reviewDto, 'user-123');

      expect(learningService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: 'target',
          learning_type: 'pattern',
          title: 'Bull flag pattern recognition',
          source_type: 'ai_approved',
        }),
      );
      expect(learningQueueRepository.update).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          status: 'approved',
          reviewed_by_user_id: 'user-123',
          learning_id: 'learning-123',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should handle modified decision with overrides', async () => {
      const reviewDto = {
        status: 'modified' as const,
        reviewer_notes: 'Changed scope',
        final_scope_level: 'universe' as const,
        final_title: 'Modified title',
      };

      await service.respond('queue-123', reviewDto, 'user-123');

      expect(learningService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: 'universe',
          title: 'Modified title',
        }),
      );
    });

    it('should handle reject decision without creating learning', async () => {
      const reviewDto = {
        status: 'rejected' as const,
        reviewer_notes: 'Not useful',
      };

      await service.respond('queue-123', reviewDto, 'user-123');

      expect(learningService.create).not.toHaveBeenCalled();
      expect(learningQueueRepository.update).toHaveBeenCalledWith(
        'queue-123',
        expect.objectContaining({
          status: 'rejected',
          reviewed_by_user_id: 'user-123',
        }),
      );
    });

    it('should throw BadRequestException for non-pending items', async () => {
      const approvedItem = { ...mockLearningQueueItem, status: 'approved' as const };
      learningQueueRepository.findByIdOrThrow.mockResolvedValue(approvedItem);

      const reviewDto = {
        status: 'approved' as const,
      };

      await expect(service.respond('queue-123', reviewDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use suggested values when no overrides provided', async () => {
      const reviewDto = {
        status: 'approved' as const,
      };

      await service.respond('queue-123', reviewDto, 'user-123');

      expect(learningService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: mockLearningQueueItem.suggested_scope_level,
          domain: mockLearningQueueItem.suggested_domain,
          universe_id: mockLearningQueueItem.suggested_universe_id,
          target_id: mockLearningQueueItem.suggested_target_id,
          title: mockLearningQueueItem.suggested_title,
          description: mockLearningQueueItem.suggested_description,
        }),
      );
    });
  });

  describe('findBySourceEvaluation', () => {
    it('should find items by evaluation ID', async () => {
      const result = await service.findBySourceEvaluation('eval-123');

      expect(learningQueueRepository.findBySourceEvaluation).toHaveBeenCalledWith('eval-123');
      expect(result).toEqual([mockLearningQueueItem]);
    });

    it('should return empty array when no matches', async () => {
      learningQueueRepository.findBySourceEvaluation.mockResolvedValue([]);

      const result = await service.findBySourceEvaluation('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findBySourceMissedOpportunity', () => {
    it('should find items by missed opportunity ID', async () => {
      const result = await service.findBySourceMissedOpportunity('miss-123');

      expect(learningQueueRepository.findBySourceMissedOpportunity).toHaveBeenCalledWith('miss-123');
      expect(result).toEqual([mockLearningQueueItem]);
    });

    it('should return empty array when no matches', async () => {
      learningQueueRepository.findBySourceMissedOpportunity.mockResolvedValue([]);

      const result = await service.findBySourceMissedOpportunity('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
