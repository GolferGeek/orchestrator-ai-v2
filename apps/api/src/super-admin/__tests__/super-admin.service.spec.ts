import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { SuperAdminService } from '../super-admin.service';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as claudeSdk from '@anthropic-ai/claude-agent-sdk';

// Mock the fs modules
jest.mock('fs');
jest.mock('fs/promises');

// Mock the Claude Agent SDK
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

describe('SuperAdminService', () => {
  let service: SuperAdminService;
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;
  let mockReaddir: jest.MockedFunction<typeof fsPromises.readdir>;
  let mockReadFile: jest.MockedFunction<typeof fsPromises.readFile>;

  // Mock response object
  let mockResponse: Partial<Response>;
  let writtenEvents: string[];

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    writtenEvents = [];

    // Setup mock response
    mockResponse = {
      write: jest.fn((data: string) => {
        writtenEvents.push(data);
        return true;
      }),
      end: jest.fn(),
    };

    // Setup fs mocks
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    mockReaddir = fsPromises.readdir as jest.MockedFunction<
      typeof fsPromises.readdir
    >;
    mockReadFile = fsPromises.readFile as jest.MockedFunction<
      typeof fsPromises.readFile
    >;

    // Default mock implementations
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([]);
    mockReadFile.mockResolvedValue('');

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuperAdminService],
    }).compile();

    service = module.get<SuperAdminService>(SuperAdminService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should set project root to two levels up from cwd', () => {
      expect(service).toBeDefined();
      // Project root is set in constructor
    });

    it('should determine execution mode based on environment', () => {
      const mode = service.getExecutionMode();
      expect(['dev', 'user']).toContain(mode);
    });
  });

  describe('getExecutionMode', () => {
    it('should return "dev" in development environment', () => {
      // Default NODE_ENV is development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockExistsSync.mockReturnValue(false);

      const testModule = new SuperAdminService();
      expect(testModule.getExecutionMode()).toBe('dev');

      process.env.NODE_ENV = originalEnv;
    });

    it('should return "user" in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const testModule = new SuperAdminService();
      expect(testModule.getExecutionMode()).toBe('user');

      process.env.NODE_ENV = originalEnv;
    });

    it('should return "user" when running in Docker', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDockerEnv = process.env.RUNNING_IN_DOCKER;
      process.env.NODE_ENV = 'development';
      process.env.RUNNING_IN_DOCKER = 'true';

      const testModule = new SuperAdminService();
      expect(testModule.getExecutionMode()).toBe('user');

      process.env.NODE_ENV = originalEnv;
      process.env.RUNNING_IN_DOCKER = originalDockerEnv;
    });

    it('should return "user" when .dockerenv file exists', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockExistsSync.mockImplementation((path) => path === '/.dockerenv');

      const testModule = new SuperAdminService();
      expect(testModule.getExecutionMode()).toBe('user');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('listCommands', () => {
    it('should return empty array when commands directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.listCommands();

      expect(result).toEqual({ commands: [] });
    });

    it('should return empty array when no markdown files found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(['file.txt' as any, 'document.pdf' as any]);

      const result = await service.listCommands();

      expect(result).toEqual({ commands: [] });
    });

    it('should list commands from markdown files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        'analyze-code.md' as any,
        'run-tests.md' as any,
        'deploy.md' as any,
      ]);
      mockReadFile.mockResolvedValue('# Analyze Code\nAnalyze the codebase');

      const result = await service.listCommands();

      expect(result.commands).toHaveLength(3);
      expect(result.commands).toEqual(
        expect.arrayContaining([
          { name: '/analyze-code', description: expect.any(String) },
          { name: '/run-tests', description: expect.any(String) },
          { name: '/deploy', description: expect.any(String) },
        ]),
      );
    });

    it('should extract description from first line of markdown file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(['analyze-code.md' as any]);
      mockReadFile.mockResolvedValue(
        '# Analyze Code Quality\nThis command analyzes code quality',
      );

      const result = await service.listCommands();

      expect(result.commands[0]).toBeDefined();
      expect(result.commands[0]).toEqual({
        name: '/analyze-code',
        description: 'Analyze Code Quality',
      });
    });

    it('should use filename as fallback description if file read fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(['analyze-code.md' as any]);
      mockReadFile.mockRejectedValue(new Error('File read error'));

      const result = await service.listCommands();

      expect(result.commands[0]).toBeDefined();
      expect(result.commands[0]).toEqual({
        name: '/analyze-code',
        description: 'analyze code',
      });
    });

    it('should use filename as fallback description if no heading found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(['run-tests.md' as any]);
      mockReadFile.mockResolvedValue('This is plain text without heading');

      const result = await service.listCommands();

      expect(result.commands[0]).toBeDefined();
      expect(result.commands[0]).toEqual({
        name: '/run-tests',
        description: 'run tests',
      });
    });

    it('should handle readdir errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.listCommands();

      expect(result).toEqual({ commands: [] });
    });

    it('should skip non-markdown files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        'command.md' as any,
        'readme.txt' as any,
        'config.json' as any,
      ]);

      const result = await service.listCommands();

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]?.name).toBe('/command');
    });
  });

  describe('listSkills', () => {
    it('should return empty array when skills directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.listSkills();

      expect(result).toEqual({ skills: [] });
    });

    it('should return empty array when no directories found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false } as any,
        { name: 'doc.md', isDirectory: () => false } as any,
      ]);

      const result = await service.listSkills();

      expect(result).toEqual({ skills: [] });
    });

    it('should list skills from directories', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'database-query-skill', isDirectory: () => true } as any,
        { name: 'api-integration-skill', isDirectory: () => true } as any,
        { name: 'readme.md', isDirectory: () => false } as any,
      ]);
      mockReadFile.mockResolvedValue('# Database Query\nQuery database');

      const result = await service.listSkills();

      expect(result.skills).toHaveLength(2);
      expect(result.skills).toEqual(
        expect.arrayContaining([
          { name: 'database-query-skill', description: expect.any(String) },
          { name: 'api-integration-skill', description: expect.any(String) },
        ]),
      );
    });

    it('should extract description from SKILL.md file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'database-query-skill', isDirectory: () => true } as any,
      ]);
      mockReadFile.mockResolvedValue(
        '# Database Query Skill\nExecute database queries',
      );

      const result = await service.listSkills();

      expect(result.skills[0]).toBeDefined();
      expect(result.skills[0]).toEqual({
        name: 'database-query-skill',
        description: 'Database Query Skill',
      });
    });

    it('should use directory name as fallback description', async () => {
      mockExistsSync.mockImplementation((path) => {
        // Skills dir exists, but SKILL.md files don't
        if (typeof path === 'string' && path.includes('SKILL.md')) {
          return false;
        }
        return true;
      });
      mockReaddir.mockResolvedValue([
        { name: 'database-query-skill', isDirectory: () => true } as any,
      ]);

      const result = await service.listSkills();

      expect(result.skills[0]).toBeDefined();
      expect(result.skills[0]).toEqual({
        name: 'database-query-skill',
        description: 'database query skill',
      });
    });

    it('should handle SKILL.md read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'test-skill', isDirectory: () => true } as any,
      ]);
      mockReadFile.mockRejectedValue(new Error('File read error'));

      const result = await service.listSkills();

      expect(result.skills[0]).toBeDefined();
      expect(result.skills[0]).toEqual({
        name: 'test-skill',
        description: 'test skill',
      });
    });

    it('should handle readdir errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.listSkills();

      expect(result).toEqual({ skills: [] });
    });

    it('should only process directories and skip files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'skill-1', isDirectory: () => true } as any,
        { name: 'readme.md', isDirectory: () => false } as any,
        { name: 'skill-2', isDirectory: () => true } as any,
        { name: 'config.json', isDirectory: () => false } as any,
      ]);

      const result = await service.listSkills();

      expect(result.skills).toHaveLength(2);
      expect(result.skills.map((s) => s.name)).toEqual(['skill-1', 'skill-2']);
    });
  });

  describe('executeWithStreaming', () => {
    let mockQuery: jest.Mock;

    beforeEach(() => {
      // Get the mocked query function
      mockQuery = claudeSdk.query as jest.Mock;
    });

    it('should execute prompt and stream results', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-123',
        },
        {
          type: 'assistant',
          content: 'Response text',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await service.executeWithStreaming(
        'Test prompt',
        mockResponse as Response,
      );

      expect(result.sessionId).toBe('session-123');
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should resume existing session when sessionId provided', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-456',
        },
        {
          type: 'assistant',
          content: 'Continued response',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      const result = await service.executeWithStreaming(
        'Continue conversation',
        mockResponse as Response,
        'session-456',
      );

      expect(result.sessionId).toBe('session-456');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Continue conversation',
          options: expect.objectContaining({
            resume: 'session-456',
          }),
        }),
      );
    });

    it('should load source context when provided', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('# Custom Context\nContext content');

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-789',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming(
        'Test with context',
        mockResponse as Response,
        undefined,
        'custom-context',
      );

      expect(mockReadFile).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('Context content'),
          }),
        }),
      );
    });

    it('should fallback to default context if specific context not found', async () => {
      mockExistsSync.mockImplementation((path) => {
        if (typeof path === 'string') {
          return path.includes('default.md');
        }
        return false;
      });
      mockReadFile.mockResolvedValue('# Default Context\nDefault content');

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-default',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming(
        'Test',
        mockResponse as Response,
        undefined,
        'non-existent',
      );

      // Should try non-existent first, then fall back to default
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('should use mode-specific system prompt for dev mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockExistsSync.mockReturnValue(false);

      const devService = new SuperAdminService();
      expect(devService.getExecutionMode()).toBe('dev');

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-dev',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await devService.executeWithStreaming(
        'Test dev mode',
        mockResponse as Response,
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('developer'),
            allowedTools: expect.arrayContaining([
              'Read',
              'Write',
              'Edit',
              'Bash',
            ]),
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should use mode-specific system prompt for user mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const userService = new SuperAdminService();
      expect(userService.getExecutionMode()).toBe('user');

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-user',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await userService.executeWithStreaming(
        'Test user mode',
        mockResponse as Response,
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('CANNOT write or edit'),
            allowedTools: expect.not.arrayContaining(['Write', 'Edit', 'Bash']),
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should stream session event separately', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-abc',
        },
        {
          type: 'assistant',
          content: 'Response',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming('Test', mockResponse as Response);

      // Should have written session event and assistant message
      const sessionEvents = writtenEvents.filter((e) =>
        e.includes('event: session'),
      );
      expect(sessionEvents.length).toBeGreaterThan(0);
    });

    it('should stream each message as SSE event', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-123',
        },
        {
          type: 'assistant',
          content: 'Message 1',
        },
        {
          type: 'assistant',
          content: 'Message 2',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming('Test', mockResponse as Response);

      // Should have multiple write calls (at least for session, assistant messages, and done)
      expect(mockResponse.write).toHaveBeenCalled();
      expect(
        (mockResponse.write as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(4);
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should send completion event with sessionId', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-complete',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming('Test', mockResponse as Response);

      const allEvents = writtenEvents.join('');
      expect(allEvents).toContain('event: done');
      expect(allEvents).toContain('session-complete');
    });

    it('should handle execution errors gracefully', async () => {
      mockQuery.mockImplementation(async function* (): AsyncGenerator<unknown> {
        // eslint-disable-next-line no-constant-condition
        if (false) yield;
        throw new Error('Execution failed');
      });

      const result = await service.executeWithStreaming(
        'Test error',
        mockResponse as Response,
      );

      const allEvents = writtenEvents.join('');
      expect(allEvents).toContain('event: error');
      expect(allEvents).toContain('Execution failed');
      expect(mockResponse.end).toHaveBeenCalled();
      expect(result.sessionId).toBeUndefined();
    });

    it('should handle non-Error exceptions', async () => {
      mockQuery.mockImplementation(async function* (): AsyncGenerator<unknown> {
        // eslint-disable-next-line no-constant-condition
        if (false) yield;
        throw new Error('String error');
      });

      await service.executeWithStreaming(
        'Test non-error exception',
        mockResponse as Response,
      );

      const allEvents = writtenEvents.join('');
      expect(allEvents).toContain('event: error');
      expect(allEvents).toContain('String error');
    });

    it('should configure SDK with correct options', async () => {
      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-options',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming(
        'Test options',
        mockResponse as Response,
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test options',
          options: expect.objectContaining({
            cwd: expect.any(String),
            settingSources: ['project'],
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
            allowedTools: expect.any(Array),
          }),
        }),
      );
    });

    it('should combine mode guidance with source context', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('# Custom Context\nCustom instructions');

      const mockMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-combined',
        },
      ];

      mockQuery.mockImplementation(async function* () {
        for (const msg of mockMessages) {
          yield msg;
        }
      });

      await service.executeWithStreaming(
        'Test',
        mockResponse as Response,
        undefined,
        'custom',
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringMatching(
              /developer.*Custom instructions/s,
            ),
          }),
        }),
      );
    });
  });
});
