import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataAnalystController } from './data-analyst.controller';
import { DataAnalystService, DataAnalystResult, DataAnalystStatus } from './data-analyst.service';
import { DataAnalystRequestDto } from './dto';

/**
 * Unit tests for DataAnalystController
 *
 * Tests the REST API endpoints for the Data Analyst agent.
 */
describe('DataAnalystController', () => {
  let controller: DataAnalystController;
  let service: jest.Mocked<DataAnalystService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAnalystController],
      providers: [
        {
          provide: DataAnalystService,
          useValue: {
            analyze: jest.fn(),
            getStatus: jest.fn(),
            getHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DataAnalystController>(DataAnalystController);
    service = module.get(DataAnalystService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /data-analyst/analyze', () => {
    const validRequest: DataAnalystRequestDto = {
      taskId: 'task-123',
      userId: 'user-456',
      conversationId: 'conv-789',
      question: 'How many users are there?',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    it('should return success for completed analysis', async () => {
      const mockResult: DataAnalystResult = {
        threadId: 'thread-abc',
        status: 'completed',
        question: validRequest.question,
        summary: 'There are 100 users in the database.',
        generatedSql: 'SELECT COUNT(*) FROM users',
        sqlResults: 'count: 100',
        duration: 5000,
      };

      service.analyze.mockResolvedValue(mockResult);

      const result = await controller.analyze(validRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(service.analyze).toHaveBeenCalledWith({
        taskId: 'task-123',
        userId: 'user-456',
        conversationId: 'conv-789',
        organizationSlug: undefined,
        question: 'How many users are there?',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });
    });

    it('should return success=false for failed analysis', async () => {
      const mockResult: DataAnalystResult = {
        threadId: 'thread-abc',
        status: 'failed',
        question: validRequest.question,
        error: 'Database connection failed',
        duration: 1000,
      };

      service.analyze.mockResolvedValue(mockResult);

      const result = await controller.analyze(validRequest);

      expect(result.success).toBe(false);
      expect(result.data.status).toBe('failed');
      expect(result.data.error).toBe('Database connection failed');
    });

    it('should throw BadRequestException on service error', async () => {
      service.analyze.mockRejectedValue(new Error('Invalid input'));

      await expect(controller.analyze(validRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass all request parameters to service', async () => {
      const fullRequest: DataAnalystRequestDto = {
        taskId: 'task-full',
        userId: 'user-full',
        conversationId: 'conv-full',
        organizationSlug: 'org-full',
        question: 'Full query',
        provider: 'openai',
        model: 'gpt-4',
      };

      service.analyze.mockResolvedValue({
        threadId: 'thread-full',
        status: 'completed',
        question: fullRequest.question,
        duration: 1000,
      });

      await controller.analyze(fullRequest);

      expect(service.analyze).toHaveBeenCalledWith({
        taskId: 'task-full',
        userId: 'user-full',
        conversationId: 'conv-full',
        organizationSlug: 'org-full',
        question: 'Full query',
        provider: 'openai',
        model: 'gpt-4',
      });
    });
  });

  describe('GET /data-analyst/status/:threadId', () => {
    it('should return status for existing thread', async () => {
      const mockStatus: DataAnalystStatus = {
        threadId: 'thread-123',
        status: 'completed',
        question: 'Test question',
        summary: 'Test summary',
      };

      service.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus('thread-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStatus);
      expect(service.getStatus).toHaveBeenCalledWith('thread-123');
    });

    it('should throw NotFoundException for non-existent thread', async () => {
      service.getStatus.mockResolvedValue(null);

      await expect(controller.getStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return in-progress status', async () => {
      const mockStatus: DataAnalystStatus = {
        threadId: 'thread-123',
        status: 'querying',
        question: 'Test question',
      };

      service.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus('thread-123');

      expect(result.data.status).toBe('querying');
    });

    it('should return failed status with error', async () => {
      const mockStatus: DataAnalystStatus = {
        threadId: 'thread-123',
        status: 'failed',
        question: 'Test question',
        error: 'Something went wrong',
      };

      service.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus('thread-123');

      expect(result.data.status).toBe('failed');
      expect(result.data.error).toBe('Something went wrong');
    });
  });

  describe('GET /data-analyst/history/:threadId', () => {
    it('should return history for existing thread', async () => {
      const mockHistory = [
        { status: 'started', question: 'Test', taskId: 't1', threadId: 'th1', userId: 'u1' },
        { status: 'discovering', question: 'Test', taskId: 't1', threadId: 'th1', userId: 'u1' },
        { status: 'completed', question: 'Test', taskId: 't1', threadId: 'th1', userId: 'u1', summary: 'Done' },
      ];

      service.getHistory.mockResolvedValue(mockHistory as never);

      const result = await controller.getHistory('thread-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.count).toBe(3);
    });

    it('should throw NotFoundException for empty history', async () => {
      service.getHistory.mockResolvedValue([]);

      await expect(controller.getHistory('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return history in correct order', async () => {
      const mockHistory = [
        { status: 'started', taskId: 't1', threadId: 'th1', userId: 'u1', question: 'Q' },
        { status: 'completed', taskId: 't1', threadId: 'th1', userId: 'u1', question: 'Q' },
      ];

      service.getHistory.mockResolvedValue(mockHistory as never);

      const result = await controller.getHistory('thread-123');

      expect(result.data[0].status).toBe('started');
      expect(result.data[1].status).toBe('completed');
    });
  });
});
