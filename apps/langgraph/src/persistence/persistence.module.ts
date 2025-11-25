import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresCheckpointerService } from './postgres-checkpointer.service';

/**
 * PersistenceModule
 *
 * Global module that provides checkpoint persistence for LangGraph workflows.
 * Uses PostgreSQL for durable checkpoint storage, enabling:
 * - Workflow state persistence across restarts
 * - Human-in-the-loop interrupts
 * - Failure recovery
 * - Execution history
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PostgresCheckpointerService],
  exports: [PostgresCheckpointerService],
})
export class PersistenceModule {}
