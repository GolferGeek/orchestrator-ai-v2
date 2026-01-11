import { Module } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';
import { ObservabilityModule } from '@/observability/observability.module';

// Repositories
import {
  UniverseRepository,
  TargetRepository,
  SignalRepository,
  PredictorRepository,
  PredictionRepository,
  AnalystRepository,
  LearningRepository,
  LearningQueueRepository,
  LearningLineageRepository,
  SnapshotRepository,
  // Phase 6 Repositories
  SourceRepository,
  SourceCrawlRepository,
  SourceSeenItemRepository,
  StrategyRepository,
  ToolRequestRepository,
  TargetSnapshotRepository,
  // Phase 2 Story Deduplication
  SignalFingerprintRepository,
  // Phase 3 Test Data Injection Framework
  TestScenarioRepository,
  TestTargetMirrorRepository,
  TestPriceDataRepository,
  TestAuditLogRepository,
  TestArticleRepository,
} from './repositories';

// Services
import {
  UniverseService,
  TargetService,
  AnalystService,
  AnalystPromptBuilderService,
  LlmTierResolverService,
  AnalystEnsembleService,
  LearningService,
  LearningQueueService,
  LearningPromotionService,
  // Phase 5 Services
  SignalDetectionService,
  PredictorManagementService,
  PredictionGenerationService,
  OutcomeTrackingService,
  EvaluationService,
  MissedOpportunityDetectionService,
  MissedOpportunityAnalysisService,
  FastPathService,
  SnapshotService,
  ReviewQueueService,
  // Phase 6 Services
  FirecrawlService,
  ContentHashService,
  SourceCrawlerService,
  TargetSnapshotService,
  StrategyService,
  ToolRequestService,
  // Phase 9 Services
  NotificationService,
  PredictionStreamingService,
  // Phase 3 Test Data Injection Framework
  TestDataInjectorService,
  TestDataGeneratorService,
  TestTargetMirrorService,
  TestPriceDataService,
  // Phase 4.1 AI-Powered Article Generation
  AiArticleGeneratorService,
  // Phase 4.2 & 4.3 Scenario Generation from Real-World Events
  ScenarioGeneratorService,
  // Phase 4.4 Scenario Variation Generator
  ScenarioVariationService,
  // Phase 6.2 Analytics API Endpoints
  AnalyticsService,
} from './services';

// Phase 7 Runners
import {
  SourceCrawlerRunner,
  BatchSignalProcessorRunner,
  BatchPredictionGeneratorRunner,
  OutcomeTrackingRunner,
  EvaluationRunner,
  MissedOpportunityScannerRunner,
  ExpirationRunner,
} from './runners';

// Phase 8 Dashboard Task Router and Handlers
import { PredictionDashboardRouter } from './task-router/prediction-dashboard.router';
import {
  UniverseHandler,
  TargetHandler,
  PredictionHandler,
  SourceHandler,
  AnalystHandler,
  LearningHandler,
  LearningQueueHandler,
  ReviewQueueHandler,
  StrategyHandler,
  MissedOpportunityHandler,
  ToolRequestHandler,
  // Phase 5 - Learning Promotion Workflow
  LearningPromotionHandler,
  // Phase 4 - Test Data Builder UI
  TestScenarioHandler,
  // Phase 3 - Test Data Management UI
  TestArticleHandler,
  TestPriceDataHandler,
  TestTargetMirrorHandler,
  // Phase 6.2 - Analytics API Endpoints
  AnalyticsHandler,
} from './task-router/handlers';

const repositories = [
  UniverseRepository,
  TargetRepository,
  SignalRepository,
  PredictorRepository,
  PredictionRepository,
  AnalystRepository,
  LearningRepository,
  LearningQueueRepository,
  LearningLineageRepository,
  SnapshotRepository,
  // Phase 6 Repositories
  SourceRepository,
  SourceCrawlRepository,
  SourceSeenItemRepository,
  StrategyRepository,
  ToolRequestRepository,
  TargetSnapshotRepository,
  // Phase 2 Story Deduplication
  SignalFingerprintRepository,
  // Phase 3 Test Data Injection Framework
  TestScenarioRepository,
  TestTargetMirrorRepository,
  TestPriceDataRepository,
  TestAuditLogRepository,
  TestArticleRepository,
];

const services = [
  UniverseService,
  TargetService,
  AnalystService,
  AnalystPromptBuilderService,
  LlmTierResolverService,
  AnalystEnsembleService,
  LearningService,
  LearningQueueService,
  LearningPromotionService,
  // Phase 5 Services
  SignalDetectionService,
  PredictorManagementService,
  PredictionGenerationService,
  OutcomeTrackingService,
  EvaluationService,
  MissedOpportunityDetectionService,
  MissedOpportunityAnalysisService,
  FastPathService,
  SnapshotService,
  ReviewQueueService,
  // Phase 6 Services
  FirecrawlService,
  ContentHashService,
  SourceCrawlerService,
  TargetSnapshotService,
  StrategyService,
  ToolRequestService,
  // Phase 9 Services
  NotificationService,
  PredictionStreamingService,
  // Phase 3 Test Data Injection Framework
  TestDataInjectorService,
  TestDataGeneratorService,
  TestTargetMirrorService,
  TestPriceDataService,
  // Phase 4.1 AI-Powered Article Generation
  AiArticleGeneratorService,
  // Phase 4.2 & 4.3 Scenario Generation from Real-World Events
  ScenarioGeneratorService,
  // Phase 4.4 Scenario Variation Generator
  ScenarioVariationService,
  // Phase 6.2 Analytics API Endpoints
  AnalyticsService,
];

// Phase 7 Runners
const runners = [
  SourceCrawlerRunner,
  BatchSignalProcessorRunner,
  BatchPredictionGeneratorRunner,
  OutcomeTrackingRunner,
  EvaluationRunner,
  MissedOpportunityScannerRunner,
  ExpirationRunner,
];

// Phase 8 Dashboard Handlers
const dashboardHandlers = [
  PredictionDashboardRouter,
  UniverseHandler,
  TargetHandler,
  PredictionHandler,
  SourceHandler,
  AnalystHandler,
  LearningHandler,
  LearningQueueHandler,
  ReviewQueueHandler,
  StrategyHandler,
  MissedOpportunityHandler,
  ToolRequestHandler,
  // Phase 5 - Learning Promotion Workflow
  LearningPromotionHandler,
  // Phase 4 - Test Data Builder UI
  TestScenarioHandler,
  // Phase 3 - Test Data Management UI
  TestArticleHandler,
  TestPriceDataHandler,
  TestTargetMirrorHandler,
  // Phase 6.2 - Analytics API Endpoints
  AnalyticsHandler,
];

@Module({
  imports: [SupabaseModule, LLMModule, ObservabilityModule],
  providers: [...repositories, ...services, ...runners, ...dashboardHandlers],
  exports: [...services, ...runners, ...dashboardHandlers],
})
export class PredictionRunnerModule {}
