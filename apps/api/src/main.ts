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
  // Load custom environment file if ENV_FILE is specified
  if (process.env.ENV_FILE) {
    const envFilePath = process.env.ENV_FILE.startsWith('/')
      ? process.env.ENV_FILE
      : join(process.cwd(), process.env.ENV_FILE);

    try {
      dotenv.config({ path: envFilePath });
    } catch {
      process.exit(1);
    }
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

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to configure custom limits
    logger: logLevels, // Configure logging levels
  });

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

  // Enable CORS with dynamic origins from environment
  const webPort = process.env.WEB_PORT || process.env.VITE_WEB_PORT;
  const orchFlowPort = process.env.ORCH_FLOW_PORT;

  // Build dynamic CORS origins based on configured ports
  const corsOrigins: string[] = [
    // Vite dev server default
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  // Add web port if configured
  if (webPort) {
    corsOrigins.push(`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`);
  }

  // Add orch flow port if configured
  if (orchFlowPort) {
    corsOrigins.push(`http://localhost:${orchFlowPort}`, `http://127.0.0.1:${orchFlowPort}`);
  }

  // Add static origins (Supabase, production domains)
  corsOrigins.push(
    // Supabase local development ports (shared across workspaces)
    'http://localhost:6010',
    'http://127.0.0.1:6010',
    'http://localhost:6015', // Supabase Studio
    'http://127.0.0.1:6015',
    // Common development ports
    'http://localhost:3100',
    'http://127.0.0.1:3100',
    'http://localhost:3101',
    'http://127.0.0.1:3101',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    // Production domains
    'https://app.orchestratorai.io',
    'https://api.orchestratorai.io',
    'http://app.orchestratorai.io',
    'http://api.orchestratorai.io',
    'https://orchestratorai.io',
    'http://orchestratorai.io',
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, or tests)
      if (!origin) return callback(null, true);

      // Check if we're in development mode
      const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test' ||
        !process.env.NODE_ENV ||
        process.env.NODE_ENV === 'undefined';

      if (isDevelopment) {
        // Allow localhost and common test origins
        if (
          origin.startsWith('http://localhost') ||
          origin.startsWith('https://localhost') ||
          origin.includes('127.0.0.1') ||
          origin === 'null' ||
          origin === 'file://'
        ) {
          return callback(null, true);
        }

        // Allow Tailscale origins (*.ts.net)
        if (origin.includes('.ts.net')) {
          return callback(null, true);
        }

        // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (
          /https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/.test(
            origin,
          )
        ) {
          return callback(null, true);
        }

        // Allow 100.x.x.x range (Tailscale CGNAT range)
        if (/https?:\/\/100\.\d+\.\d+\.\d+/.test(origin)) {
          return callback(null, true);
        }
      }

      // Check if origin is in our list
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In production, you might want to be more restrictive
      // For now, let's allow all orchestratorai.io subdomains
      if (origin.includes('orchestratorai.io')) {
        return callback(null, true);
      }

      // In development, be more permissive for testing
      if (isDevelopment) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
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

  await app.listen(port);

  // Agent discovery and registration is now handled by AgentPlatformModule
  // All agents are now database-backed via agent-platform
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to bootstrap application', error);
  process.exit(1);
});
