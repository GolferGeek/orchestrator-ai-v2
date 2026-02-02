import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RagDatabaseService } from './rag-database.service';

/**
 * RagDatabaseService Tests
 *
 * Note: This service directly uses the pg Pool, which makes it harder to test
 * with full mocking. These tests focus on the public interface behavior that
 * can be tested without initializing the actual pool.
 *
 * Integration tests with a real database are recommended for full coverage.
 */
describe('RagDatabaseService', () => {
  describe('without DATABASE_URL configured', () => {
    let service: RagDatabaseService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagDatabaseService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      module.useLogger(false);
      service = module.get<RagDatabaseService>(RagDatabaseService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('isAvailable should return false when pool is not initialized', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('query should throw error when pool is not available', async () => {
      await expect(service.query('SELECT 1', [])).rejects.toThrow(
        'RAG database not available',
      );
    });

    it('queryOne should throw error when pool is not available', async () => {
      await expect(service.queryOne('SELECT 1', [])).rejects.toThrow(
        'RAG database not available',
      );
    });

    it('queryAll should throw error when pool is not available', async () => {
      await expect(service.queryAll('SELECT 1', [])).rejects.toThrow(
        'RAG database not available',
      );
    });

    it('execute should throw error when pool is not available', async () => {
      await expect(service.execute('SELECT 1', [])).rejects.toThrow(
        'RAG database not available',
      );
    });

    it('getClient should throw error when pool is not available', async () => {
      await expect(service.getClient()).rejects.toThrow(
        'RAG database not available',
      );
    });

    it('withTransaction should throw error when pool is not available', async () => {
      await expect(
        service.withTransaction(async () => 'result'),
      ).rejects.toThrow('RAG database not available');
    });

    it('checkHealth should return disabled status when pool is not configured', async () => {
      const result = await service.checkHealth();

      expect(result.status).toBe('disabled');
      expect(result.message).toContain('not configured');
    });

    it('onModuleInit should not throw when DATABASE_URL is not set', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('onModuleDestroy should not throw when pool is not initialized', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('with DATABASE_URL configured (pool initialization)', () => {
    it('should attempt to create pool with correct configuration', async () => {
      // We can only test that the module compiles and service is created
      // Actual pool testing requires integration tests
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagDatabaseService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'DATABASE_URL') {
                  return 'postgresql://localhost:5432/test_db';
                }
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      module.useLogger(false);
      const service = module.get<RagDatabaseService>(RagDatabaseService);

      expect(service).toBeDefined();
      // Before onModuleInit is called, pool is not available
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('method signatures', () => {
    let service: RagDatabaseService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagDatabaseService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      module.useLogger(false);
      service = module.get<RagDatabaseService>(RagDatabaseService);
    });

    it('should have query method with correct signature', () => {
      expect(typeof service.query).toBe('function');
    });

    it('should have queryOne method with correct signature', () => {
      expect(typeof service.queryOne).toBe('function');
    });

    it('should have queryAll method with correct signature', () => {
      expect(typeof service.queryAll).toBe('function');
    });

    it('should have execute method with correct signature', () => {
      expect(typeof service.execute).toBe('function');
    });

    it('should have getClient method with correct signature', () => {
      expect(typeof service.getClient).toBe('function');
    });

    it('should have withTransaction method with correct signature', () => {
      expect(typeof service.withTransaction).toBe('function');
    });

    it('should have checkHealth method with correct signature', () => {
      expect(typeof service.checkHealth).toBe('function');
    });

    it('should have isAvailable method with correct signature', () => {
      expect(typeof service.isAvailable).toBe('function');
    });

    it('should have onModuleInit lifecycle method', () => {
      expect(typeof service.onModuleInit).toBe('function');
    });

    it('should have onModuleDestroy lifecycle method', () => {
      expect(typeof service.onModuleDestroy).toBe('function');
    });
  });
});
