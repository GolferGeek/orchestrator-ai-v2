import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Define mock factories that will be used by jest.mock
const mockClient = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  end: jest.fn().mockResolvedValue(undefined),
};

const mockSaver = {
  setup: jest.fn().mockResolvedValue(undefined),
};

// Mock pg BEFORE importing the service
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => mockPool),
  };
});

// Mock PostgresSaver BEFORE importing the service
jest.mock('@langchain/langgraph-checkpoint-postgres', () => {
  return {
    PostgresSaver: {
      fromConnString: jest.fn(() => mockSaver),
    },
  };
});

// Import AFTER mocking
import { PostgresCheckpointerService } from './postgres-checkpointer.service';

/**
 * Unit tests for PostgresCheckpointerService
 *
 * Tests the PostgreSQL checkpointer service that provides
 * checkpoint persistence for LangGraph workflows.
 */
describe('PostgresCheckpointerService', () => {
  let service: PostgresCheckpointerService;
  let configService: jest.Mocked<ConfigService>;

  const defaultConfig: Record<string, string | number> = {
    DB_HOST: 'localhost',
    DB_PORT: 6012,
    DB_NAME: 'postgres',
    DB_USER: 'postgres',
    DB_PASSWORD: 'postgres',
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementations to defaults
    mockClient.query.mockResolvedValue({ rows: [] });
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue(undefined);
    mockSaver.setup.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostgresCheckpointerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => defaultConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<PostgresCheckpointerService>(PostgresCheckpointerService);
    configService = module.get(ConfigService);
  });

  afterEach(async () => {
    // Clean up by calling onModuleDestroy if the service was initialized
    if (service.isReady()) {
      await service.onModuleDestroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize the checkpointer successfully', async () => {
      await service.onModuleInit();

      expect(service.isReady()).toBe(true);
    });

    it('should build connection string from config', async () => {
      await service.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('DB_HOST');
      expect(configService.get).toHaveBeenCalledWith('DB_PORT');
      expect(configService.get).toHaveBeenCalledWith('DB_NAME');
      expect(configService.get).toHaveBeenCalledWith('DB_USER');
      expect(configService.get).toHaveBeenCalledWith('DB_PASSWORD');
    });

    it('should use default values when config is not provided', async () => {
      // Reset config to return undefined
      configService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      // Should still initialize with defaults
      expect(service.isReady()).toBe(true);
    });

    it('should create PostgresSaver from connection string', async () => {
      const { PostgresSaver } = require('@langchain/langgraph-checkpoint-postgres');

      await service.onModuleInit();

      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        expect.stringContaining('postgresql://'),
      );
    });

    it('should call setup on PostgresSaver', async () => {
      await service.onModuleInit();

      expect(mockSaver.setup).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the connection pool', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockPool.end).toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
    });

    it('should handle being called when not initialized', async () => {
      // Should not throw when pool is null
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('getSaver', () => {
    it('should return PostgresSaver when initialized', async () => {
      await service.onModuleInit();

      const saver = service.getSaver();

      expect(saver).toBeDefined();
      expect(saver.setup).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => service.getSaver()).toThrow(
        'PostgreSQL checkpointer not initialized',
      );
    });
  });

  describe('getPool', () => {
    it('should return Pool when initialized', async () => {
      await service.onModuleInit();

      const pool = service.getPool();

      expect(pool).toBeDefined();
      expect(pool.connect).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => service.getPool()).toThrow(
        'PostgreSQL connection pool not initialized',
      );
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.onModuleInit();

      expect(service.isReady()).toBe(true);
    });

    it('should return false after destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(service.isReady()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return true when connection is healthy', async () => {
      await service.onModuleInit();

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when not initialized', async () => {
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when query fails', async () => {
      await service.onModuleInit();

      // Mock failure on health check query
      mockClient.query.mockRejectedValueOnce(new Error('Connection error'));

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when pool connection fails', async () => {
      // Make connect fail
      mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.onModuleInit()).rejects.toThrow('Connection refused');
    });

    it('should throw error when setup fails', async () => {
      // Make setup fail
      mockSaver.setup.mockRejectedValueOnce(new Error('Setup failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Setup failed');
    });
  });
});
