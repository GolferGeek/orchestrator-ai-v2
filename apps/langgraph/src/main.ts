import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Get port from config - no default, must be explicitly set
  // Dev: 6200, Staging: 8200, Prod: 9200
  const port = configService.get<number>("LANGGRAPH_PORT");
  if (!port) {
    throw new Error(
      "LANGGRAPH_PORT environment variable is required. " +
        "Set LANGGRAPH_PORT in your .env file (Dev: 6200, Staging: 8200, Prod: 9200)",
    );
  }
  const host = configService.get<string>("LANGGRAPH_HOST") || "0.0.0.0";

  await app.listen(port, host);
  logger.log(`🚀 LangGraph application is running on: http://${host}:${port}`);
  logger.log(`📊 Health check: http://${host}:${port}/health`);
  logger.log(`🔄 Workflows: http://${host}:${port}/workflows/*`);
}

bootstrap();
