import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * RAG Database Service
 *
 * Provides direct PostgreSQL connection to the rag_data database.
 * Uses pg Pool for connection pooling and efficient query execution.
 *
 * This is separate from the main Supabase connection because:
 * 1. RAG uses a different database (rag_data vs postgres)
 * 2. RAG operations use PostgreSQL functions for org isolation
 * 3. Vector operations require direct pg connection
 */
@Injectable()
export class RagDatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly logger = new Logger(RagDatabaseService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializePool();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('RAG database pool closed');
    }
  }

  private async initializePool() {
    const connectionString = this.configService.get<string>('RAG_DATABASE_URL');

    if (!connectionString) {
      this.logger.warn(
        'RAG_DATABASE_URL not configured - RAG features disabled',
      );
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.logger.log('RAG database pool initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize RAG database pool',
        error instanceof Error ? error.stack : String(error),
      );
      this.pool = null;
    }
  }

  /**
   * Check if RAG database is available
   */
  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Execute a query against the RAG database
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('RAG database not available');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        this.logger.warn(
          `Slow RAG query (${duration}ms): ${text.substring(0, 100)}...`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `RAG query failed: ${text.substring(0, 100)}...`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Get a client from the pool for transaction support
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('RAG database not available');
    }
    return this.pool.connect();
  }

  /**
   * Execute a function within a transaction
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check for the RAG database
   */
  async checkHealth(): Promise<{ status: string; message: string }> {
    if (!this.pool) {
      return { status: 'disabled', message: 'RAG database not configured' };
    }

    try {
      const result = await this.pool.query<{ time: Date }>(
        'SELECT NOW() as time',
      );
      return {
        status: 'ok',
        message: `Connected at ${String(result.rows[0]?.time ?? 'unknown')}`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
