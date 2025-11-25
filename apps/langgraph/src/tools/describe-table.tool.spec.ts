import { Test, TestingModule } from '@nestjs/testing';
import { DescribeTableTool } from './describe-table.tool';

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
 * Unit tests for DescribeTableTool
 *
 * Tests the tool that describes database table schemas.
 */
describe('DescribeTableTool', () => {
  let tool: DescribeTableTool;
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
        DescribeTableTool,
        {
          provide: PostgresCheckpointerService,
          useValue: {
            getPool: jest.fn().mockReturnValue(mockPool),
            isReady: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    tool = module.get<DescribeTableTool>(DescribeTableTool);
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
      expect(langGraphTool.name).toBe('describe_table');
    });
  });

  describe('execute', () => {
    it('should return table schema with columns', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            character_maximum_length: null,
            is_nullable: 'NO',
            column_default: "nextval('users_id_seq'::regclass)",
            key_type: 'PRIMARY KEY',
          },
          {
            column_name: 'email',
            data_type: 'character varying',
            character_maximum_length: 255,
            is_nullable: 'NO',
            column_default: null,
            key_type: '',
          },
          {
            column_name: 'name',
            data_type: 'character varying',
            character_maximum_length: 100,
            is_nullable: 'YES',
            column_default: null,
            key_type: '',
          },
        ],
      });

      const result = await tool.execute('users');

      expect(result).toContain('Table: public.users');
      expect(result).toContain('id: integer NOT NULL');
      expect(result).toContain('[PRIMARY KEY]');
      expect(result).toContain('email: character varying(255) NOT NULL');
      expect(result).toContain('name: character varying(100) NULL');
    });

    it('should use specified schema', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            column_name: 'id',
            data_type: 'uuid',
            character_maximum_length: null,
            is_nullable: 'NO',
            column_default: 'gen_random_uuid()',
            key_type: 'PRIMARY KEY',
          },
        ],
      });

      const result = await tool.execute('documents', 'rag_data');

      expect(result).toContain('Table: rag_data.documents');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['rag_data', 'documents'],
      );
    });

    it('should include column defaults', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            column_name: 'created_at',
            data_type: 'timestamp with time zone',
            character_maximum_length: null,
            is_nullable: 'NO',
            column_default: 'CURRENT_TIMESTAMP',
            key_type: '',
          },
        ],
      });

      const result = await tool.execute('events');

      expect(result).toContain('DEFAULT CURRENT_TIMESTAMP');
    });

    it('should return message when table not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await tool.execute('nonexistent_table');

      expect(result).toContain("Table 'public.nonexistent_table' not found");
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Permission denied'));

      const result = await tool.execute('restricted_table');

      expect(result).toContain('Error describing table');
      expect(result).toContain('Permission denied');
    });

    it('should handle character_maximum_length for varchar columns', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            column_name: 'description',
            data_type: 'character varying',
            character_maximum_length: 500,
            is_nullable: 'YES',
            column_default: null,
            key_type: '',
          },
        ],
      });

      const result = await tool.execute('products');

      expect(result).toContain('character varying(500)');
    });

    it('should not show length for types without max length', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            column_name: 'amount',
            data_type: 'numeric',
            character_maximum_length: null,
            is_nullable: 'NO',
            column_default: '0',
            key_type: '',
          },
        ],
      });

      const result = await tool.execute('transactions');

      expect(result).toContain('amount: numeric NOT NULL');
      expect(result).not.toContain('numeric(');
    });

    it('should default to public schema', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await tool.execute('some_table');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['public', 'some_table'],
      );
    });
  });
});
