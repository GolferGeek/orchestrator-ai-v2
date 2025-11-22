import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RbacGuard } from './guards/rbac.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  controllers: [RbacController],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
