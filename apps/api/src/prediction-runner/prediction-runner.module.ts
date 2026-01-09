import { Module } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';

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
  SnapshotRepository,
  // Phase 6 Repositories
  SourceRepository,
  SourceCrawlRepository,
  SourceSeenItemRepository,
  StrategyRepository,
  ToolRequestRepository,
  TargetSnapshotRepository,
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
  SnapshotRepository,
  // Phase 6 Repositories
  SourceRepository,
  SourceCrawlRepository,
  SourceSeenItemRepository,
  StrategyRepository,
  ToolRequestRepository,
  TargetSnapshotRepository,
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
];

@Module({
  imports: [SupabaseModule, LLMModule],
  providers: [...repositories, ...services, ...runners, ...dashboardHandlers],
  exports: [...services, ...runners, ...dashboardHandlers],
})
export class PredictionRunnerModule {}
