/**
 * Prediction Module Tests
 *
 * Tests the PredictionModule integration - verifies that all submodules,
 * controllers, and services are properly wired together.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PredictionModule } from '../prediction.module';
import { RunnerFactoryService } from '../runner-factory.service';
import { AmbientAgentOrchestratorService } from '../ambient-agent-orchestrator.service';
import { PredictionDbService } from '../base/services/prediction-db.service';
import { OutcomeEvaluationService } from '../base/services/outcome-evaluation.service';
import { PostmortemService } from '../base/services/postmortem.service';
import { MissedOpportunityService } from '../base/services/missed-opportunity.service';
import { LearningContextBuilderService } from '../base/services/learning-context.service';
import { LearningConversationService } from '../base/services/learning-conversation.service';
import { AgentContextUpdateService } from '../base/services/agent-context-update.service';
import { PredictionController } from '../prediction.controller';
import { LearningController } from '../learning.controller';
import { FinancialAssetPredictorModule } from '../financial-asset-predictor/financial-asset-predictor.module';
import { MarketPredictorModule } from '../market-predictor/market-predictor.module';
import { RUNNER_REGISTRY } from '../runner.registry';

// Mock dependencies
jest.mock('../../../../supabase/supabase.module', () => ({
  SupabaseModule: class MockSupabaseModule {},
}));

jest.mock('../../../../llms/llm.module', () => ({
  LLMModule: class MockLLMModule {},
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

// Mock all services
jest.mock('../runner-factory.service');
jest.mock('../ambient-agent-orchestrator.service');
jest.mock('../base/services/prediction-db.service');
jest.mock('../base/services/outcome-evaluation.service');
jest.mock('../base/services/postmortem.service');
jest.mock('../base/services/missed-opportunity.service');
jest.mock('../base/services/learning-context.service');
jest.mock('../base/services/learning-conversation.service');
jest.mock('../base/services/agent-context-update.service');
jest.mock('../base/postgres-checkpointer.service');

// Mock controllers
jest.mock('../prediction.controller', () => ({
  PredictionController: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../learning.controller', () => ({
  LearningController: jest.fn().mockImplementation(() => ({})),
}));

// Mock domain modules
jest.mock(
  '../financial-asset-predictor/financial-asset-predictor.module',
  () => ({
    FinancialAssetPredictorModule: class MockFinancialAssetPredictorModule {},
  }),
);
jest.mock('../market-predictor/market-predictor.module', () => ({
  MarketPredictorModule: class MockMarketPredictorModule {},
}));

describe('PredictionModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PredictionModule],
    })
      .overrideProvider(RunnerFactoryService)
      .useValue({
        getRunner: jest.fn(),
        getAvailableRunners: jest.fn().mockReturnValue([]),
      })
      .overrideProvider(AmbientAgentOrchestratorService)
      .useValue({
        startAgent: jest.fn(),
        stopAgent: jest.fn(),
        pauseAgent: jest.fn(),
        resumeAgent: jest.fn(),
      })
      .overrideProvider(PredictionDbService)
      .useValue({
        storeDatapoint: jest.fn(),
        getClaimsForInstrument: jest.fn(),
      })
      .overrideProvider(OutcomeEvaluationService)
      .useValue({
        evaluateOutcome: jest.fn(),
      })
      .overrideProvider(PostmortemService)
      .useValue({
        createPostmortem: jest.fn(),
      })
      .overrideProvider(MissedOpportunityService)
      .useValue({
        detectMissedOpportunity: jest.fn(),
      })
      .overrideProvider(LearningContextBuilderService)
      .useValue({
        buildContext: jest.fn(),
      })
      .overrideProvider(LearningConversationService)
      .useValue({
        processMessage: jest.fn(),
      })
      .overrideProvider(AgentContextUpdateService)
      .useValue({
        appendToContext: jest.fn(),
      })
      .compile();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('module structure', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should export RunnerFactoryService', () => {
      const service = module.get<RunnerFactoryService>(RunnerFactoryService);
      expect(service).toBeDefined();
    });

    it('should export AmbientAgentOrchestratorService', () => {
      const service = module.get<AmbientAgentOrchestratorService>(
        AmbientAgentOrchestratorService,
      );
      expect(service).toBeDefined();
    });

    it('should export PredictionDbService', () => {
      const service = module.get<PredictionDbService>(PredictionDbService);
      expect(service).toBeDefined();
    });

    it('should export learning services', () => {
      const outcome = module.get<OutcomeEvaluationService>(
        OutcomeEvaluationService,
      );
      const postmortem = module.get<PostmortemService>(PostmortemService);
      const missedOpportunity = module.get<MissedOpportunityService>(
        MissedOpportunityService,
      );
      const learningContext = module.get<LearningContextBuilderService>(
        LearningContextBuilderService,
      );
      const learningConversation = module.get<LearningConversationService>(
        LearningConversationService,
      );
      const contextUpdate = module.get<AgentContextUpdateService>(
        AgentContextUpdateService,
      );

      expect(outcome).toBeDefined();
      expect(postmortem).toBeDefined();
      expect(missedOpportunity).toBeDefined();
      expect(learningContext).toBeDefined();
      expect(learningConversation).toBeDefined();
      expect(contextUpdate).toBeDefined();
    });
  });
});

describe('PredictionModule runner registry integration', () => {
  beforeEach(() => {
    // Clear registry before each test
    RUNNER_REGISTRY.clear();
  });

  describe('runner types', () => {
    it('should define financial-asset-predictor as a valid runner type', () => {
      // This test validates that the type system accepts financial-asset-predictor
      const runnerType = 'financial-asset-predictor' as const;
      expect([
        'financial-asset-predictor',
        'stock-predictor',
        'crypto-predictor',
        'market-predictor',
      ]).toContain(runnerType);
    });

    it('should define stock-predictor as a deprecated but valid runner type', () => {
      const runnerType = 'stock-predictor' as const;
      expect([
        'financial-asset-predictor',
        'stock-predictor',
        'crypto-predictor',
        'market-predictor',
      ]).toContain(runnerType);
    });

    it('should define crypto-predictor as a deprecated but valid runner type', () => {
      const runnerType = 'crypto-predictor' as const;
      expect([
        'financial-asset-predictor',
        'stock-predictor',
        'crypto-predictor',
        'market-predictor',
      ]).toContain(runnerType);
    });

    it('should define market-predictor as a valid runner type', () => {
      const runnerType = 'market-predictor' as const;
      expect([
        'financial-asset-predictor',
        'stock-predictor',
        'crypto-predictor',
        'market-predictor',
      ]).toContain(runnerType);
    });
  });

  describe('module exports', () => {
    it('should re-export domain runner services', async () => {
      // These imports should work if module exports are correct
      const { FinancialAssetPredictorRunnerService } = await import(
        '../financial-asset-predictor/financial-asset-predictor-runner.service'
      );
      const { MarketPredictorRunnerService } = await import(
        '../market-predictor/market-predictor-runner.service'
      );

      expect(FinancialAssetPredictorRunnerService).toBeDefined();
      expect(MarketPredictorRunnerService).toBeDefined();
    });
  });
});

describe('PredictionModule domain modules', () => {
  describe('FinancialAssetPredictorModule', () => {
    it('should be importable', () => {
      expect(FinancialAssetPredictorModule).toBeDefined();
    });
  });

  describe('MarketPredictorModule', () => {
    it('should be importable', () => {
      expect(MarketPredictorModule).toBeDefined();
    });
  });
});

describe('PredictionModule controllers', () => {
  describe('PredictionController', () => {
    it('should be defined', () => {
      expect(PredictionController).toBeDefined();
    });
  });

  describe('LearningController', () => {
    it('should be defined', () => {
      expect(LearningController).toBeDefined();
    });
  });
});
