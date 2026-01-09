import { Test, TestingModule } from '@nestjs/testing';
import { LearningService } from '../learning.service';
import { LearningRepository } from '../../repositories/learning.repository';
import { Learning, ActiveLearning } from '../../interfaces/learning.interface';
import { CreateLearningDto } from '../../dto/learning.dto';

describe('LearningService', () => {
  let service: LearningService;
  let learningRepository: jest.Mocked<LearningRepository>;

  const createMockLearning = (overrides: Partial<Learning> = {}): Learning => ({
    id: `learning-${Math.random().toString(36).substr(2, 9)}`,
    scope_level: 'runner',
    domain: null,
    universe_id: null,
    target_id: null,
    analyst_id: null,
    learning_type: 'rule',
    title: 'Test Learning',
    description: 'Test description',
    config: {},
    source_type: 'human',
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    status: 'active',
    superseded_by: null,
    version: 1,
    times_applied: 0,
    times_helpful: 0,
    created_at: '2026-01-08T12:00:00Z',
    updated_at: '2026-01-08T12:00:00Z',
    ...overrides,
  });

  const createMockActiveLearning = (
    overrides: Partial<ActiveLearning> = {},
  ): ActiveLearning => ({
    learning_id: `learning-${Math.random().toString(36).substr(2, 9)}`,
    learning_type: 'rule',
    title: 'Test Learning',
    description: 'Test description',
    config: {},
    scope_level: 'runner',
    times_applied: 0,
    times_helpful: 0,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningService,
        {
          provide: LearningRepository,
          useValue: {
            getActiveLearnings: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            incrementApplication: jest.fn(),
            supersede: jest.fn(),
            findByScope: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LearningService>(LearningService);
    learningRepository = module.get(LearningRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveLearnings', () => {
    it('should return active learnings for a target', async () => {
      const mockLearnings = [
        createMockActiveLearning({ learning_type: 'rule' }),
        createMockActiveLearning({ learning_type: 'pattern' }),
      ];
      learningRepository.getActiveLearnings.mockResolvedValue(mockLearnings);

      const result = await service.getActiveLearnings('target-123');

      expect(learningRepository.getActiveLearnings).toHaveBeenCalledWith(
        'target-123',
        undefined,
        undefined,
      );
      expect(result).toEqual(mockLearnings);
      expect(result).toHaveLength(2);
    });

    it('should filter by tier when provided', async () => {
      learningRepository.getActiveLearnings.mockResolvedValue([]);

      await service.getActiveLearnings('target-123', 'gold');

      expect(learningRepository.getActiveLearnings).toHaveBeenCalledWith(
        'target-123',
        'gold',
        undefined,
      );
    });

    it('should filter by analyst when provided', async () => {
      learningRepository.getActiveLearnings.mockResolvedValue([]);

      await service.getActiveLearnings('target-123', 'silver', 'analyst-456');

      expect(learningRepository.getActiveLearnings).toHaveBeenCalledWith(
        'target-123',
        'silver',
        'analyst-456',
      );
    });
  });

  describe('findById', () => {
    it('should return learning when found', async () => {
      const mockLearning = createMockLearning();
      learningRepository.findById.mockResolvedValue(mockLearning);

      const result = await service.findById(mockLearning.id);

      expect(result).toEqual(mockLearning);
    });

    it('should return null when not found', async () => {
      learningRepository.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return learning when found', async () => {
      const mockLearning = createMockLearning();
      learningRepository.findByIdOrThrow.mockResolvedValue(mockLearning);

      const result = await service.findByIdOrThrow(mockLearning.id);

      expect(result).toEqual(mockLearning);
    });

    it('should throw when not found', async () => {
      learningRepository.findByIdOrThrow.mockRejectedValue(
        new Error('Learning not found'),
      );

      await expect(service.findByIdOrThrow('nonexistent')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new learning', async () => {
      const dto: CreateLearningDto = {
        scope_level: 'domain',
        domain: 'stocks',
        learning_type: 'rule',
        title: 'New Rule',
        description: 'Always check volume before trading',
        config: {},
        source_type: 'human',
      };
      const mockLearning = createMockLearning(dto);
      learningRepository.create.mockResolvedValue(mockLearning);

      const result = await service.create(dto);

      expect(learningRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockLearning);
    });
  });

  describe('update', () => {
    it('should update an existing learning', async () => {
      const mockLearning = createMockLearning({ title: 'Updated Title' });
      learningRepository.update.mockResolvedValue(mockLearning);

      const result = await service.update('learning-123', {
        title: 'Updated Title',
      });

      expect(learningRepository.update).toHaveBeenCalledWith('learning-123', {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('recordApplication', () => {
    it('should record application without helpfulness', async () => {
      await service.recordApplication('learning-123');

      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-123',
        undefined,
      );
    });

    it('should record application with helpfulness true', async () => {
      await service.recordApplication('learning-123', true);

      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-123',
        true,
      );
    });

    it('should record application with helpfulness false', async () => {
      await service.recordApplication('learning-123', false);

      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-123',
        false,
      );
    });
  });

  describe('supersede', () => {
    it('should supersede old learning with new version', async () => {
      const oldLearning = createMockLearning({ id: 'old-123', version: 1 });
      const newLearningDto: CreateLearningDto = {
        scope_level: 'runner',
        learning_type: 'rule',
        title: 'Updated Rule',
        description: 'New description',
        config: {},
        source_type: 'human',
      };
      const newLearning = createMockLearning({
        id: 'new-456',
        version: 2,
        ...newLearningDto,
      });

      learningRepository.findByIdOrThrow.mockResolvedValue(oldLearning);
      learningRepository.create.mockResolvedValue(newLearning);
      learningRepository.supersede.mockResolvedValue(oldLearning);

      const result = await service.supersede('old-123', newLearningDto);

      expect(learningRepository.findByIdOrThrow).toHaveBeenCalledWith(
        'old-123',
      );
      expect(learningRepository.create).toHaveBeenCalledWith({
        ...newLearningDto,
        version: 2,
      });
      expect(learningRepository.supersede).toHaveBeenCalledWith(
        'old-123',
        'new-456',
      );
      expect(result.id).toBe('new-456');
    });
  });

  describe('findByScope', () => {
    it('should find learnings by scope level', async () => {
      const mockLearnings = [
        createMockLearning({ scope_level: 'domain', domain: 'stocks' }),
      ];
      learningRepository.findByScope.mockResolvedValue(mockLearnings);

      const result = await service.findByScope('domain', 'stocks');

      expect(learningRepository.findByScope).toHaveBeenCalledWith(
        'domain',
        'stocks',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockLearnings);
    });

    it('should filter by status when provided', async () => {
      learningRepository.findByScope.mockResolvedValue([]);

      await service.findByScope(
        'runner',
        undefined,
        undefined,
        undefined,
        'active',
      );

      expect(learningRepository.findByScope).toHaveBeenCalledWith(
        'runner',
        undefined,
        undefined,
        undefined,
        'active',
      );
    });
  });

  describe('applyLearningsToPrompt', () => {
    const emptyContext = { rules: [], patterns: [], avoids: [] };

    it('should return empty for no learnings', () => {
      const result = service.applyLearningsToPrompt([], emptyContext);

      expect(result.appliedIds).toEqual([]);
      expect(result.effect.rules).toEqual([]);
      expect(result.effect.patterns).toEqual([]);
      expect(result.effect.avoids).toEqual([]);
    });

    it('should apply rule learnings', () => {
      const learnings = [
        createMockActiveLearning({
          learning_id: 'rule-1',
          learning_type: 'rule',
          title: 'Volume Rule',
          description: 'Check volume before trading',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, emptyContext);

      expect(result.appliedIds).toContain('rule-1');
      expect(result.effect.rules).toHaveLength(1);
      expect(result.effect.rules[0]).toContain('Volume Rule');
      expect(result.effect.rules[0]).toContain('Check volume before trading');
    });

    it('should apply pattern learnings', () => {
      const learnings = [
        createMockActiveLearning({
          learning_id: 'pattern-1',
          learning_type: 'pattern',
          title: 'Morning Pattern',
          description: 'Stocks tend to gap up on Mondays',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, emptyContext);

      expect(result.appliedIds).toContain('pattern-1');
      expect(result.effect.patterns).toHaveLength(1);
      expect(result.effect.patterns[0]).toContain('Morning Pattern');
    });

    it('should apply avoid learnings', () => {
      const learnings = [
        createMockActiveLearning({
          learning_id: 'avoid-1',
          learning_type: 'avoid',
          title: 'Avoid Low Volume',
          description: 'Do not trade when volume is below 100K',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, emptyContext);

      expect(result.appliedIds).toContain('avoid-1');
      expect(result.effect.avoids).toHaveLength(1);
      expect(result.effect.avoids[0]).toContain('Avoid Low Volume');
    });

    it('should preserve existing context', () => {
      const existingContext = {
        rules: ['Existing rule'],
        patterns: ['Existing pattern'],
        avoids: ['Existing avoid'],
      };
      const learnings = [
        createMockActiveLearning({
          learning_id: 'new-1',
          learning_type: 'rule',
          title: 'New Rule',
          description: 'New description',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, existingContext);

      expect(result.effect.rules).toHaveLength(2);
      expect(result.effect.rules[0]).toBe('Existing rule');
      expect(result.effect.patterns).toEqual(['Existing pattern']);
      expect(result.effect.avoids).toEqual(['Existing avoid']);
    });

    it('should skip weight_adjustment and threshold types', () => {
      const learnings: ActiveLearning[] = [
        createMockActiveLearning({
          learning_id: 'weight-1',
          learning_type: 'weight_adjustment',
          title: 'Weight Adjustment',
          description: 'Adjust analyst weight',
        }),
        createMockActiveLearning({
          learning_id: 'threshold-1',
          learning_type: 'threshold',
          title: 'Threshold Adjustment',
          description: 'Adjust threshold',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, emptyContext);

      expect(result.appliedIds).toContain('weight-1');
      expect(result.appliedIds).toContain('threshold-1');
      expect(result.effect.rules).toEqual([]);
      expect(result.effect.patterns).toEqual([]);
      expect(result.effect.avoids).toEqual([]);
    });

    it('should handle multiple learnings of different types', () => {
      const learnings: ActiveLearning[] = [
        createMockActiveLearning({
          learning_id: 'rule-1',
          learning_type: 'rule',
          title: 'Rule 1',
          description: 'Rule desc',
        }),
        createMockActiveLearning({
          learning_id: 'pattern-1',
          learning_type: 'pattern',
          title: 'Pattern 1',
          description: 'Pattern desc',
        }),
        createMockActiveLearning({
          learning_id: 'avoid-1',
          learning_type: 'avoid',
          title: 'Avoid 1',
          description: 'Avoid desc',
        }),
        createMockActiveLearning({
          learning_id: 'rule-2',
          learning_type: 'rule',
          title: 'Rule 2',
          description: 'Rule 2 desc',
        }),
      ];

      const result = service.applyLearningsToPrompt(learnings, emptyContext);

      expect(result.appliedIds).toHaveLength(4);
      expect(result.effect.rules).toHaveLength(2);
      expect(result.effect.patterns).toHaveLength(1);
      expect(result.effect.avoids).toHaveLength(1);
    });
  });
});
