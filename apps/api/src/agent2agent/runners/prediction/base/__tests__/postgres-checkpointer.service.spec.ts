/**
 * PostgresCheckpointerService Tests
 *
 * Tests for the PostgreSQL checkpointer service that provides
 * LangGraph checkpoint persistence.
 */

import { ConfigService } from '@nestjs/config';
import { PostgresCheckpointerService } from '../postgres-checkpointer.service';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool, PoolClient } from 'pg';

// Mock pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

// Mock PostgresSaver
jest.mock('@langchain/langgraph-checkpoint-postgres', () => ({
  PostgresSaver: {
    fromConnString: jest.fn().mockReturnValue({
      setup: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock saver type for testing
interface MockPostgresSaver {
  setup: jest.Mock;
}

describe('PostgresCheckpointerService', () => {
  let service: PostgresCheckpointerService;
  let configService: ConfigService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;
  let mockSaver: MockPostgresSaver;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock config service
    configService = {
      get: jest.fn((key: string, defaultValue?: string | number) => {
        const config: Record<string, string | number> = {
          DB_HOST: 'localhost',
          DB_PORT: 6012,
          DB_NAME: 'postgres',
          DB_USER: 'postgres',
          DB_PASSWORD: 'postgres',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    // Create service instance
    service = new PostgresCheckpointerService(configService);

    // Get references to mocked instances
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    } as any;
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    // Mock PostgresSaver
    mockSaver = {
      setup: jest.fn().mockResolvedValue(undefined),
    };
    (PostgresSaver.fromConnString as jest.Mock).mockReturnValue(mockSaver);
  });

  afterEach(async () => {
    // Clean up
    await service.onModuleDestroy();
  });

  describe('onModuleInit', () => {
    it('should initialize PostgreSQL pool and checkpointer successfully', async () => {
      await service.onModuleInit();

      // Verify Pool was created with correct config
      expect(Pool).toHaveBeenCalledWith({
        connectionString:
          'postgresql://postgres:postgres@localhost:6012/postgres',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Verify connection was tested
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();

      // Verify PostgresSaver was created and set up
      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        'postgresql://postgres:postgres@localhost:6012/postgres',
      );
      expect(mockSaver.setup).toHaveBeenCalled();

      // Verify service is ready
      expect(service.isReady()).toBe(true);
    });

    it('should use custom config values when provided', async () => {
      const customConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, any> = {
            DB_HOST: 'custom-host',
            DB_PORT: 5432,
            DB_NAME: 'custom-db',
            DB_USER: 'custom-user',
            DB_PASSWORD: 'custom-pass',
          };
          return config[key];
        }),
      } as any;

      const customService = new PostgresCheckpointerService(
        customConfigService,
      );

      await customService.onModuleInit();

      expect(Pool).toHaveBeenCalledWith({
        connectionString:
          'postgresql://custom-user:custom-pass@custom-host:5432/custom-db',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      await customService.onModuleDestroy();
    });

    it('should throw error when connection test fails', async () => {
      (mockClient.query as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      await expect(service.onModuleInit()).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should throw error when PostgresSaver setup fails', async () => {
      mockSaver.setup.mockRejectedValueOnce(
        new Error('Failed to create checkpoint tables'),
      );

      await expect(service.onModuleInit()).rejects.toThrow(
        'Failed to create checkpoint tables',
      );
    });
  });

  describe('getSaver', () => {
    it('should return PostgresSaver instance when initialized', async () => {
      await service.onModuleInit();

      const saver = service.getSaver();

      expect(saver).toBe(mockSaver);
    });

    it('should return same instance on subsequent calls (caching)', async () => {
      await service.onModuleInit();

      const saver1 = service.getSaver();
      const saver2 = service.getSaver();

      expect(saver1).toBe(saver2);
      expect(saver1).toBe(mockSaver);
    });

    it('should throw error when not initialized', () => {
      expect(() => service.getSaver()).toThrow(
        'PostgreSQL checkpointer not initialized',
      );
    });
  });

  describe('getPool', () => {
    it('should return Pool instance when initialized', async () => {
      await service.onModuleInit();

      const pool = service.getPool();

      expect(pool).toBeDefined();
      expect(pool).toHaveProperty('connect');
    });

    it('should throw error when not initialized', () => {
      expect(() => service.getPool()).toThrow(
        'PostgreSQL connection pool not initialized',
      );
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await service.onModuleInit();

      expect(service.isReady()).toBe(true);
    });

    it('should return false after module destroyed', async () => {
      await service.onModuleInit();
      expect(service.isReady()).toBe(true);

      await service.onModuleDestroy();

      expect(service.isReady()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return true when pool is connected', async () => {
      await service.onModuleInit();

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false when pool is not initialized', async () => {
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when pool query fails', async () => {
      await service.onModuleInit();

      // Mock query failure for health check (after init queries)
      (mockClient.query as jest.Mock).mockRejectedValueOnce(
        new Error('Connection lost'),
      );

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should release client even when query fails', async () => {
      await service.onModuleInit();

      (mockClient.query as jest.Mock).mockRejectedValueOnce(
        new Error('Connection lost'),
      );

      await service.healthCheck();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the pool when called', async () => {
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockPool.end).toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
    });

    it('should handle multiple destroy calls gracefully', async () => {
      await service.onModuleInit();

      await service.onModuleDestroy();
      await service.onModuleDestroy();

      // Should only call end once (second call is no-op)
      expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call when not initialized', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
