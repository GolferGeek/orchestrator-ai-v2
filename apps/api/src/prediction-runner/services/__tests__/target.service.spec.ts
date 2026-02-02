import { Test, TestingModule } from '@nestjs/testing';
import { TargetService } from '../target.service';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { Target } from '../../interfaces/target.interface';
import { Universe } from '../../interfaces/universe.interface';

describe('TargetService', () => {
  let service: TargetService;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Technology sector leader',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockUniverse: Universe = {
    id: 'universe-123',
    name: 'Tech Stocks',
    description: 'Tech stock universe',
    organization_slug: 'test-org',
    agent_slug: 'prediction-agent',
    domain: 'stocks',
    strategy_id: null,
    is_active: true,
    thresholds: {},
    llm_config: {
      gold: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      silver: { provider: 'openai', model: 'gpt-4' },
      bronze: { provider: 'anthropic', model: 'claude-haiku-4-20250514' },
    },
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['push'],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TargetService,
        {
          provide: TargetRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockTarget),
            findByIdOrThrow: jest.fn().mockResolvedValue(mockTarget),
            findAll: jest.fn().mockResolvedValue([mockTarget]),
            findActiveByUniverse: jest.fn().mockResolvedValue([mockTarget]),
            findBySymbol: jest.fn().mockResolvedValue(mockTarget),
            create: jest.fn().mockResolvedValue(mockTarget),
            update: jest.fn().mockResolvedValue(mockTarget),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findByIdOrThrow: jest.fn().mockResolvedValue(mockUniverse),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TargetService>(TargetService);
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return target by ID', async () => {
      const result = await service.findById('target-123');

      expect(targetRepository.findById).toHaveBeenCalledWith('target-123');
      expect(result).toEqual(mockTarget);
    });

    it('should return null when not found', async () => {
      targetRepository.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return target when found', async () => {
      const result = await service.findByIdOrThrow('target-123');

      expect(targetRepository.findByIdOrThrow).toHaveBeenCalledWith(
        'target-123',
      );
      expect(result).toEqual(mockTarget);
    });
  });

  describe('findByUniverse', () => {
    it('should return all targets for universe', async () => {
      const result = await service.findByUniverse('universe-123');

      expect(targetRepository.findAll).toHaveBeenCalledWith('universe-123');
      expect(result).toEqual([mockTarget]);
    });

    it('should return empty array when no targets', async () => {
      targetRepository.findAll.mockResolvedValue([]);

      const result = await service.findByUniverse('empty-universe');

      expect(result).toEqual([]);
    });
  });

  describe('findActiveByUniverse', () => {
    it('should return only active targets', async () => {
      const result = await service.findActiveByUniverse('universe-123');

      expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
        'universe-123',
      );
      expect(result).toEqual([mockTarget]);
    });
  });

  describe('findBySymbol', () => {
    it('should find target by symbol in universe', async () => {
      const result = await service.findBySymbol('universe-123', 'AAPL');

      expect(targetRepository.findBySymbol).toHaveBeenCalledWith(
        'universe-123',
        'AAPL',
      );
      expect(result).toEqual(mockTarget);
    });

    it('should return null when symbol not found', async () => {
      targetRepository.findBySymbol.mockResolvedValue(null);

      const result = await service.findBySymbol('universe-123', 'UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new target', async () => {
      const createDto = {
        universe_id: 'universe-123',
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        target_type: 'stock' as const,
      };

      const result = await service.create(createDto);

      expect(targetRepository.create).toHaveBeenCalledWith(createDto);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a target', async () => {
      const updateDto = { name: 'Updated Name' };

      const result = await service.update('target-123', updateDto);

      expect(targetRepository.update).toHaveBeenCalledWith(
        'target-123',
        updateDto,
      );
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a target', async () => {
      await service.delete('target-123');

      expect(targetRepository.delete).toHaveBeenCalledWith('target-123');
    });
  });

  describe('getEffectiveLlmConfig', () => {
    it('should return target override when set', async () => {
      const targetWithOverride = {
        ...mockTarget,
        llm_config_override: {
          gold: { provider: 'openai', model: 'gpt-4-turbo' },
          silver: { provider: 'openai', model: 'gpt-4' },
          bronze: { provider: 'openai', model: 'gpt-3.5-turbo' },
        },
      };
      targetRepository.findById.mockResolvedValue(targetWithOverride);

      const result = await service.getEffectiveLlmConfig(targetWithOverride);

      expect(result.gold?.model).toBe('gpt-4-turbo');
      expect(universeRepository.findByIdOrThrow).not.toHaveBeenCalled();
    });

    it('should return universe config when no target override', async () => {
      const result = await service.getEffectiveLlmConfig(mockTarget);

      expect(universeRepository.findByIdOrThrow).toHaveBeenCalledWith(
        'universe-123',
      );
      expect(result).toEqual(mockUniverse.llm_config);
    });

    it('should return system defaults when no universe config', async () => {
      const universeNoConfig = { ...mockUniverse, llm_config: null };
      universeRepository.findByIdOrThrow.mockResolvedValue(universeNoConfig);

      const result = await service.getEffectiveLlmConfig(mockTarget);

      expect(result.gold?.provider).toBe('anthropic');
      expect(result.gold?.model).toBe('claude-sonnet-4-20250514');
      expect(result.silver?.model).toBe('claude-haiku-4-20250514');
      expect(result.bronze?.model).toBe('claude-haiku-4-20250514');
    });
  });
});
