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
} from './services';

const repositories = [
  UniverseRepository,
  TargetRepository,
  SignalRepository,
  PredictorRepository,
  PredictionRepository,
  AnalystRepository,
  LearningRepository,
  LearningQueueRepository,
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
];

@Module({
  imports: [SupabaseModule, LLMModule],
  providers: [...repositories, ...services],
  exports: [...services],
})
export class PredictionRunnerModule {}
