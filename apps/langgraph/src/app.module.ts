import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { HealthModule } from './health/health.module';
import { SharedServicesModule } from './services/shared-services.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ToolsModule } from './tools/tools.module';
import { DataAnalystModule } from './agents/data-analyst/data-analyst.module';
import { ExtendedPostWriterModule } from './agents/extended-post-writer/extended-post-writer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../.env'),
        '../../.env',
        join(process.cwd(), '.env'),
        '.env',
      ],
      expandVariables: true,
    }),
    // Core infrastructure modules
    SharedServicesModule,
    PersistenceModule,
    ToolsModule,
    // Agent modules
    DataAnalystModule,
    ExtendedPostWriterModule,
    // Health check
    HealthModule,
  ],
})
export class AppModule {}
