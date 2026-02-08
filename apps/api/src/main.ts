import { NestFactory } from '@nestjs/core';
import { Logger, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { join } from 'path';

async function bootstrap() {
  // Suppress punycode deprecation warning until dependencies are updated
  (process as NodeJS.Process & { noDeprecation?: boolean }).noDeprecation =
    true;
  // Load environment file - try explicit ENV_FILE or fallback to standard location
  const envFilePath = process.env.ENV_FILE
    ? process.env.ENV_FILE.startsWith('/')
      ? process.env.ENV_FILE
      : join(process.cwd(), process.env.ENV_FILE)
    : join(process.cwd(), '../../.env'); // Default: project root from apps/api

  try {
    const result = dotenv.config({ path: envFilePath });
    if (result.error) {
      console.error(
        `[main.ts] Failed to load env from ${envFilePath}:`,
        result.error.message,
      );
    }
  } catch (err) {
    console.error(`[main.ts] dotenv.config() threw:`, err);
    process.exit(1);
  }

  // Parse command line arguments for --enable-external-agents
  const args = process.argv.slice(2);
  const enableExternalIdx = args.findIndex(
    (arg) => arg === '--enable-external-agents' || arg === '--enable-external',
  );
  if (enableExternalIdx !== -1) {
    process.env.ENABLE_EXTERNAL_AGENTS = 'true';
  }

  // Configure logging levels based on environment
  //
  // Environment Variables for Logging:
  // LOG_LEVEL - Comma-separated list of levels: error,warn,log,debug,verbose
  // NODE_ENV - Environment: production, development, test
  //
  // Examples:
  // LOG_LEVEL=error,warn              (Production-like logging)
  // LOG_LEVEL=error,warn,log          (Info logging without debug)
  // LOG_LEVEL=error,warn,log,debug    (Full development logging - default in dev)
  // LOG_LEVEL=error                   (Minimal logging)
  //
  const logLevels = (() => {
    const nodeEnv = process.env.NODE_ENV;
    const logLevel = process.env.LOG_LEVEL;

    // Valid NestJS log levels
    const validLevels: LogLevel[] = [
      'error',
      'warn',
      'log',
      'debug',
      'verbose',
    ];

    // If LOG_LEVEL is explicitly set, use it
    if (logLevel) {
      const levels = logLevel
        .toLowerCase()
        .split(',')
        .map((l) => l.trim());
      return levels.filter((level) =>
        validLevels.includes(level as LogLevel),
      ) as LogLevel[];
    }

    // Default levels based on environment
    if (nodeEnv === 'production') {
      return ['error', 'warn'] as LogLevel[]; // Only errors and warnings in production
    } else if (nodeEnv === 'test') {
      return ['error'] as LogLevel[]; // Only errors in test
    } else {
      return ['error', 'warn'] as LogLevel[]; // Development: minimal logging by default
    }
  })();

  // Add startup timing
  const startTime = Date.now();
  console.log(`[STARTUP] Creating NestJS application...`);

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to configure custom limits
    logger: logLevels, // Configure logging levels
  });

  console.log(
    `[STARTUP] NestFactory.create completed in ${Date.now() - startTime}ms`,
  );

  // Configure body parser with larger limits for conversation histories and metrics responses
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Orchestrator AI API')
    .setDescription(
      'API for Orchestrator AI platform with sovereign mode support',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('sovereign-policy', 'Sovereign mode policy management')
    .addTag('models', 'Model and provider management')
    .addTag(
      'orchestrations',
      'Orchestration dashboard, approvals, and replay APIs',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Enable CORS with environment-driven origins
  //
  // CORS_ORIGINS: Comma-separated list of allowed origins.
  //   Production example: CORS_ORIGINS=https://orchestratorai.io,https://app.orchestratorai.io
  //   Dev example: CORS_ORIGINS=http://localhost:6101,http://localhost:6102
  //
  // In development mode (NODE_ENV != production), localhost/Tailscale/LAN origins
  // are automatically allowed regardless of CORS_ORIGINS.
  //
  const isDevelopment =
    process.env.NODE_ENV !== 'production';

  const corsOrigins: string[] = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (corsOrigins.length === 0 && !isDevelopment) {
    console.warn(
      '[CORS] WARNING: CORS_ORIGINS is not set in production mode. ' +
        'No cross-origin requests will be allowed. ' +
        'Set CORS_ORIGINS=https://orchestratorai.io,https://app.orchestratorai.io',
    );
  }

  if (corsOrigins.length > 0) {
    console.log(`[CORS] Allowed origins: ${corsOrigins.join(', ')}`);
  }
  if (isDevelopment) {
    console.log('[CORS] Development mode: localhost, Tailscale, and LAN origins are auto-allowed');
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, or tests)
      if (!origin) return callback(null, true);

      // Check explicit allowlist first (works in all environments)
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development mode, allow common local/dev origins
      if (isDevelopment) {
        // localhost and 127.0.0.1
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('https://localhost') ||
          origin.includes('127.0.0.1') ||
          origin === 'null' ||
          origin === 'file://'
        ) {
          return callback(null, true);
        }

        // Tailscale origins (*.ts.net and 100.x.x.x CGNAT range)
        if (origin.includes('.ts.net') || /https?:\/\/100\.\d+\.\d+\.\d+/.test(origin)) {
          return callback(null, true);
        }

        // Local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (
          /https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/.test(
            origin,
          )
        ) {
          return callback(null, true);
        }
      }

      // Reject everything else
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cache-Control',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'Pragma',
      'X-CSRF-Token',
      'Accept-Version',
      'Content-Length',
      'Content-MD5',
      'Date',
      'X-Api-Version',
      'X-Test-Api-Key',
      'X-Agent-Namespace',
      'x-organization-slug',
      'X-Team-ID',
    ],
  });

  // Start the HTTP server
  // No default port - must be explicitly configured in .env
  // Dev: 6100, Staging: 8100, Prod: 9100
  if (!process.env.API_PORT) {
    throw new Error(
      'API_PORT environment variable is required. ' +
        'Set API_PORT in your .env file (Dev: 6100, Staging: 8100, Prod: 9100)',
    );
  }
  const port = parseInt(process.env.API_PORT);

  console.log(`[STARTUP] Starting HTTP server on port ${port}...`);
  const listenStart = Date.now();
  await app.listen(port);
  console.log(`[STARTUP] Server listening in ${Date.now() - listenStart}ms`);
  console.log(`[STARTUP] Total startup time: ${Date.now() - startTime}ms`);

  // Agent discovery and registration is now handled by AgentPlatformModule
  // All agents are now database-backed via agent-platform
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to bootstrap application', error);
  process.exit(1);
});
