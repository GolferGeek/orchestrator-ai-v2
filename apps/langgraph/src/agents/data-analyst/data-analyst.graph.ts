import { StateGraph, END } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  DataAnalystStateAnnotation,
  DataAnalystState,
} from './data-analyst.state';
import { ListTablesTool } from '../../tools/list-tables.tool';
import { DescribeTableTool } from '../../tools/describe-table.tool';
import { SqlQueryTool } from '../../tools/sql-query.tool';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';

const AGENT_SLUG = 'data-analyst';

/**
 * Create the Data Analyst graph
 *
 * Flow:
 * 1. Start → Discover tables
 * 2. Discover → Describe relevant tables
 * 3. Describe → Generate and execute SQL
 * 4. Execute → Summarize results
 * 5. Summarize → End
 */
export function createDataAnalystGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
  listTablesTool: ListTablesTool,
  describeTableTool: DescribeTableTool,
  sqlQueryTool: SqlQueryTool,
) {
  // Note: Tools are called directly via their execute methods rather than
  // through ToolNode, as this provides better control over the workflow.

  // Node: Start analysis
  async function startNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitStarted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      organizationSlug: state.organizationSlug,
      message: `Starting data analysis for question: ${state.question}`,
    });

    return {
      status: 'discovering',
      startedAt: Date.now(),
      messages: [new HumanMessage(state.question)],
    };
  }

  // Node: Discover available tables
  async function discoverTablesNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Discovering available database tables',
      step: 'discover_tables',
      progress: 20,
    });

    try {
      const tablesResult = await listTablesTool.execute('public');

      // Parse table names from result
      const tableNames = tablesResult
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.replace('- public.', '').trim());

      return {
        availableTables: tableNames,
        toolResults: [
          {
            toolName: 'list_tables',
            result: tablesResult,
            success: true,
          },
        ],
      };
    } catch (error) {
      return {
        error: `Failed to discover tables: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
      };
    }
  }

  // Node: Use LLM to decide which tables to describe
  async function planSchemaNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Planning which tables to examine',
      step: 'plan_schema',
      progress: 30,
    });

    const prompt = `You are a data analyst. Based on the user's question and available tables, decide which tables need to be examined.

User's Question: ${state.question}

Available Tables:
${state.availableTables.map((t) => `- ${t}`).join('\n')}

Return ONLY a JSON array of table names that are relevant to answering the question. Example: ["users", "orders"]
If no tables seem relevant, return an empty array: []`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      // Parse the JSON array from response
      const jsonMatch = response.text.match(/\[[\s\S]*?\]/);
      const relevantTables: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return {
        messages: [
          ...state.messages,
          new AIMessage(`I'll examine these tables: ${relevantTables.join(', ')}`),
        ],
        status: 'querying',
      };
    } catch (error) {
      // If LLM fails, examine all tables
      return {
        status: 'querying',
      };
    }
  }

  // Node: Describe relevant tables
  async function describeTablesNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Examining table schemas',
      step: 'describe_tables',
      progress: 40,
    });

    const schemas: Record<string, string> = {};
    const toolResults: Array<{ toolName: string; result: string; success: boolean }> = [];

    // Describe up to 5 tables to avoid overwhelming the context
    const tablesToDescribe = state.availableTables.slice(0, 5);

    for (const tableName of tablesToDescribe) {
      try {
        const schema = await describeTableTool.execute(tableName);
        schemas[tableName] = schema;
        toolResults.push({
          toolName: 'describe_table',
          result: schema,
          success: true,
        });
      } catch (error) {
        toolResults.push({
          toolName: 'describe_table',
          result: `Error: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        });
      }
    }

    return {
      tableSchemas: schemas,
      toolResults,
    };
  }

  // Node: Generate and execute SQL
  async function executeQueryNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating and executing SQL query',
      step: 'execute_query',
      progress: 60,
    });

    // Build schema context for SQL generation
    const schemaContext = Object.entries(state.tableSchemas)
      .map(([table, schema]) => `${schema}`)
      .join('\n\n');

    // Use the natural language tool to generate and execute SQL
    const result = await sqlQueryTool.generateAndExecuteSql(
      state.question,
      schemaContext,
      {
        userId: state.userId,
        taskId: state.taskId,
        threadId: state.threadId,
        conversationId: state.conversationId,
      },
    );

    // Extract SQL from result
    const sqlMatch = result.match(/```sql\n([\s\S]*?)\n```/);
    const generatedSql = sqlMatch ? sqlMatch[1] : undefined;

    return {
      generatedSql,
      sqlResults: result,
      toolResults: [
        {
          toolName: 'execute_sql',
          result,
          success: !result.includes('Error:'),
        },
      ],
      status: 'summarizing',
    };
  }

  // Node: Summarize results
  async function summarizeNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Summarizing results',
      step: 'summarize',
      progress: 80,
    });

    const prompt = `You are a data analyst. Summarize the following SQL query results to answer the user's question.

User's Question: ${state.question}

SQL Query and Results:
${state.sqlResults}

Provide a clear, concise summary that directly answers the user's question. If the query failed or returned no results, explain what happened and suggest alternatives.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      await observability.emitCompleted({
        taskId: state.taskId,
        threadId: state.threadId,
        agentSlug: AGENT_SLUG,
        userId: state.userId,
        conversationId: state.conversationId,
        result: { summary: response.text },
        duration: Date.now() - state.startedAt,
      });

      return {
        summary: response.text,
        status: 'completed',
        completedAt: Date.now(),
        messages: [
          ...state.messages,
          new AIMessage(response.text),
        ],
      };
    } catch (error) {
      await observability.emitFailed({
        taskId: state.taskId,
        threadId: state.threadId,
        agentSlug: AGENT_SLUG,
        userId: state.userId,
        conversationId: state.conversationId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - state.startedAt,
      });

      return {
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
        completedAt: Date.now(),
      };
    }
  }

  // Node: Handle errors (named 'handle_error' to avoid conflict with 'error' state channel)
  async function handleErrorNode(state: DataAnalystState): Promise<Partial<DataAnalystState>> {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      error: state.error || 'Unknown error',
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'failed',
      completedAt: Date.now(),
    };
  }

  // Build the graph
  const graph = new StateGraph(DataAnalystStateAnnotation)
    .addNode('start', startNode)
    .addNode('discover_tables', discoverTablesNode)
    .addNode('plan_schema', planSchemaNode)
    .addNode('describe_tables', describeTablesNode)
    .addNode('execute_query', executeQueryNode)
    .addNode('summarize', summarizeNode)
    .addNode('handle_error', handleErrorNode)
    // Edges
    .addEdge('__start__', 'start')
    .addEdge('start', 'discover_tables')
    .addConditionalEdges('discover_tables', (state) => {
      if (state.error) return 'handle_error';
      if (state.availableTables.length === 0) return 'handle_error';
      return 'plan_schema';
    })
    .addEdge('plan_schema', 'describe_tables')
    .addEdge('describe_tables', 'execute_query')
    .addConditionalEdges('execute_query', (state) => {
      if (state.error) return 'handle_error';
      return 'summarize';
    })
    .addEdge('summarize', END)
    .addEdge('handle_error', END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type DataAnalystGraph = ReturnType<typeof createDataAnalystGraph>;
