import { Test, TestingModule } from '@nestjs/testing';
import { PredictionDashboardRouter } from '../prediction-dashboard.router';
import { UniverseHandler } from '../handlers/universe.handler';
import { TargetHandler } from '../handlers/target.handler';
import { PredictionHandler } from '../handlers/prediction.handler';
import { SourceHandler } from '../handlers/source.handler';
import { AnalystHandler } from '../handlers/analyst.handler';
import { LearningHandler } from '../handlers/learning.handler';
import { LearningQueueHandler } from '../handlers/learning-queue.handler';
import { ReviewQueueHandler } from '../handlers/review-queue.handler';
import { StrategyHandler } from '../handlers/strategy.handler';
import { MissedOpportunityHandler } from '../handlers/missed-opportunity.handler';
import { ToolRequestHandler } from '../handlers/tool-request.handler';
import { LearningPromotionHandler } from '../handlers/learning-promotion.handler';
import { TestScenarioHandler } from '../handlers/test-scenario.handler';
import { TestArticleHandler } from '../handlers/test-article.handler';
import { TestPriceDataHandler } from '../handlers/test-price-data.handler';
import { TestTargetMirrorHandler } from '../handlers/test-target-mirror.handler';
import { AnalyticsHandler } from '../handlers/analytics.handler';
import { SourceSeenItemsHandler } from '../handlers/source-seen-items.handler';
import { SignalsHandler } from '../handlers/signals.handler';
import { AgentActivityHandler } from '../handlers/agent-activity.handler';
import { LearningSessionHandler } from '../handlers/learning-session.handler';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('PredictionDashboardRouter', () => {
  let router: PredictionDashboardRouter;
  let universeHandler: jest.Mocked<UniverseHandler>;
  let targetHandler: jest.Mocked<TargetHandler>;
  let predictionHandler: jest.Mocked<PredictionHandler>;
  let sourceHandler: jest.Mocked<SourceHandler>;
  let analystHandler: jest.Mocked<AnalystHandler>;
  let learningHandler: jest.Mocked<LearningHandler>;
  let learningQueueHandler: jest.Mocked<LearningQueueHandler>;
  let reviewQueueHandler: jest.Mocked<ReviewQueueHandler>;
  let strategyHandler: jest.Mocked<StrategyHandler>;
  let missedOpportunityHandler: jest.Mocked<MissedOpportunityHandler>;
  let toolRequestHandler: jest.Mocked<ToolRequestHandler>;
  let _learningPromotionHandler: jest.Mocked<LearningPromotionHandler>;
  let testScenarioHandler: jest.Mocked<TestScenarioHandler>;
  let _testArticleHandler: jest.Mocked<TestArticleHandler>;
  let _testPriceDataHandler: jest.Mocked<TestPriceDataHandler>;
  let _testTargetMirrorHandler: jest.Mocked<TestTargetMirrorHandler>;
  let _analyticsHandler: jest.Mocked<AnalyticsHandler>;

  const mockContext: ExecutionContext = {
    userId: 'user-123',
    orgSlug: 'test-org',
    agentSlug: 'prediction-runner',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    agentType: 'context',
  };

  const createMockHandler = () => ({
    execute: jest.fn(),
    getSupportedActions: jest.fn().mockReturnValue(['list', 'get', 'create']),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionDashboardRouter,
        { provide: UniverseHandler, useValue: createMockHandler() },
        { provide: TargetHandler, useValue: createMockHandler() },
        { provide: PredictionHandler, useValue: createMockHandler() },
        { provide: SourceHandler, useValue: createMockHandler() },
        { provide: AnalystHandler, useValue: createMockHandler() },
        { provide: LearningHandler, useValue: createMockHandler() },
        { provide: LearningQueueHandler, useValue: createMockHandler() },
        { provide: ReviewQueueHandler, useValue: createMockHandler() },
        { provide: StrategyHandler, useValue: createMockHandler() },
        { provide: MissedOpportunityHandler, useValue: createMockHandler() },
        { provide: ToolRequestHandler, useValue: createMockHandler() },
        { provide: LearningPromotionHandler, useValue: createMockHandler() },
        { provide: TestScenarioHandler, useValue: createMockHandler() },
        { provide: TestArticleHandler, useValue: createMockHandler() },
        { provide: TestPriceDataHandler, useValue: createMockHandler() },
        { provide: TestTargetMirrorHandler, useValue: createMockHandler() },
        { provide: AnalyticsHandler, useValue: createMockHandler() },
        { provide: SourceSeenItemsHandler, useValue: createMockHandler() },
        { provide: SignalsHandler, useValue: createMockHandler() },
        { provide: AgentActivityHandler, useValue: createMockHandler() },
        { provide: LearningSessionHandler, useValue: createMockHandler() },
      ],
    }).compile();

    router = module.get<PredictionDashboardRouter>(PredictionDashboardRouter);
    universeHandler = module.get(UniverseHandler);
    targetHandler = module.get(TargetHandler);
    predictionHandler = module.get(PredictionHandler);
    sourceHandler = module.get(SourceHandler);
    analystHandler = module.get(AnalystHandler);
    learningHandler = module.get(LearningHandler);
    learningQueueHandler = module.get(LearningQueueHandler);
    reviewQueueHandler = module.get(ReviewQueueHandler);
    strategyHandler = module.get(StrategyHandler);
    missedOpportunityHandler = module.get(MissedOpportunityHandler);
    toolRequestHandler = module.get(ToolRequestHandler);
    _learningPromotionHandler = module.get(LearningPromotionHandler);
    testScenarioHandler = module.get(TestScenarioHandler);
    _testArticleHandler = module.get(TestArticleHandler);
    _testPriceDataHandler = module.get(TestPriceDataHandler);
    _testTargetMirrorHandler = module.get(TestTargetMirrorHandler);
    _analyticsHandler = module.get(AnalyticsHandler);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(router).toBeDefined();
  });

  describe('getSupportedEntities', () => {
    it('should return all supported entities', () => {
      const entities = router.getSupportedEntities();
      expect(entities).toContain('universes');
      expect(entities).toContain('targets');
      expect(entities).toContain('predictions');
      expect(entities).toContain('sources');
      expect(entities).toContain('analysts');
      expect(entities).toContain('learnings');
      expect(entities).toContain('learning-queue');
      expect(entities).toContain('review-queue');
      expect(entities).toContain('strategies');
      expect(entities).toContain('missed-opportunities');
      expect(entities).toContain('tool-requests');
      expect(entities).toContain('test-scenarios');
    });
  });

  describe('route', () => {
    const mockPayload: DashboardRequestPayload = {
      action: 'list',
      params: {},
    };

    it('should route universes.list to UniverseHandler', async () => {
      universeHandler.execute.mockResolvedValue({
        success: true,
        data: [],
        metadata: { totalCount: 0 },
      });

      const result = await router.route(
        'universes.list',
        mockPayload,
        mockContext,
      );

      expect(universeHandler.execute).toHaveBeenCalledWith(
        'list',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route targets.get to TargetHandler', async () => {
      targetHandler.execute.mockResolvedValue({
        success: true,
        data: { id: 'target-1' },
      });

      const result = await router.route(
        'targets.get',
        mockPayload,
        mockContext,
      );

      expect(targetHandler.execute).toHaveBeenCalledWith(
        'get',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route predictions.getSnapshot to PredictionHandler', async () => {
      predictionHandler.execute.mockResolvedValue({
        success: true,
        data: { prediction: {}, snapshot: {} },
      });

      const result = await router.route(
        'predictions.getSnapshot',
        mockPayload,
        mockContext,
      );

      expect(predictionHandler.execute).toHaveBeenCalledWith(
        'getSnapshot',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route sources.testCrawl to SourceHandler', async () => {
      sourceHandler.execute.mockResolvedValue({
        success: true,
        data: { testResult: {} },
      });

      const result = await router.route(
        'sources.testCrawl',
        mockPayload,
        mockContext,
      );

      expect(sourceHandler.execute).toHaveBeenCalledWith(
        'testCrawl',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route analysts.create to AnalystHandler', async () => {
      analystHandler.execute.mockResolvedValue({
        success: true,
        data: { id: 'analyst-1' },
      });

      const result = await router.route(
        'analysts.create',
        mockPayload,
        mockContext,
      );

      expect(analystHandler.execute).toHaveBeenCalledWith(
        'create',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route learnings.list to LearningHandler', async () => {
      learningHandler.execute.mockResolvedValue({
        success: true,
        data: [],
        metadata: { totalCount: 0 },
      });

      const result = await router.route(
        'learnings.list',
        mockPayload,
        mockContext,
      );

      expect(learningHandler.execute).toHaveBeenCalledWith(
        'list',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route learning-queue.respond to LearningQueueHandler', async () => {
      learningQueueHandler.execute.mockResolvedValue({
        success: true,
        data: { approved: true },
      });

      const result = await router.route(
        'learning-queue.respond',
        mockPayload,
        mockContext,
      );

      expect(learningQueueHandler.execute).toHaveBeenCalledWith(
        'respond',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route review-queue.respond to ReviewQueueHandler', async () => {
      reviewQueueHandler.execute.mockResolvedValue({
        success: true,
        data: { approved: true },
      });

      const result = await router.route(
        'review-queue.respond',
        mockPayload,
        mockContext,
      );

      expect(reviewQueueHandler.execute).toHaveBeenCalledWith(
        'respond',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route strategies.recommend to StrategyHandler', async () => {
      strategyHandler.execute.mockResolvedValue({
        success: true,
        data: { recommended: {} },
      });

      const result = await router.route(
        'strategies.recommend',
        mockPayload,
        mockContext,
      );

      expect(strategyHandler.execute).toHaveBeenCalledWith(
        'recommend',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route missed-opportunities.analyze to MissedOpportunityHandler', async () => {
      missedOpportunityHandler.execute.mockResolvedValue({
        success: true,
        data: { analysis: {} },
      });

      const result = await router.route(
        'missed-opportunities.analyze',
        mockPayload,
        mockContext,
      );

      expect(missedOpportunityHandler.execute).toHaveBeenCalledWith(
        'analyze',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route tool-requests.updateStatus to ToolRequestHandler', async () => {
      toolRequestHandler.execute.mockResolvedValue({
        success: true,
        data: { updated: true },
      });

      const result = await router.route(
        'tool-requests.updateStatus',
        mockPayload,
        mockContext,
      );

      expect(toolRequestHandler.execute).toHaveBeenCalledWith(
        'updateStatus',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route test-scenarios.list to TestScenarioHandler', async () => {
      testScenarioHandler.execute.mockResolvedValue({
        success: true,
        data: [],
        metadata: { totalCount: 0 },
      });

      const result = await router.route(
        'test-scenarios.list',
        mockPayload,
        mockContext,
      );

      expect(testScenarioHandler.execute).toHaveBeenCalledWith(
        'list',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should route test-scenarios.inject to TestScenarioHandler', async () => {
      testScenarioHandler.execute.mockResolvedValue({
        success: true,
        data: { injected_count: 5 },
      });

      const result = await router.route(
        'test-scenarios.inject',
        mockPayload,
        mockContext,
      );

      expect(testScenarioHandler.execute).toHaveBeenCalledWith(
        'inject',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should return error for unknown entity', async () => {
      const result = await router.route(
        'unknown.list',
        mockPayload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ENTITY');
    });

    it('should return error for invalid action format', async () => {
      const result = await router.route('', mockPayload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ACTION');
    });

    it('should handle singular entity names', async () => {
      universeHandler.execute.mockResolvedValue({
        success: true,
        data: { id: 'universe-1' },
      });

      const result = await router.route(
        'universe.get',
        mockPayload,
        mockContext,
      );

      expect(universeHandler.execute).toHaveBeenCalledWith(
        'get',
        mockPayload,
        mockContext,
      );
      expect(result.success).toBe(true);
    });

    it('should handle handler errors gracefully', async () => {
      universeHandler.execute.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await router.route(
        'universes.list',
        mockPayload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HANDLER_ERROR');
      expect(result.error?.message).toContain('Database connection failed');
    });

    it('should pass through handler failure responses', async () => {
      universeHandler.execute.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Universe not found' },
      });

      const result = await router.route(
        'universes.get',
        mockPayload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('action parsing', () => {
    it('should parse simple two-part actions', async () => {
      universeHandler.execute.mockResolvedValue({ success: true, data: [] });

      await router.route(
        'universes.list',
        { action: 'list', params: {} },
        mockContext,
      );

      expect(universeHandler.execute).toHaveBeenCalledWith(
        'list',
        expect.any(Object),
        mockContext,
      );
    });

    it('should parse longer action paths by taking last two parts', async () => {
      universeHandler.execute.mockResolvedValue({ success: true, data: [] });

      await router.route(
        'dashboard.universes.list',
        { action: 'dashboard.universes.list', params: {} },
        mockContext,
      );

      expect(universeHandler.execute).toHaveBeenCalledWith(
        'list',
        expect.any(Object),
        mockContext,
      );
    });
  });
});
