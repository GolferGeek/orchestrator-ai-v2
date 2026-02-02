import { Test, TestingModule } from '@nestjs/testing';
import { DailyMissInvestigationRunner } from '../daily-miss-investigation.runner';
import { MissInvestigationService } from '../../services/miss-investigation.service';
import { SourceResearchService } from '../../services/source-research.service';
import { LearningQueueRepository } from '../../repositories/learning-queue.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { MissInvestigation, DailyInvestigationSummary } from '../../interfaces/miss-investigation.interface';

describe('DailyMissInvestigationRunner', () => {
  let runner: DailyMissInvestigationRunner;
  let missInvestigationService: jest.Mocked<MissInvestigationService>;
  let sourceResearchService: jest.Mocked<SourceResearchService>;
  let learningQueueRepository: jest.Mocked<LearningQueueRepository>;
  let supabaseService: jest.Mocked<SupabaseService>;

  // Mock prediction with minimal required fields
  const mockPrediction = {
    id: 'pred-123',
    target_id: 'target-123',
    predicted_at: '2024-01-15T10:00:00Z',
    outcome_captured_at: '2024-01-16T10:00:00Z',
    entry_price: 100,
    consumedPredictors: [],
  };

  // Mock miss object matching the return type of identifyMisses
  const mockMiss = {
    prediction: mockPrediction,
    missType: 'direction_wrong' as const,
    actualDirection: 'up' as const,
    actualMagnitude: 5,
  };

  const mockInvestigation: MissInvestigation = {
    id: 'inv-123',
    prediction: mockPrediction as unknown as MissInvestigation['prediction'],
    missType: 'direction_wrong',
    investigationLevel: 'predictor',
    predicted: { direction: 'down', magnitude: '3%', confidence: 0.7 },
    actual: { direction: 'up', magnitude: 5 },
    unusedPredictors: [],
    misreadSignals: [],
    suggestedLearning: {
      type: 'pattern',
      title: 'Test Learning',
      description: 'Test description',
      scope: 'target',
      config: {},
      evidence: { missType: 'direction_wrong', investigationLevel: 'predictor', keyFindings: ['Finding 1'] },
    },
    investigatedAt: '2024-01-16T12:00:00Z',
  };

  const mockSummary: DailyInvestigationSummary = {
    date: '2024-01-15',
    totalMisses: 1,
    byType: {
      missed_opportunity: 0,
      direction_wrong: 1,
      magnitude_wrong: 0,
      false_positive: 0,
    },
    byLevel: {
      predictor: 1,
      signal: 0,
      source: 0,
      unpredictable: 0,
    },
    learningsSuggested: 1,
    topSourceGaps: [],
  };

  const createMockSupabaseClient = () => {
    const upsertChain = {
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    };
    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockReturnValue(upsertChain),
        }),
      }),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyMissInvestigationRunner,
        {
          provide: MissInvestigationService,
          useValue: {
            identifyMisses: jest.fn().mockResolvedValue([mockMiss]),
            investigateMiss: jest.fn().mockResolvedValue(mockInvestigation),
            generateDailySummary: jest.fn().mockResolvedValue(mockSummary),
          },
        },
        {
          provide: SourceResearchService,
          useValue: {
            researchMissBatch: jest.fn().mockResolvedValue(new Map()),
            generateSourceLevelLearning: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: LearningQueueRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'queue-123' }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(createMockSupabaseClient()),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    runner = module.get<DailyMissInvestigationRunner>(DailyMissInvestigationRunner);
    missInvestigationService = module.get(MissInvestigationService);
    sourceResearchService = module.get(SourceResearchService);
    learningQueueRepository = module.get(LearningQueueRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runInvestigationForDate', () => {
    it('should run investigation for date', async () => {
      const result = await runner.runInvestigationForDate('2024-01-15');

      expect(result).toEqual(mockSummary);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalledWith('2024-01-15', undefined);
      expect(missInvestigationService.investigateMiss).toHaveBeenCalled();
      expect(missInvestigationService.generateDailySummary).toHaveBeenCalled();
    });

    it('should run investigation with universe filter', async () => {
      const result = await runner.runInvestigationForDate('2024-01-15', 'universe-123');

      expect(result).toEqual(mockSummary);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalledWith('2024-01-15', 'universe-123');
    });

    it('should return null when already running', async () => {
      // Start a run that won't complete immediately
      const firstRun = runner.runInvestigationForDate('2024-01-15');

      // Try to start another run
      const secondRun = await runner.runInvestigationForDate('2024-01-16');

      expect(secondRun).toBeNull();

      // Wait for first run to complete
      await firstRun;
    });

    it('should return early summary when no misses found', async () => {
      missInvestigationService.identifyMisses.mockResolvedValue([]);

      const result = await runner.runInvestigationForDate('2024-01-15');

      expect(result).toEqual({
        date: '2024-01-15',
        totalMisses: 0,
        byType: {
          missed_opportunity: 0,
          direction_wrong: 0,
          magnitude_wrong: 0,
          false_positive: 0,
        },
        byLevel: {
          predictor: 0,
          signal: 0,
          source: 0,
          unpredictable: 0,
        },
        learningsSuggested: 0,
        topSourceGaps: [],
      });
      expect(missInvestigationService.investigateMiss).not.toHaveBeenCalled();
    });

    it('should handle errors from service', async () => {
      missInvestigationService.identifyMisses.mockRejectedValue(new Error('Service failed'));

      await expect(runner.runInvestigationForDate('2024-01-15')).rejects.toThrow('Service failed');
    });

    it('should reset isRunning flag after error', async () => {
      missInvestigationService.identifyMisses.mockRejectedValueOnce(new Error('Service failed'));

      try {
        await runner.runInvestigationForDate('2024-01-15');
      } catch {
        // Ignore error
      }

      // Should be able to run again after error
      missInvestigationService.identifyMisses.mockResolvedValue([]);
      const result = await runner.runInvestigationForDate('2024-01-16');
      expect(result).toBeDefined();
    });

    it('should queue suggested learnings', async () => {
      await runner.runInvestigationForDate('2024-01-15');

      expect(learningQueueRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          suggested_learning_type: 'pattern',
          suggested_title: 'Test Learning',
          status: 'pending',
        }),
      );
    });

    it('should handle learning queue errors gracefully', async () => {
      learningQueueRepository.create.mockRejectedValue(new Error('Queue failed'));

      // Should not throw, just log error
      const result = await runner.runInvestigationForDate('2024-01-15');

      expect(result).toEqual(mockSummary);
    });
  });

  describe('source research', () => {
    it('should research misses at source level', async () => {
      const sourceInvestigation = {
        ...mockInvestigation,
        investigationLevel: 'source' as const,
      };
      missInvestigationService.investigateMiss.mockResolvedValue(sourceInvestigation);

      const researchResult = {
        predictability: 'predictable' as const,
        discoveredDrivers: ['earnings surprise'],
        signalsWeHad: [],
        signalTypesNeeded: ['earnings'],
        suggestedSources: [{ name: 'bloomberg', type: 'news' as const, description: 'Financial news' }],
        reasoning: 'Earnings report was released before market close',
      };
      sourceResearchService.researchMissBatch.mockResolvedValue(
        new Map([[sourceInvestigation.id, researchResult]]),
      );

      await runner.runInvestigationForDate('2024-01-15');

      expect(sourceResearchService.researchMissBatch).toHaveBeenCalled();
    });

    it('should update investigation level for unpredictable events', async () => {
      const sourceInvestigation: MissInvestigation = {
        ...mockInvestigation,
        investigationLevel: 'source',
        suggestedLearning: undefined,
      };
      missInvestigationService.investigateMiss.mockResolvedValue(sourceInvestigation);

      const researchResult = {
        predictability: 'unpredictable' as const,
        discoveredDrivers: ['black swan event'],
        signalsWeHad: [],
        signalTypesNeeded: [],
        suggestedSources: [],
        reasoning: 'This was an unprecedented market event',
      };
      sourceResearchService.researchMissBatch.mockResolvedValue(
        new Map([[sourceInvestigation.id, researchResult]]),
      );

      await runner.runInvestigationForDate('2024-01-15');

      expect(sourceResearchService.researchMissBatch).toHaveBeenCalled();
    });
  });

  describe('manualRun', () => {
    it('should call runInvestigationForDate', async () => {
      const result = await runner.manualRun('2024-01-15');

      expect(result).toEqual(mockSummary);
    });

    it('should pass universe filter', async () => {
      const result = await runner.manualRun('2024-01-15', 'universe-123');

      expect(result).toEqual(mockSummary);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalledWith('2024-01-15', 'universe-123');
    });
  });

  describe('getStatus', () => {
    it('should return isRunning false when idle', () => {
      const status = runner.getStatus();

      expect(status).toEqual({ isRunning: false });
    });

    it('should return isRunning true when running', async () => {
      // Create a controlled promise
      type MissType = (typeof mockMiss)[];
      let resolveService: (value: MissType) => void;
      const servicePromise = new Promise<MissType>((resolve) => {
        resolveService = resolve;
      });
      missInvestigationService.identifyMisses.mockReturnValue(servicePromise as unknown as ReturnType<typeof missInvestigationService.identifyMisses>);

      // Start the run
      const runPromise = runner.runInvestigationForDate('2024-01-15');

      // Check status while running
      expect(runner.getStatus()).toEqual({ isRunning: true });

      // Complete the run
      resolveService!([]);
      await runPromise;

      // Check status after completion
      expect(runner.getStatus()).toEqual({ isRunning: false });
    });
  });

  describe('multiple misses', () => {
    it('should investigate multiple misses', async () => {
      const misses = [
        mockMiss,
        { ...mockMiss, prediction: { ...mockPrediction, id: 'pred-456' } },
      ];
      missInvestigationService.identifyMisses.mockResolvedValue(misses as unknown as Awaited<ReturnType<typeof missInvestigationService.identifyMisses>>);

      await runner.runInvestigationForDate('2024-01-15');

      expect(missInvestigationService.investigateMiss).toHaveBeenCalledTimes(2);
    });
  });

  describe('miss type mapping', () => {
    const missTypes = ['missed_opportunity', 'direction_wrong', 'magnitude_wrong', 'false_positive'] as const;

    missTypes.forEach((missType) => {
      it(`should handle ${missType} miss type`, async () => {
        const missWithType = {
          prediction: mockPrediction,
          missType,
          actualDirection: 'up' as const,
          actualMagnitude: 5,
        };
        missInvestigationService.identifyMisses.mockResolvedValue([missWithType] as unknown as Awaited<ReturnType<typeof missInvestigationService.identifyMisses>>);

        const result = await runner.runInvestigationForDate('2024-01-15');

        expect(result).toBeDefined();
      });
    });
  });
});
