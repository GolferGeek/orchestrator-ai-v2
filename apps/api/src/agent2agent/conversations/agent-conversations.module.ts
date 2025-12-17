import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AgentConversationsService } from './agent-conversations.service';
import { AgentConversationsController } from './agent-conversations.controller';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [SupabaseModule, HttpModule, ConfigModule],
  providers: [AgentConversationsService],
  controllers: [AgentConversationsController],
  exports: [AgentConversationsService],
})
export class AgentConversationsModule {}
