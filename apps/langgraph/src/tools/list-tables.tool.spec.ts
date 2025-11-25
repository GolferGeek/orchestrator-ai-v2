import { Test, TestingModule } from '@nestjs/testing';
import { ListTablesTool } from './list-tables.tool';

// Mock PostgresSaver before any imports that need it
jest.mock('@langchain/langgraph-checkpoint-postgres', () => ({
  PostgresSaver: {
    fromConnString: jest.fn(() => ({
      setup: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

import { PostgresCheckpointerService } from '../persistence/postgres-checkpointer.service';

/**
 * Unit tests for ListTablesTool
 *
 * Tests the tool that lists available database tables.
 */
describe('ListTablesTool', () => {
  let tool: ListTablesTool;
  let checkpointer: jest.Mocked<PostgresCheckpointerService>;
  let mockPool: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListTablesTool,
        {
          provide: PostgresCheckpointerService,
          useValue: {
            getPool: jest.fn().mockReturnValue(mockPool),
            isReady: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    tool = module.get<ListTablesTool>(ListTablesTool);
    checkpointer = module.get(PostgresCheckpointerService);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('createTool', () => {
    it('should create a LangGraph tool instance', () => {
      const langGraphTool = tool.createTool();

      // Verify it returns a tool object
      expect(langGraphTool).toBeDefined();
      // Tool should have a name property
      expect(langGraphTool.name).toBe('list_tables');
    });
  });

  describe('execute', () => {
    it('should return list of tables in public schema by default', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { table_schema: 'public', table_name: 'users' },
          { table_schema: 'public', table_name: 'orders' },
          { table_schema: 'public', table_name: 'products' },
        ],
      });

      const result = await tool.execute();

      expect(result).toContain("Available tables in 'public' schema:");
      expect(result).toContain('public.users');
      expect(result).toContain('public.orders');
      expect(result).toContain('public.products');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.tables'),
        ['public'],
      );
    });

    it('should filter by specified schema', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { table_schema: 'rag_data', table_name: 'documents' },
          { table_schema: 'rag_data', table_name: 'embeddings' },
        ],
      });

      const result = await tool.execute('rag_data');

      expect(result).toContain("Available tables in 'rag_data' schema:");
      expect(result).toContain('rag_data.documents');
      expect(result).toContain('rag_data.embeddings');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['rag_data'],
      );
    });

    it('should return message when no tables found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await tool.execute('empty_schema');

      expect(result).toBe("No tables found in schema 'empty_schema'.");
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      const result = await tool.execute();

      expect(result).toContain('Error listing tables');
      expect(result).toContain('Connection refused');
    });

    it('should only query BASE TABLE types', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await tool.execute();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("table_type = 'BASE TABLE'"),
        expect.any(Array),
      );
    });

    it('should order results by table name', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await tool.execute();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY table_name'),
        expect.any(Array),
      );
    });
  });
});
