import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ObservabilityWebhookService } from './observability-webhook.service';
import { ObservabilityStreamController } from './observability-stream.controller';
import { ObservabilityEventsService } from './observability-events.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [HttpModule, AuthModule, SupabaseModule, RbacModule],
  providers: [ObservabilityWebhookService, ObservabilityEventsService],
  controllers: [ObservabilityStreamController],
  exports: [ObservabilityWebhookService, ObservabilityEventsService],
})
export class ObservabilityModule {}
