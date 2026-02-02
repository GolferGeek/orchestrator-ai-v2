import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import { TestArticleService } from '../test-article.service';
import {
  TestArticleRepository,
  TestArticle,
} from '../../repositories/test-article.repository';
import { TestAuditLogRepository } from '../../repositories/test-audit-log.repository';
import { SignalDetectionService } from '../signal-detection.service';
import { SignalRepository } from '../../repositories/signal.repository';
import { TargetRepository } from '../../repositories/target.repository';

describe('TestArticleService', () => {
  let service: TestArticleService;
  let testArticleRepository: jest.Mocked<TestArticleRepository>;
  let testAuditLogRepository: jest.Mocked<TestAuditLogRepository>;
  let signalDetectionService: jest.Mocked<SignalDetectionService>;
  let signalRepository: jest.Mocked<SignalRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'anthropic',
    model: 'claude-sonnet',
  });

  const mockTestArticle: TestArticle = {
    id: 'article-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    title: 'Bull Flag Pattern Detected on T_AAPL',
    content:
      'Strong momentum indicators suggest an upward move for T_AAPL stock.',
    source_name: 'Test News Source',
    published_at: new Date().toISOString(),
    target_symbols: ['T_AAPL'],
    sentiment_expected: 'positive',
    strength_expected: 0.8,
    is_synthetic: true,
    synthetic_marker: '[SYNTHETIC TEST CONTENT]',
    processed: false,
    processed_at: null,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestArticleService,
        {
          provide: TestArticleRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockTestArticle),
            bulkCreate: jest.fn().mockResolvedValue([mockTestArticle]),
            findById: jest.fn().mockResolvedValue(mockTestArticle),
            findByScenario: jest.fn().mockResolvedValue([mockTestArticle]),
            findByTargetSymbol: jest.fn().mockResolvedValue([mockTestArticle]),
            findUnprocessed: jest.fn().mockResolvedValue([mockTestArticle]),
            markProcessed: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(mockTestArticle),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TestAuditLogRepository,
          useValue: {
            log: jest.fn().mockResolvedValue({ id: 'audit-123' }),
          },
        },
        {
          provide: SignalDetectionService,
          useValue: {
            processSignal: jest
              .fn()
              .mockResolvedValue({ shouldCreatePredictor: true }),
          },
        },
        {
          provide: SignalRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'signal-123' }),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findBySymbol: jest
              .fn()
              .mockResolvedValue({ id: 'target-123', symbol: 'T_AAPL' }),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestArticleService>(TestArticleService);
    testArticleRepository = module.get(TestArticleRepository);
    testAuditLogRepository = module.get(TestAuditLogRepository);
    signalDetectionService = module.get(SignalDetectionService);
    signalRepository = module.get(SignalRepository);
    targetRepository = module.get(TargetRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createArticle', () => {
    it('should create a test article', async () => {
      const createData = {
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'Test Article',
        content: 'Test content',
        published_at: new Date().toISOString(),
        target_symbols: ['T_AAPL'],
        is_synthetic: true,
      };

      const result = await service.createArticle(createData, 'user-123');

      expect(testArticleRepository.create).toHaveBeenCalled();
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'article_created',
          resource_type: 'test_article',
        }),
      );
      expect(result).toEqual(mockTestArticle);
    });

    it('should throw error for invalid target symbols (INV-08)', async () => {
      const createData = {
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'Test Article',
        content: 'Test content',
        published_at: new Date().toISOString(),
        target_symbols: ['AAPL'], // Missing T_ prefix
        is_synthetic: true,
      };

      await expect(
        service.createArticle(createData, 'user-123'),
      ).rejects.toThrow('must start with T_ prefix');
    });

    it('should set default synthetic marker', async () => {
      const createData = {
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'Test Article',
        content: 'Test content',
        published_at: new Date().toISOString(),
        target_symbols: ['T_AAPL'],
        is_synthetic: true,
      };

      await service.createArticle(createData, 'user-123');

      expect(testArticleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          synthetic_marker: '[SYNTHETIC TEST CONTENT]',
        }),
      );
    });
  });

  describe('bulkCreateArticles', () => {
    it('should bulk create articles', async () => {
      const articles = [
        {
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
          title: 'Article 1',
          content: 'Content 1',
          published_at: new Date().toISOString(),
          target_symbols: ['T_AAPL'],
          is_synthetic: true,
        },
        {
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
          title: 'Article 2',
          content: 'Content 2',
          published_at: new Date().toISOString(),
          target_symbols: ['T_MSFT'],
          is_synthetic: true,
        },
      ];

      const result = await service.bulkCreateArticles(articles, 'user-123');

      expect(testArticleRepository.bulkCreate).toHaveBeenCalled();
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'article_generated',
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.bulkCreateArticles([], 'user-123');

      expect(result).toEqual([]);
      expect(testArticleRepository.bulkCreate).not.toHaveBeenCalled();
    });

    it('should throw error if any article has invalid target symbols', async () => {
      const articles = [
        {
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
          title: 'Article 1',
          content: 'Content 1',
          published_at: new Date().toISOString(),
          target_symbols: ['T_AAPL'],
          is_synthetic: true,
        },
        {
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
          title: 'Article 2',
          content: 'Content 2',
          published_at: new Date().toISOString(),
          target_symbols: ['INVALID'], // Missing T_ prefix
          is_synthetic: true,
        },
      ];

      await expect(
        service.bulkCreateArticles(articles, 'user-123'),
      ).rejects.toThrow('must start with T_ prefix');
    });
  });

  describe('processArticle', () => {
    it('should process article and create signals', async () => {
      const result = await service.processArticle(
        'article-123',
        mockExecutionContext,
      );

      expect(testArticleRepository.findById).toHaveBeenCalledWith(
        'article-123',
      );
      expect(targetRepository.findBySymbol).toHaveBeenCalled();
      expect(signalRepository.create).toHaveBeenCalled();
      expect(signalDetectionService.processSignal).toHaveBeenCalled();
      expect(testArticleRepository.markProcessed).toHaveBeenCalledWith(
        'article-123',
      );
      expect(result.success).toBe(true);
      expect(result.signalsCreated).toBe(1);
    });

    it('should throw error for non-existent article', async () => {
      testArticleRepository.findById.mockResolvedValue(null);

      await expect(
        service.processArticle('nonexistent', mockExecutionContext),
      ).rejects.toThrow('Test article not found');
    });

    it('should skip already processed articles', async () => {
      testArticleRepository.findById.mockResolvedValue({
        ...mockTestArticle,
        processed: true,
      });

      const result = await service.processArticle(
        'article-123',
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.signalsCreated).toBe(0);
      expect(result.errors).toContain('Article already processed');
      expect(signalRepository.create).not.toHaveBeenCalled();
    });

    it('should handle target not found error', async () => {
      targetRepository.findBySymbol.mockResolvedValue(null);

      const result = await service.processArticle(
        'article-123',
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Target not found for symbol: T_AAPL');
    });

    it('should log audit entry after processing', async () => {
      await service.processArticle('article-123', mockExecutionContext);

      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'article_updated',
          details: expect.objectContaining({
            processed: true,
          }),
        }),
      );
    });
  });

  describe('validateArticle', () => {
    it('should validate valid article', () => {
      const result = service.validateArticle(mockTestArticle);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject article without T_ prefix in target symbols', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        target_symbols: ['AAPL', 'MSFT'],
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Target symbol "AAPL" must start with T_ prefix (INV-08)',
      );
      expect(result.errors).toContain(
        'Target symbol "MSFT" must start with T_ prefix (INV-08)',
      );
    });

    it('should reject article without is_synthetic flag', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        is_synthetic: false,
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Test articles must have is_synthetic=true',
      );
    });

    it('should reject article without title', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        title: '',
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject article without content', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        content: '',
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content is required');
    });

    it('should reject article with invalid sentiment', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        sentiment_expected: 'invalid' as 'positive',
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Invalid sentiment_expected')),
      ).toBe(true);
    });

    it('should reject article with strength out of range', () => {
      const invalidArticle: TestArticle = {
        ...mockTestArticle,
        strength_expected: 1.5,
      };

      const result = service.validateArticle(invalidArticle);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Invalid strength_expected')),
      ).toBe(true);
    });

    it('should warn when no target symbols specified', () => {
      const articleWithNoSymbols: TestArticle = {
        ...mockTestArticle,
        target_symbols: [],
      };

      const result = service.validateArticle(articleWithNoSymbols);

      expect(result.warnings).toContain('No target symbols specified');
    });

    it('should warn when no synthetic marker specified', () => {
      const articleWithNoMarker: TestArticle = {
        ...mockTestArticle,
        synthetic_marker: '',
      };

      const result = service.validateArticle(articleWithNoMarker);

      expect(result.warnings).toContain('No synthetic marker specified');
    });
  });

  describe('getUnprocessedArticles', () => {
    it('should return unprocessed articles', async () => {
      const result = await service.getUnprocessedArticles('test-org');

      expect(testArticleRepository.findUnprocessed).toHaveBeenCalled();
      expect(result).toEqual([mockTestArticle]);
    });
  });

  describe('getArticlesByScenario', () => {
    it('should return articles for scenario', async () => {
      const result = await service.getArticlesByScenario('scenario-123');

      expect(testArticleRepository.findByScenario).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result).toEqual([mockTestArticle]);
    });
  });

  describe('getArticlesByTargetSymbol', () => {
    it('should return articles for target symbol', async () => {
      const result = await service.getArticlesByTargetSymbol('T_AAPL');

      expect(testArticleRepository.findByTargetSymbol).toHaveBeenCalledWith(
        'T_AAPL',
      );
      expect(result).toEqual([mockTestArticle]);
    });
  });

  describe('updateArticle', () => {
    it('should update article', async () => {
      const updateData = { title: 'Updated Title' };

      const result = await service.updateArticle(
        'article-123',
        updateData,
        'user-123',
      );

      expect(testArticleRepository.update).toHaveBeenCalledWith(
        'article-123',
        updateData,
      );
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'article_updated',
        }),
      );
      expect(result).toEqual(mockTestArticle);
    });

    it('should validate target symbols when updating', async () => {
      const updateData = { target_symbols: ['INVALID'] };

      await expect(
        service.updateArticle('article-123', updateData, 'user-123'),
      ).rejects.toThrow('must start with T_ prefix');
    });
  });

  describe('deleteArticle', () => {
    it('should delete article', async () => {
      await service.deleteArticle('article-123', 'user-123', 'test-org');

      expect(testArticleRepository.delete).toHaveBeenCalledWith('article-123');
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'article_deleted',
        }),
      );
    });
  });
});
