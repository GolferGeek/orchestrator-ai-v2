import { Module, OnModuleInit, Logger } from '@nestjs/common';
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
  ScenarioRunRepository,
  // Portfolio & Context Versioning
  PortfolioRepository,
} from './repositories';

// Services
import {
  UniverseService,
  TargetService,
  AnalystService,
  AnalystPromptBuilderService,
  LlmTierResolverService,
  AnalystEnsembleService,
  AnalystPositionService,
  AnalystPerformanceService,
  AnalystMotivationService,
  AgentSelfImprovementService,
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
  // Phase 2 Test Input Infrastructure
  TestDbSourceCrawlerService,
  // Sprint 5 - Learning Impact Tracking
  LearningImpactService,
  // Sprint 6 - Advanced Test Framework & Monitoring
  ScenarioRunService,
  TestScenarioComparisonService,
  TestScenarioBatchService,
  AlertService,
  AnomalyDetectionService,
  // Sprint 7 - Operations & Reliability
  BackpressureService,
  PredictionExportService,
  ExternalIntegrationService,
  LlmUsageLimiterService,
  DegradedModeService,
  // Phase 4 - User Portfolios
  UserPositionService,
  // Miss Investigation & Learning
  MissInvestigationService,
  SourceResearchService,
  BaselinePredictionService,
  // Position Resolution (closes positions when predictions resolve)
  PositionResolutionService,
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
  // Miss Investigation Runner
  DailyMissInvestigationRunner,
  // Baseline Prediction Runner
  BaselinePredictionRunner,
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
  // Sprint 4 - Source Seen Items and Signals Dashboard
  SourceSeenItemsHandler,
  SignalsHandler,
  // Sprint 5 - Manual Evaluation Override
  EvaluationHandler,
  // Sprint 7 - Audit Log Dashboard
  AuditLogHandler,
  // Phase 3 - Agent Activity (HITL Notifications)
  AgentActivityHandler,
  // Phase 5 - Learning Session (Bidirectional Learning)
  LearningSessionHandler,
  // Manual Runner Triggers
  RunnerHandler,
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
  ScenarioRunRepository,
  // Portfolio & Context Versioning
  PortfolioRepository,
];

const services = [
  UniverseService,
  TargetService,
  AnalystService,
  AnalystPromptBuilderService,
  LlmTierResolverService,
  AnalystEnsembleService,
  AnalystPositionService,
  AnalystPerformanceService,
  AnalystMotivationService,
  AgentSelfImprovementService,
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
  // Phase 2 Test Input Infrastructure
  TestDbSourceCrawlerService,
  // Sprint 5 - Learning Impact Tracking
  LearningImpactService,
  // Sprint 6 - Advanced Test Framework & Monitoring
  ScenarioRunService,
  TestScenarioComparisonService,
  TestScenarioBatchService,
  AlertService,
  AnomalyDetectionService,
  // Sprint 7 - Operations & Reliability
  BackpressureService,
  PredictionExportService,
  ExternalIntegrationService,
  LlmUsageLimiterService,
  DegradedModeService,
  // Phase 4 - User Portfolios
  UserPositionService,
  // Miss Investigation & Learning
  MissInvestigationService,
  SourceResearchService,
  BaselinePredictionService,
  // Position Resolution (closes positions when predictions resolve)
  PositionResolutionService,
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
  // Miss Investigation Runner
  DailyMissInvestigationRunner,
  // Baseline Prediction Runner
  BaselinePredictionRunner,
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
  // Sprint 4 - Source Seen Items and Signals Dashboard
  SourceSeenItemsHandler,
  SignalsHandler,
  // Sprint 5 - Manual Evaluation Override
  EvaluationHandler,
  // Sprint 7 - Audit Log Dashboard
  AuditLogHandler,
  // Phase 3 - Agent Activity (HITL Notifications)
  AgentActivityHandler,
  // Phase 5 - Learning Session (Bidirectional Learning)
  LearningSessionHandler,
  // Manual Runner Triggers
  RunnerHandler,
];

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sprint 7 - Startup Config Validation
 * PRD Phase 9.4: Validate secrets/config at startup with fail-fast behavior
 */

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates required configuration for PredictionRunnerModule
 */
function validatePredictionRunnerConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required configuration
  if (!process.env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required for database operations');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY is required for database operations',
    );
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    errors.push('FIRECRAWL_API_KEY is required for source crawling');
  }

  // Optional but recommended configuration
  if (!process.env.POLYGON_API_KEY) {
    warnings.push(
      'POLYGON_API_KEY not set - Polygon.io stock data will be disabled',
    );
  }

  if (!process.env.PREDICTION_SLACK_WEBHOOK_URL) {
    warnings.push(
      'PREDICTION_SLACK_WEBHOOK_URL not set - Slack notifications will be disabled',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

@Module({
  imports: [SupabaseModule, LLMModule, ObservabilityModule],
  providers: [...repositories, ...services, ...runners, ...dashboardHandlers],
  exports: [...services, ...runners, ...dashboardHandlers],
})
export class PredictionRunnerModule implements OnModuleInit {
  private readonly logger = new Logger(PredictionRunnerModule.name);

  /**
   * Sprint 7 - Startup Configuration Validation
   * PRD Phase 9.4: Validate required secrets/config at startup with fail-fast behavior
   */
  onModuleInit() {
    this.logger.log('Validating PredictionRunnerModule configuration...');

    const validation = validatePredictionRunnerConfig();

    // Log warnings for optional config
    if (validation.warnings.length > 0) {
      this.logger.warn('Configuration warnings:');
      for (const warning of validation.warnings) {
        this.logger.warn(`  - ${warning}`);
      }
    }

    // Fail fast if required config is missing
    if (!validation.valid) {
      this.logger.error('Configuration validation failed!');
      for (const error of validation.errors) {
        this.logger.error(`  - ${error}`);
      }
      throw new Error(
        `PredictionRunnerModule startup failed: ${validation.errors.join(', ')}`,
      );
    }

    this.logger.log(
      'PredictionRunnerModule configuration validated successfully',
    );
  }
}
