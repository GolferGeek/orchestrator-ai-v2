import { Test, TestingModule } from '@nestjs/testing';
import { UniverseService } from '../universe.service';
import { UniverseRepository } from '../../repositories/universe.repository';
import { Universe } from '../../interfaces/universe.interface';

describe('UniverseService', () => {
  let service: UniverseService;
  let universeRepository: jest.Mocked<UniverseRepository>;

  const mockUniverse: Universe = {
    id: 'universe-123',
    name: 'Test Universe',
    description: 'Test universe description',
    organization_slug: 'test-org',
    agent_slug: 'prediction-agent',
    domain: 'stocks',
    strategy_id: null,
    is_active: true,
    thresholds: {
      min_predictors: 5,
      min_combined_strength: 20,
    },
    llm_config: null,
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
        UniverseService,
        {
          provide: UniverseRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue([mockUniverse]),
            findById: jest.fn().mockResolvedValue(mockUniverse),
            findByIdOrThrow: jest.fn().mockResolvedValue(mockUniverse),
            create: jest.fn().mockResolvedValue(mockUniverse),
            update: jest.fn().mockResolvedValue(mockUniverse),
            delete: jest.fn().mockResolvedValue(undefined),
            findByAgentSlug: jest.fn().mockResolvedValue([mockUniverse]),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<UniverseService>(UniverseService);
    universeRepository = module.get(UniverseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all universes for an organization', async () => {
      const result = await service.findAll('test-org');

      expect(universeRepository.findAll).toHaveBeenCalledWith('test-org');
      expect(result).toEqual([mockUniverse]);
    });

    it('should return empty array when no universes', async () => {
      universeRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll('empty-org');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return universe by ID', async () => {
      const result = await service.findById('universe-123');

      expect(universeRepository.findById).toHaveBeenCalledWith('universe-123');
      expect(result).toEqual(mockUniverse);
    });

    it('should return null when not found', async () => {
      universeRepository.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return universe when found', async () => {
      const result = await service.findByIdOrThrow('universe-123');

      expect(universeRepository.findByIdOrThrow).toHaveBeenCalledWith(
        'universe-123',
      );
      expect(result).toEqual(mockUniverse);
    });
  });

  describe('create', () => {
    it('should create a new universe', async () => {
      const createDto = {
        name: 'New Universe',
        organization_slug: 'test-org',
        agent_slug: 'agent-1',
        domain: 'stocks' as const,
      };

      const result = await service.create(createDto);

      expect(universeRepository.create).toHaveBeenCalledWith(createDto);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a universe', async () => {
      const updateDto = { name: 'Updated Universe' };

      const result = await service.update('universe-123', updateDto);

      expect(universeRepository.update).toHaveBeenCalledWith(
        'universe-123',
        updateDto,
      );
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a universe', async () => {
      await service.delete('universe-123');

      expect(universeRepository.delete).toHaveBeenCalledWith('universe-123');
    });
  });

  describe('findByAgentSlug', () => {
    it('should find universes by agent slug', async () => {
      const result = await service.findByAgentSlug(
        'prediction-agent',
        'test-org',
      );

      expect(universeRepository.findByAgentSlug).toHaveBeenCalledWith(
        'prediction-agent',
        'test-org',
      );
      expect(result).toEqual([mockUniverse]);
    });
  });

  describe('findByAgent', () => {
    it('should be an alias for findByAgentSlug', async () => {
      const result = await service.findByAgent('prediction-agent', 'test-org');

      expect(universeRepository.findByAgentSlug).toHaveBeenCalledWith(
        'prediction-agent',
        'test-org',
      );
      expect(result).toEqual([mockUniverse]);
    });
  });

  describe('getEffectiveThresholds', () => {
    it('should return merged thresholds with defaults', () => {
      const result = service.getEffectiveThresholds(mockUniverse);

      expect(result.min_predictors).toBe(5); // From universe
      expect(result.min_combined_strength).toBe(20); // From universe
      expect(result.min_direction_consensus).toBe(0.6); // Default
      expect(result.predictor_ttl_hours).toBe(24); // Default
    });

    it('should use all defaults when no thresholds set', () => {
      const universeNoThresholds = { ...mockUniverse, thresholds: null };

      const result = service.getEffectiveThresholds(universeNoThresholds);

      expect(result.min_predictors).toBe(3);
      expect(result.min_combined_strength).toBe(15);
      expect(result.min_direction_consensus).toBe(0.6);
      expect(result.predictor_ttl_hours).toBe(24);
    });

    it('should handle partial thresholds', () => {
      const universePartial = {
        ...mockUniverse,
        thresholds: { min_predictors: 10 },
      };

      const result = service.getEffectiveThresholds(universePartial);

      expect(result.min_predictors).toBe(10); // Override
      expect(result.min_combined_strength).toBe(15); // Default
    });
  });
});
