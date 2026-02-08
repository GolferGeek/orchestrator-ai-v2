import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

/**
 * PostgresCheckpointerService
 *
 * Provides a PostgresSaver instance for LangGraph checkpoint persistence.
 * The checkpointer allows workflows to:
 * - Save state at each step
 * - Resume from interrupts (HITL)
 * - Recover from failures
 * - Query execution history
 */
@Injectable()
export class PostgresCheckpointerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PostgresCheckpointerService.name);
  private pool: Pool | null = null;
  private saver: PostgresSaver | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.close();
  }

  /**
   * Initialize the PostgreSQL connection pool and checkpointer
   */
  private async initialize(): Promise<void> {
    try {
      // Build connection string from environment
      const host = this.configService.get<string>("DB_HOST");
      const port = this.configService.get<number>("DB_PORT");
      const database = this.configService.get<string>("DB_NAME");
      const user = this.configService.get<string>("DB_USER");
      const password = this.configService.get<string>("DB_PASSWORD");
      if (!host || !port || !database || !user || !password) {
        throw new Error(
          "Database configuration incomplete. Required env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD",
        );
      }

      const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

      this.logger.log(
        `Initializing PostgreSQL checkpointer: ${host}:${port}/${database}`,
      );

      // Create connection pool
      this.pool = new Pool({
        connectionString,
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      try {
        await client.query("SELECT 1");
        this.logger.log("PostgreSQL connection test successful");
      } finally {
        client.release();
      }

      // Create PostgresSaver with our pool
      this.saver = PostgresSaver.fromConnString(connectionString);

      // Set up the checkpoint tables (if not exists)
      await this.saver.setup();

      this.logger.log("PostgreSQL checkpointer initialized successfully");
    } catch (error) {
      this.logger.error(
        `Failed to initialize PostgreSQL checkpointer: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Close the connection pool
   */
  private async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.saver = null;
      this.logger.log("PostgreSQL checkpointer closed");
    }
  }

  /**
   * Get the PostgresSaver instance for use with StateGraph
   */
  getSaver(): PostgresSaver {
    if (!this.saver) {
      throw new Error("PostgreSQL checkpointer not initialized");
    }
    return this.saver;
  }

  /**
   * Get the connection pool for direct queries
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error("PostgreSQL connection pool not initialized");
    }
    return this.pool;
  }

  /**
   * Check if the checkpointer is ready
   */
  isReady(): boolean {
    return this.saver !== null && this.pool !== null;
  }

  /**
   * Execute a health check query
   */
  async healthCheck(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }
}
