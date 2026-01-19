import { Test, TestingModule } from '@nestjs/testing';
import { StrategyService } from '../strategy.service';
import { StrategyRepository } from '../../repositories/strategy.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import {
  Strategy,
  DEFAULT_STRATEGY_PARAMETERS,
} from '../../interfaces/strategy.interface';
import { Universe } from '../../interfaces/universe.interface';

describe('StrategyService', () => {
  let service: StrategyService;
  let strategyRepository: jest.Mocked<StrategyRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;

  const mockStrategy: Strategy = {
    id: 'strategy-123',
    slug: 'balanced',
    name: 'Balanced Strategy',
    description: 'A balanced approach',
    risk_level: 'medium',
    parameters: {
      min_predictors: 3,
      min_combined_strength: 15,
      min_direction_consensus: 0.6,
      predictor_ttl_hours: 24,
      urgent_threshold: 0.9,
      notable_threshold: 0.7,
    },
    is_system: true,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockUniverse: Universe = {
    id: 'universe-123',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Test Universe',
    description: 'A test universe',
    domain: 'stocks',
    strategy_id: 'strategy-123',
    llm_config: null,
    thresholds: null,
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['push'],
    },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyService,
        {
          provide: StrategyRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            findBySlug: jest.fn(),
            findBySlugOrThrow: jest.fn(),
            findSystemStrategies: jest.fn(),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findByIdOrThrow: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StrategyService>(StrategyService);
    strategyRepository = module.get(StrategyRepository);
    universeRepository = module.get(UniverseRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all strategies', async () => {
      strategyRepository.findAll.mockResolvedValue([mockStrategy]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]!.slug).toBe('balanced');
    });
  });

  describe('findSystemStrategies', () => {
    it('should return only system strategies', async () => {
      strategyRepository.findSystemStrategies.mockResolvedValue([mockStrategy]);

      const result = await service.findSystemStrategies();

      expect(result).toHaveLength(1);
      expect(result[0]!.is_system).toBe(true);
    });
  });

  describe('getAppliedStrategy', () => {
    it('should return strategy with universe having strategy_id', async () => {
      universeRepository.findByIdOrThrow.mockResolvedValue(mockUniverse);
      strategyRepository.findByIdOrThrow.mockResolvedValue(mockStrategy);

      const result = await service.getAppliedStrategy('universe-123');

      expect(result.strategy.slug).toBe('balanced');
      expect(result.effective_parameters.min_predictors).toBe(3);
      expect(result.source).toBe('strategy');
    });

    it('should merge universe thresholds with strategy', async () => {
      const universeWithOverrides = {
        ...mockUniverse,
        thresholds: {
          min_predictors: 5,
          min_combined_strength: 20,
        },
      };
      universeRepository.findByIdOrThrow.mockResolvedValue(
        universeWithOverrides,
      );
      strategyRepository.findByIdOrThrow.mockResolvedValue(mockStrategy);

      const result = await service.getAppliedStrategy('universe-123');

      expect(result.effective_parameters.min_predictors).toBe(5);
      expect(result.effective_parameters.min_combined_strength).toBe(20);
      expect(result.source).toBe('universe');
    });

    it('should use default strategy when universe has no strategy_id', async () => {
      const universeNoStrategy = { ...mockUniverse, strategy_id: null };
      universeRepository.findByIdOrThrow.mockResolvedValue(universeNoStrategy);
      strategyRepository.findBySlug.mockResolvedValue(mockStrategy);

      const result = await service.getAppliedStrategy('universe-123');

      expect(result.strategy.slug).toBe('balanced');
    });

    it('should fall back to defaults when no strategy found', async () => {
      const universeNoStrategy = { ...mockUniverse, strategy_id: null };
      universeRepository.findByIdOrThrow.mockResolvedValue(universeNoStrategy);
      strategyRepository.findBySlug.mockResolvedValue(null);

      const result = await service.getAppliedStrategy('universe-123');

      expect(result.strategy.slug).toBe('default');
      expect(result.effective_parameters).toEqual(
        expect.objectContaining(DEFAULT_STRATEGY_PARAMETERS),
      );
    });
  });

  describe('applyStrategy', () => {
    it('should update universe with strategy_id and thresholds', async () => {
      strategyRepository.findByIdOrThrow.mockResolvedValue(mockStrategy);
      universeRepository.update.mockResolvedValue(mockUniverse);

      await service.applyStrategy('universe-123', 'strategy-123');

      expect(universeRepository.update).toHaveBeenCalledWith(
        'universe-123',
        expect.objectContaining({
          strategy_id: 'strategy-123',
          thresholds: expect.objectContaining({
            min_predictors: 3,
          }),
        }),
      );
    });
  });

  describe('getEffectiveThresholds', () => {
    it('should return threshold values from applied strategy', async () => {
      universeRepository.findByIdOrThrow.mockResolvedValue(mockUniverse);
      strategyRepository.findByIdOrThrow.mockResolvedValue(mockStrategy);

      const result = await service.getEffectiveThresholds('universe-123');

      expect(result.min_predictors).toBe(3);
      expect(result.min_combined_strength).toBe(15);
      expect(result.min_direction_consensus).toBe(0.6);
      expect(result.predictor_ttl_hours).toBe(24);
      expect(result.urgent_threshold).toBe(0.9);
      expect(result.notable_threshold).toBe(0.7);
    });
  });

  describe('compareStrategies', () => {
    it('should return identical=true for same parameters', () => {
      const result = service.compareStrategies(mockStrategy, mockStrategy);

      expect(result.identical).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should return differences when parameters differ', () => {
      const aggressiveStrategy: Strategy = {
        ...mockStrategy,
        slug: 'aggressive',
        parameters: {
          ...mockStrategy.parameters,
          min_predictors: 2,
          min_direction_consensus: 0.5,
        },
      };

      const result = service.compareStrategies(
        mockStrategy,
        aggressiveStrategy,
      );

      expect(result.identical).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(
        result.differences.some((d) => d.parameter === 'min_predictors'),
      ).toBe(true);
    });
  });

  describe('recommendStrategy', () => {
    beforeEach(() => {
      strategyRepository.findSystemStrategies.mockResolvedValue([
        mockStrategy,
        { ...mockStrategy, slug: 'aggressive', name: 'Aggressive' },
        { ...mockStrategy, slug: 'conservative', name: 'Conservative' },
        { ...mockStrategy, slug: 'contrarian', name: 'Contrarian' },
      ]);
    });

    it('should recommend aggressive for crypto', async () => {
      const cryptoUniverse = { ...mockUniverse, domain: 'crypto' as const };
      universeRepository.findByIdOrThrow.mockResolvedValue(cryptoUniverse);

      const result = await service.recommendStrategy('universe-123');

      expect(result.recommended?.slug).toBe('aggressive');
      expect(result.reasoning).toContain('volatile');
    });

    it('should recommend balanced for stocks', async () => {
      const stockUniverse = { ...mockUniverse, domain: 'stocks' as const };
      universeRepository.findByIdOrThrow.mockResolvedValue(stockUniverse);

      const result = await service.recommendStrategy('universe-123');

      expect(result.recommended?.slug).toBe('balanced');
    });

    it('should recommend conservative for elections', async () => {
      const electionUniverse = {
        ...mockUniverse,
        domain: 'elections' as const,
      };
      universeRepository.findByIdOrThrow.mockResolvedValue(electionUniverse);

      const result = await service.recommendStrategy('universe-123');

      expect(result.recommended?.slug).toBe('conservative');
    });

    it('should recommend contrarian for polymarket', async () => {
      const polymarketUniverse = {
        ...mockUniverse,
        domain: 'polymarket' as const,
      };
      universeRepository.findByIdOrThrow.mockResolvedValue(polymarketUniverse);

      const result = await service.recommendStrategy('universe-123');

      expect(result.recommended?.slug).toBe('contrarian');
    });
  });
});
