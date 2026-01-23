import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';
import { ObservabilityModule } from '@/observability/observability.module';

// Repositories
import {
  ScopeRepository,
  SubjectRepository,
  DimensionRepository,
  DimensionContextRepository,
  AssessmentRepository,
  CompositeScoreRepository,
  DebateRepository,
  AlertRepository,
  LearningRepository,
  EvaluationRepository,
} from './repositories';

// Services
import {
  ScoreAggregationService,
  DimensionAnalyzerService,
  RiskAnalysisService,
  DebateService,
  RiskEvaluationService,
  RiskLearningService,
  HistoricalReplayService,
  RiskAlertService,
  CorrelationAnalysisService,
  PortfolioRiskService,
  // Phase 6: AI-Powered features
  ExecutiveSummaryService,
  ScenarioAnalysisService,
  ReportGeneratorService,
  // Phase 7: Advanced Simulation
  MonteCarloService,
  LiveDataService,
} from './services';

// Runners
import {
  RiskAnalysisRunner,
  RiskEvaluationRunner,
  RiskLearningRunner,
  RiskAlertRunner,
} from './runners';

// Dashboard Handlers
import { RiskDashboardRouter } from './task-router/risk-dashboard.router';
import {
  ScopeHandler,
  SubjectHandler,
  DimensionHandler,
  CompositeScoreHandler,
  AssessmentHandler,
  DebateHandler,
  LearningQueueHandler,
  EvaluationHandler,
  AlertHandler,
  CorrelationHandler,
  PortfolioHandler,
  AnalyticsHandler,
  AdvancedAnalyticsHandler,
  SimulationHandler,
} from './task-router/handlers';

const repositories = [
  ScopeRepository,
  SubjectRepository,
  DimensionRepository,
  DimensionContextRepository,
  AssessmentRepository,
  CompositeScoreRepository,
  DebateRepository,
  AlertRepository,
  LearningRepository,
  EvaluationRepository,
];

const services = [
  ScoreAggregationService,
  DimensionAnalyzerService,
  RiskAnalysisService,
  DebateService,
  RiskEvaluationService,
  RiskLearningService,
  HistoricalReplayService,
  RiskAlertService,
  CorrelationAnalysisService,
  PortfolioRiskService,
  // Phase 6: AI-Powered features
  ExecutiveSummaryService,
  ScenarioAnalysisService,
  ReportGeneratorService,
  // Phase 7: Advanced Simulation
  MonteCarloService,
  LiveDataService,
];

const runners = [
  RiskAnalysisRunner,
  RiskEvaluationRunner,
  RiskLearningRunner,
  RiskAlertRunner,
];

const dashboardHandlers = [
  RiskDashboardRouter,
  ScopeHandler,
  SubjectHandler,
  DimensionHandler,
  CompositeScoreHandler,
  AssessmentHandler,
  DebateHandler,
  LearningQueueHandler,
  EvaluationHandler,
  AlertHandler,
  CorrelationHandler,
  PortfolioHandler,
  AnalyticsHandler,
  // Phase 7: AI-Powered features
  AdvancedAnalyticsHandler,
  // Phase 8: Advanced Simulation
  SimulationHandler,
];

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates required configuration for RiskRunnerModule
 */
function validateRiskRunnerConfig(): ConfigValidationResult {
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

  // Optional but recommended configuration
  if (!process.env.DEFAULT_LLM_PROVIDER) {
    warnings.push('DEFAULT_LLM_PROVIDER not set - will default to ollama');
  }

  if (!process.env.DEFAULT_LLM_MODEL) {
    warnings.push(
      'DEFAULT_LLM_MODEL not set - will default to GPT-OSS:20B',
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
export class RiskRunnerModule implements OnModuleInit {
  private readonly logger = new Logger(RiskRunnerModule.name);

  /**
   * Startup Configuration Validation
   */
  onModuleInit() {
    this.logger.log('Validating RiskRunnerModule configuration...');

    const validation = validateRiskRunnerConfig();

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
        `RiskRunnerModule startup failed: ${validation.errors.join(', ')}`,
      );
    }

    this.logger.log('RiskRunnerModule configuration validated successfully');
  }
}
