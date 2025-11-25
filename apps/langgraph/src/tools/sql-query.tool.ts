import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresCheckpointerService } from '../persistence/postgres-checkpointer.service';
import { LLMUsageReporterService } from '../services/llm-usage-reporter.service';

/**
 * SqlQueryTool
 *
 * Executes read-only SQL queries against the database.
 * Uses Ollama/SQLCoder for natural language to SQL generation.
 * Reports LLM usage via the LLMUsageReporterService.
 */
@Injectable()
export class SqlQueryTool {
  private readonly logger = new Logger(SqlQueryTool.name);
  private readonly ollamaBaseUrl: string;
  private readonly sqlCoderModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly checkpointerService: PostgresCheckpointerService,
    private readonly usageReporter: LLMUsageReporterService,
  ) {
    this.ollamaBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.sqlCoderModel =
      this.configService.get<string>('SQLCODER_MODEL') || 'sqlcoder';
  }

  /**
   * Create the LangGraph tool instance for executing pre-written SQL
   *
   * Note: This method uses dynamic require to avoid TypeScript's deep type
   * instantiation limits with LangChain's tool types.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createTool(): any {
    // Import dynamically to avoid type inference at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamicStructuredTool } = require('@langchain/core/tools');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod');

    return new DynamicStructuredTool({
      name: 'execute_sql',
      description:
        'Executes a read-only SQL query against the database. Only SELECT statements are allowed. Use list_tables and describe_table first to understand the schema.',
      schema: z.object({
        sql: z
          .string()
          .describe('The SQL SELECT query to execute. Must be read-only.'),
        params: z
          .array(z.unknown())
          .optional()
          .describe('Optional query parameters for parameterized queries.'),
      }),
      func: async (input: { sql: string; params?: unknown[] }): Promise<string> => {
        return this.executeSql(input.sql, input.params);
      },
    });
  }

  /**
   * Create the LangGraph tool instance for natural language to SQL
   *
   * Note: This method uses dynamic require to avoid TypeScript's deep type
   * instantiation limits with LangChain's tool types.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createNaturalLanguageTool(context: {
    userId: string;
    taskId?: string;
    threadId?: string;
    conversationId?: string;
  }): any {
    // Import dynamically to avoid type inference at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamicStructuredTool } = require('@langchain/core/tools');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod');

    return new DynamicStructuredTool({
      name: 'query_database',
      description:
        'Converts a natural language question into SQL and executes it. Provide the question and relevant table schema information.',
      schema: z.object({
        question: z
          .string()
          .describe('The natural language question to answer with SQL.'),
        tableContext: z
          .string()
          .describe(
            'The relevant table schemas (from describe_table) to help generate accurate SQL.',
          ),
      }),
      func: async (input: { question: string; tableContext: string }): Promise<string> => {
        return this.generateAndExecuteSql(
          input.question,
          input.tableContext,
          context,
        );
      },
    });
  }

  /**
   * Execute a pre-written SQL query (read-only)
   */
  async executeSql(sql: string, params?: unknown[]): Promise<string> {
    // Validate read-only
    const normalizedSql = sql.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT')) {
      return 'Error: Only SELECT queries are allowed. This tool is read-only.';
    }

    // Block dangerous patterns
    const dangerousPatterns = [
      /INSERT\s+INTO/i,
      /UPDATE\s+/i,
      /DELETE\s+FROM/i,
      /DROP\s+/i,
      /CREATE\s+/i,
      /ALTER\s+/i,
      /TRUNCATE\s+/i,
      /GRANT\s+/i,
      /REVOKE\s+/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        return 'Error: Query contains forbidden SQL operations. Only SELECT is allowed.';
      }
    }

    try {
      const pool = this.checkpointerService.getPool();
      const result = await pool.query(sql, params || []);

      if (result.rows.length === 0) {
        return 'Query returned no results.';
      }

      // Format results as a table-like string
      const columns = Object.keys(result.rows[0]);
      const header = columns.join(' | ');
      const separator = columns.map(() => '---').join(' | ');
      const rows = result.rows
        .slice(0, 100) // Limit to 100 rows
        .map((row: Record<string, unknown>) =>
          columns.map((col) => String(row[col] ?? 'NULL')).join(' | '),
        )
        .join('\n');

      const truncated = result.rows.length > 100 ? '\n... (truncated)' : '';

      return `Results (${result.rows.length} rows):\n${header}\n${separator}\n${rows}${truncated}`;
    } catch (error) {
      this.logger.error('SQL execution failed', error);
      return `SQL Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Generate SQL from natural language using Ollama/SQLCoder and execute it
   */
  async generateAndExecuteSql(
    question: string,
    tableContext: string,
    context: {
      userId: string;
      taskId?: string;
      threadId?: string;
      conversationId?: string;
    },
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Generate SQL using Ollama/SQLCoder
      const prompt = this.buildSqlCoderPrompt(question, tableContext);
      const sql = await this.callOllama(prompt);

      if (!sql) {
        return 'Failed to generate SQL from the question.';
      }

      // Report usage
      const latencyMs = Date.now() - startTime;
      await this.usageReporter.reportSQLCoderUsage({
        promptTokens: this.usageReporter.estimateTokens(prompt),
        completionTokens: this.usageReporter.estimateTokens(sql),
        userId: context.userId,
        taskId: context.taskId,
        threadId: context.threadId,
        conversationId: context.conversationId,
        latencyMs,
      });

      // Execute the generated SQL
      const result = await this.executeSql(sql);

      return `Generated SQL:\n\`\`\`sql\n${sql}\n\`\`\`\n\n${result}`;
    } catch (error) {
      this.logger.error('Failed to generate and execute SQL', error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Build the prompt for SQLCoder
   */
  private buildSqlCoderPrompt(question: string, tableContext: string): string {
    return `### Task
Generate a SQL query to answer the following question:
"${question}"

### Database Schema
${tableContext}

### Instructions
- Generate only a SELECT query (read-only)
- Use proper PostgreSQL syntax
- Return only the SQL query, no explanations
- If you cannot generate a valid query, respond with "-- Unable to generate query"

### SQL Query
`;
  }

  /**
   * Call Ollama API for SQL generation
   */
  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.sqlCoderModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent SQL
            num_predict: 500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      const sql = data.response.trim();

      // Clean up the response - extract just the SQL
      const sqlMatch = sql.match(/SELECT[\s\S]+?;/i);
      return sqlMatch ? sqlMatch[0] : sql;
    } catch (error) {
      this.logger.error('Ollama API call failed', error);
      throw error;
    }
  }
}
