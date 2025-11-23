import { Global, Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { StreamTokenService } from './services/stream-token.service';
import { RbacModule } from '../rbac/rbac.module';

@Global()
@Module({
  imports: [SupabaseModule, forwardRef(() => RbacModule)],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, StreamTokenService],
  exports: [AuthService, JwtAuthGuard, StreamTokenService],
})
export class AuthModule {}
