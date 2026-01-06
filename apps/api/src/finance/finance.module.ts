import { Module } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { RbacModule } from '@/rbac/rbac.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [SupabaseModule, RbacModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
