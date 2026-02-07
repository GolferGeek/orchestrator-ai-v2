import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReviewQueueService, ReviewQueueItem } from '../review-queue.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { SignalRepository } from '../../repositories/signal.repository';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { LearningQueueService } from '../learning-queue.service';
import { Signal } from '../../interfaces/signal.interface';

describe('ReviewQueueService', () => {
  let service: ReviewQueueService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let signalRepository: jest.Mocked<SignalRepository>;
  let _predictorRepository: jest.Mocked<PredictorRepository>;
  let learningQueueService: jest.Mocked<LearningQueueService>;

  const mockReviewItem: ReviewQueueItem = {
    id: 'review-123',
    signal_id: 'signal-123',
    target_id: 'target-123',
    confidence: 0.55,
    recommended_action: 'approve',
    assessment_summary: 'Moderate bullish signal',
    analyst_reasoning: 'Based on technical analysis',
    status: 'pending',
    decision: null,
    decided_by: null,
    decided_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSignal: Signal = {
    id: 'signal-123',
    source_id: 'source-123',
    target_id: 'target-123',
    url: 'https://example.com/article',
    content: 'Test content',
    direction: 'bullish',
    urgency: 'notable',
    metadata: {},
    detected_at: new Date().toISOString(),
    expired_at: null,
    disposition: 'review_pending',
    processing_worker: null,
    processing_started_at: null,
    review_queue_id: 'review-123',
    evaluation_result: {
      confidence: 0.55,
      analyst_slug: 'test-analyst',
      reasoning: 'Analyst evaluation',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_test: false,
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const defaultResult = { data: mockReviewItem, error: null };

    const createChain = () => {
      const chain: Record<string, jest.Mock> = {};
      chain.single = jest
        .fn()
        .mockResolvedValue(overrides?.single ?? defaultResult);
      chain.order = jest.fn().mockImplementation(() => ({
        ...chain,
        eq: jest.fn().mockReturnValue(chain),
        then: (resolve: (v: unknown) => void) =>
          resolve(overrides?.order ?? { data: [mockReviewItem], error: null }),
      }));
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockReturnValue(chain);
      chain.update = jest.fn().mockReturnValue(chain);
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
        ReviewQueueService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: SignalRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockSignal),
            update: jest.fn().mockResolvedValue(mockSignal),
          },
        },
        {
          provide: PredictorRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'predictor-123' }),
          },
        },
        {
          provide: LearningQueueService,
          useValue: {
            createSuggestion: jest
              .fn()
              .mockResolvedValue({ id: 'learning-123' }),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<ReviewQueueService>(ReviewQueueService);
    supabaseService = module.get(SupabaseService);
    signalRepository = module.get(SignalRepository);
    _predictorRepository = module.get(PredictorRepository);
    learningQueueService = module.get(LearningQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldQueueForReview', () => {
    it('should return true for confidence 0.4', () => {
      expect(service.shouldQueueForReview(0.4)).toBe(true);
    });

    it('should return true for confidence 0.55', () => {
      expect(service.shouldQueueForReview(0.55)).toBe(true);
    });

    it('should return true for confidence 0.7', () => {
      expect(service.shouldQueueForReview(0.7)).toBe(true);
    });

    it('should return false for confidence below 0.4', () => {
      expect(service.shouldQueueForReview(0.39)).toBe(false);
      expect(service.shouldQueueForReview(0.2)).toBe(false);
    });

    it('should return false for confidence above 0.7', () => {
      expect(service.shouldQueueForReview(0.71)).toBe(false);
      expect(service.shouldQueueForReview(0.9)).toBe(false);
    });
  });

  describe('queueForReview', () => {
    it('should create review queue item', async () => {
      const createDto = {
        signal_id: 'signal-123',
        target_id: 'target-123',
        confidence: 0.55,
        recommended_action: 'approve' as const,
        assessment_summary: 'Test assessment',
      };

      const result = await service.queueForReview(createDto);

      expect(result).toBeDefined();
      expect(signalRepository.update).toHaveBeenCalledWith(
        'signal-123',
        expect.objectContaining({
          disposition: 'review_pending',
        }),
      );
    });

    it('should include analyst reasoning when provided', async () => {
      const createDto = {
        signal_id: 'signal-123',
        target_id: 'target-123',
        confidence: 0.55,
        recommended_action: 'approve' as const,
        assessment_summary: 'Test assessment',
        analyst_reasoning: 'Detailed reasoning',
      };

      await service.queueForReview(createDto);

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getPendingReviews', () => {
    it('should return pending review items', async () => {
      const result = await service.getPendingReviews();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by target when provided', async () => {
      await service.getPendingReviews('target-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getReviewItem', () => {
    it('should return review item by ID', async () => {
      const result = await service.getReviewItem('review-123');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getReviewItem('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('handleReviewResponse', () => {
    it('should handle approve decision', async () => {
      const response = {
        review_id: 'review-123',
        decision: 'approve' as const,
      };

      const result = await service.handleReviewResponse(response);

      expect(result.predictor).toBeDefined();
      expect(signalRepository.update).toHaveBeenCalledWith(
        'signal-123',
        expect.objectContaining({ disposition: 'predictor_created' }),
      );
    });

    it('should handle modify decision with strength override', async () => {
      const response = {
        review_id: 'review-123',
        decision: 'modify' as const,
        strength_override: 8,
      };

      const result = await service.handleReviewResponse(response);

      expect(result.predictor).toBeDefined();
    });

    it('should handle reject decision', async () => {
      const response = {
        review_id: 'review-123',
        decision: 'reject' as const,
      };

      const result = await service.handleReviewResponse(response);

      expect(result.predictor).toBeUndefined();
      expect(signalRepository.update).toHaveBeenCalledWith(
        'signal-123',
        expect.objectContaining({ disposition: 'rejected' }),
      );
    });

    it('should create learning suggestion when note provided', async () => {
      const response = {
        review_id: 'review-123',
        decision: 'approve' as const,
        learning_note: 'This pattern should be recognized',
      };

      const result = await service.handleReviewResponse(response);

      expect(result.learning).toBeDefined();
      expect(learningQueueService.createSuggestion).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent review', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        service.handleReviewResponse({
          review_id: 'nonexistent',
          decision: 'approve',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already resolved review', async () => {
      const resolvedReview = { ...mockReviewItem, status: 'resolved' as const };
      const mockClient = createMockClient({
        single: { data: resolvedReview, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        service.handleReviewResponse({
          review_id: 'review-123',
          decision: 'approve',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when signal not found', async () => {
      signalRepository.findById.mockResolvedValue(null);

      await expect(
        service.handleReviewResponse({
          review_id: 'review-123',
          decision: 'approve',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
