import { Test, TestingModule } from '@nestjs/testing';
import { MissedOpportunityScannerRunner } from '../missed-opportunity-scanner.runner';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { MissedOpportunityDetectionService } from '../../services/missed-opportunity-detection.service';
import { MissedOpportunityAnalysisService } from '../../services/missed-opportunity-analysis.service';
import { MissedOpportunity } from '../../interfaces/missed-opportunity.interface';

describe('MissedOpportunityScannerRunner', () => {
  let runner: MissedOpportunityScannerRunner;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;
  let missedOpportunityDetectionService: jest.Mocked<MissedOpportunityDetectionService>;
  let missedOpportunityAnalysisService: jest.Mocked<MissedOpportunityAnalysisService>;

  const mockUniverse = {
    id: 'universe-1',
    name: 'Test Universe',
    domain: 'stocks',
    organization_slug: 'test-org',
    agent_slug: 'test-agent',
    strategy_id: null,
    config: {},
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTarget = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Apple technology company',
    config: {},
    is_active: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockMissedOpportunity: MissedOpportunity = {
    id: 'miss-1',
    target_id: 'target-1',
    detected_at: new Date().toISOString(),
    move_start: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    move_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    move_direction: 'up',
    move_percentage: 8.5,
    significance_score: 0.7,
    analysis_status: 'pending',
    discovered_drivers: [],
    source_gaps: [],
    suggested_learnings: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedOpportunityScannerRunner,
        {
          provide: TargetRepository,
          useValue: {
            findActiveByUniverse: jest.fn(),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
        {
          provide: MissedOpportunityDetectionService,
          useValue: {
            detectMissedOpportunities: jest.fn(),
          },
        },
        {
          provide: MissedOpportunityAnalysisService,
          useValue: {
            analyzeMissedOpportunity: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<MissedOpportunityScannerRunner>(
      MissedOpportunityScannerRunner,
    );
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);
    missedOpportunityDetectionService = module.get(
      MissedOpportunityDetectionService,
    );
    missedOpportunityAnalysisService = module.get(
      MissedOpportunityAnalysisService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runScan', () => {
    it('should detect and analyze missed opportunities', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      missedOpportunityDetectionService.detectMissedOpportunities.mockResolvedValue(
        [mockMissedOpportunity],
      );
      missedOpportunityAnalysisService.analyzeMissedOpportunity.mockResolvedValue(
        {
          missedOpportunityId: 'miss-1',
          discoveredDrivers: [],
          signalsWeHad: [],
          signalGaps: [],
          sourceGaps: [],
          suggestedLearnings: [],
          toolSuggestions: [],
        } as never,
      );

      const result = await runner.runScan();

      expect(result.targetsScanned).toBe(1);
      expect(result.missesDetected).toBe(1);
      expect(result.analysesTriggered).toBe(1);
      expect(
        missedOpportunityAnalysisService.analyzeMissedOpportunity,
      ).toHaveBeenCalledWith('miss-1', expect.any(Object));
    });

    it('should handle no missed opportunities', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      missedOpportunityDetectionService.detectMissedOpportunities.mockResolvedValue(
        [],
      );

      const result = await runner.runScan();

      expect(result.targetsScanned).toBe(1);
      expect(result.missesDetected).toBe(0);
      expect(result.analysesTriggered).toBe(0);
    });

    it('should handle detection errors gracefully', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      missedOpportunityDetectionService.detectMissedOpportunities.mockRejectedValue(
        new Error('Detection failed'),
      );

      const result = await runner.runScan();

      expect(result.targetsScanned).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should continue scanning other targets on analysis failure', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      missedOpportunityDetectionService.detectMissedOpportunities.mockResolvedValue(
        [mockMissedOpportunity],
      );
      missedOpportunityAnalysisService.analyzeMissedOpportunity.mockRejectedValue(
        new Error('Analysis failed'),
      );

      const result = await runner.runScan();

      expect(result.missesDetected).toBe(1);
      expect(result.analysesTriggered).toBe(0);
    });
  });

  describe('scanTargetManually', () => {
    it('should scan a specific target for missed opportunities', async () => {
      missedOpportunityDetectionService.detectMissedOpportunities.mockResolvedValue(
        [mockMissedOpportunity],
      );

      const result = await runner.scanTargetManually('target-1', {
        lookback_hours: 48,
        min_move_percentage: 5.0,
      });

      expect(result.missesDetected).toBe(1);
      expect(result.misses).toHaveLength(1);
    });

    it('should handle errors', async () => {
      missedOpportunityDetectionService.detectMissedOpportunities.mockRejectedValue(
        new Error('Scan failed'),
      );

      const result = await runner.scanTargetManually('target-1');

      expect(result.missesDetected).toBe(0);
      expect(result.error).toBe('Scan failed');
    });
  });

  describe('analyzeManually', () => {
    it('should analyze a specific missed opportunity', async () => {
      missedOpportunityAnalysisService.analyzeMissedOpportunity.mockResolvedValue(
        {
          missedOpportunityId: 'miss-1',
          discoveredDrivers: [],
          signalsWeHad: [],
          signalGaps: [],
          sourceGaps: [],
          suggestedLearnings: [],
          toolSuggestions: [],
        } as never,
      );

      const result = await runner.analyzeManually('miss-1');

      expect(result.success).toBe(true);
    });

    it('should handle analysis errors', async () => {
      missedOpportunityAnalysisService.analyzeMissedOpportunity.mockRejectedValue(
        new Error('Analysis failed'),
      );

      const result = await runner.analyzeManually('miss-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analysis failed');
    });
  });
});
