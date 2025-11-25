import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkflowsModule } from './workflows/workflows.module';
import { HealthModule } from './health/health.module';
import { SharedServicesModule } from './services/shared-services.module';
import { PersistenceModule } from './persistence/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Core infrastructure modules
    SharedServicesModule,
    PersistenceModule,
    // Feature modules
    WorkflowsModule,
    HealthModule,
  ],
})
export class AppModule {}
