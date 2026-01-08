import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresCheckpointerService } from './postgres-checkpointer.service';

/**
 * PostgresCheckpointerModule
 *
 * Provides PostgreSQL checkpoint persistence for LangGraph workflows.
 * Used by prediction runners to maintain state across execution steps.
 *
 * EXPORTS:
 * - PostgresCheckpointerService - For injecting into prediction runners
 */
@Module({
  imports: [ConfigModule],
  providers: [PostgresCheckpointerService],
  exports: [PostgresCheckpointerService],
})
export class PostgresCheckpointerModule {}
