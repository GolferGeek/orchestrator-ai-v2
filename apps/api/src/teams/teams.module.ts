import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [SupabaseModule, RbacModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
