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
 * Provides direct PostgreSQL connection to the rag_data schema.
 * Uses pg Pool for connection pooling and efficient query execution.
 *
 * RAG data is stored in the rag_data schema within the main postgres database.
 * This uses the same DATABASE_URL as the main app but sets search_path to rag_data.
 * RAG operations use PostgreSQL functions for org isolation and vector operations.
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
    // Use main DATABASE_URL - RAG data is in rag_data schema within postgres database
    const connectionString = this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      this.logger.warn('DATABASE_URL not configured - RAG features disabled');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection and set search_path to rag_data schema
      const client = await this.pool.connect();
      await client.query('SET search_path TO rag_data, public');
      await client.query('SELECT 1');
      client.release();

      this.logger.log(
        'RAG database pool initialized successfully (using rag_data schema)',
      );
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
   * Execute a query against the RAG database (rag_data schema)
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
      // Ensure we're using the rag_data schema for each query
      const client = await this.pool.connect();
      try {
        await client.query('SET search_path TO rag_data, public');
        const result = await client.query<T>(text, params);
        const duration = Date.now() - start;

        if (duration > 1000) {
          this.logger.warn(
            `Slow RAG query (${duration}ms): ${text.substring(0, 100)}...`,
          );
        }

        return result;
      } finally {
        client.release();
      }
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
   * Execute a query without returning results (for INSERT/UPDATE/DELETE)
   */
  async execute(text: string, params?: unknown[]): Promise<void> {
    await this.query(text, params);
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
   * Execute a function within a transaction (with rag_data schema)
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('SET search_path TO rag_data, public');
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
