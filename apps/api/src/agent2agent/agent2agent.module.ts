import { Module } from '@nestjs/common';
import { Agent2AgentController } from './agent2agent.controller';
import { AgentApprovalsActionsController } from './controllers/agent-approvals-actions.controller';
import { AgentPlatformModule } from '../agent-platform/agent-platform.module';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { AgentModeRouterService } from './services/agent-mode-router.service';
import { AgentRunnerRegistryService } from './services/agent-runner-registry.service';
import { ContextAgentRunnerService } from './services/context-agent-runner.service';
import { ApiAgentRunnerService } from './services/api-agent-runner.service';
import { ExternalAgentRunnerService } from './services/external-agent-runner.service';
import { OrchestratorAgentRunnerService } from './services/orchestrator-agent-runner.service';
import { RagAgentRunnerService } from './services/rag-agent-runner.service';
import { MediaAgentRunnerService } from './services/media-agent-runner.service';
import { PredictionAgentRunnerService } from './services/prediction-agent-runner.service';
import { RiskAgentRunnerService } from './services/risk-agent-runner.service';
import { MediaStorageHelper } from './services/media-storage.helper';
import { RoutingPolicyAdapterService } from './services/routing-policy-adapter.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { LLMModule } from '../llms/llm.module';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import { Agent2AgentTasksService } from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { AgentConversationsModule } from './conversations/agent-conversations.module';
import { TasksModule } from './tasks/tasks.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { PlansModule } from './plans/plans.module';
import { ContextOptimizationModule } from './context-optimization/context-optimization.module';
import { MCPModule } from '../mcp/mcp.module';
import { HttpModule } from '@nestjs/axios';
import { StreamingService } from './services/streaming.service';
import { ObservabilityModule } from '../observability/observability.module';
import { RagModule } from '../rag/rag.module';
import { PredictionRunnerModule } from '../prediction-runner/prediction-runner.module';
import { RiskRunnerModule } from '../risk-runner/risk-runner.module';
import { DocumentProcessingService } from './services/document-processing.service';
import { VisionExtractionService } from './services/vision-extraction.service';
import { OCRExtractionService } from './services/ocr-extraction.service';
import { LegalIntelligenceService } from './services/legal-intelligence.service';
// Legacy M1 services (deprecated - use LegalIntelligenceService instead)
import { LegalMetadataService } from './services/legal-metadata.service';
import { DocumentTypeClassificationService } from './services/document-type-classification.service';
import { SectionDetectionService } from './services/section-detection.service';
import { SignatureDetectionService } from './services/signature-detection.service';
import { DateExtractionService } from './services/date-extraction.service';
import { PartyExtractionService } from './services/party-extraction.service';
import { ConfidenceScoringService } from './services/confidence-scoring.service';

@Module({
  imports: [
    AgentPlatformModule,
    LLMModule,
    AuthModule,
    SupabaseModule,
    MCPModule,
    HttpModule,
    ObservabilityModule,
    RagModule,
    // Agent2Agent Sub-modules
    AgentConversationsModule,
    TasksModule,
    DeliverablesModule,
    PlansModule,
    ContextOptimizationModule,
    // Prediction Runner Module (provides PredictionDashboardRouter and handlers)
    PredictionRunnerModule,
    // Risk Runner Module (provides RiskDashboardRouter and handlers)
    RiskRunnerModule,
  ],
  controllers: [Agent2AgentController, AgentApprovalsActionsController],
  providers: [
    AgentCardBuilderService,
    AgentExecutionGateway,
    AgentModeRouterService,
    AgentRunnerRegistryService,
    ContextAgentRunnerService,
    ApiAgentRunnerService,
    ExternalAgentRunnerService,
    OrchestratorAgentRunnerService,
    RagAgentRunnerService,
    MediaAgentRunnerService,
    PredictionAgentRunnerService,
    RiskAgentRunnerService,
    MediaStorageHelper,
    RoutingPolicyAdapterService,
    ApiKeyGuard,
    Agent2AgentDeliverablesService,
    Agent2AgentTasksService,
    Agent2AgentTaskStatusService,
    Agent2AgentConversationsService,
    StreamingService,
    DocumentProcessingService,
    VisionExtractionService,
    OCRExtractionService,
    // New simplified M1 service (replaces 7 legacy services)
    LegalIntelligenceService,
    // Legacy M1 services (kept for backward compatibility, but deprecated)
    LegalMetadataService,
    DocumentTypeClassificationService,
    SectionDetectionService,
    SignatureDetectionService,
    DateExtractionService,
    PartyExtractionService,
    ConfidenceScoringService,
  ],
  exports: [
    AgentExecutionGateway,
    AgentModeRouterService,
    Agent2AgentConversationsService,
    StreamingService,
  ],
})
export class Agent2AgentModule {}
