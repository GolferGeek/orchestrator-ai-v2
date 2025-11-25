import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PostgresCheckpointerService } from '../persistence/postgres-checkpointer.service';

/**
 * ListTablesTool
 *
 * Lists all available tables in the database that the agent can query.
 * Returns table names with their schemas.
 */
@Injectable()
export class ListTablesTool {
  private readonly logger = new Logger(ListTablesTool.name);

  constructor(
    private readonly checkpointerService: PostgresCheckpointerService,
  ) {}

  /**
   * Create the LangGraph tool instance
   */
  createTool() {
    return tool(
      async (_input: { schema?: string }) => {
        return this.execute(_input.schema);
      },
      {
        name: 'list_tables',
        description:
          'Lists all available database tables. Use this to discover what tables exist before writing SQL queries.',
        schema: z.object({
          schema: z
            .string()
            .optional()
            .describe(
              'Optional schema name to filter tables. Defaults to public.',
            ),
        }),
      },
    );
  }

  /**
   * Execute the list tables query
   */
  async execute(schema?: string): Promise<string> {
    const targetSchema = schema || 'public';

    try {
      const pool = this.checkpointerService.getPool();

      const query = `
        SELECT
          table_schema,
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      const result = await pool.query(query, [targetSchema]);

      if (result.rows.length === 0) {
        return `No tables found in schema '${targetSchema}'.`;
      }

      const tableList = result.rows
        .map(
          (row: { table_schema: string; table_name: string }) =>
            `- ${row.table_schema}.${row.table_name}`,
        )
        .join('\n');

      return `Available tables in '${targetSchema}' schema:\n${tableList}`;
    } catch (error) {
      this.logger.error('Failed to list tables', error);
      return `Error listing tables: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
