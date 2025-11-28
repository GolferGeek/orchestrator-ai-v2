import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LangGraphMockService } from './mocks/langgraph-mock.service';

/**
 * Test module that provides mock services for HITL E2E tests.
 *
 * This module is used for testing HITL workflows without actual LangGraph calls.
 * In practice, E2E tests would use the Agent2AgentModule with mocked providers.
 *
 * Port configuration (from root .env):
 * - API: 6100
 * - LangGraph: 6200
 * - Frontend: 6101
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  providers: [
    {
      provide: 'LANGGRAPH_SERVICE',
      useClass: LangGraphMockService,
    },
  ],
  exports: ['LANGGRAPH_SERVICE'],
})
export class HitlE2ETestModule {}
