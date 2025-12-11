import { Module } from '@nestjs/common';
import { MarketingSwarmController } from './marketing-swarm.controller';
import { MarketingSwarmService } from './marketing-swarm.service';

/**
 * MarketingSwarmModule
 *
 * Provides the Marketing Swarm agent for generating marketing content
 * through multiple writer/editor/evaluator agents. The workflow:
 * - Writers generate initial drafts
 * - Editors review and refine the drafts
 * - Evaluators score the outputs
 * - Results are ranked by weighted scores
 */
@Module({
  controllers: [MarketingSwarmController],
  providers: [MarketingSwarmService],
  exports: [MarketingSwarmService],
})
export class MarketingSwarmModule {}
