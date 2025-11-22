import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerRegistryService } from './agent-runner-registry.service';
import { ContextAgentRunnerService } from './context-agent-runner.service';
import { ApiAgentRunnerService } from './api-agent-runner.service';
import { ExternalAgentRunnerService } from './external-agent-runner.service';
import { OrchestratorAgentRunnerService } from './orchestrator-agent-runner.service';
import { IAgentRunner } from '../interfaces/agent-runner.interface';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentTaskMode } from '../dto/task-request.dto';

// Mock runner for testing
class MockAgentRunner implements IAgentRunner {
  constructor(private readonly name: string) {}

  execute(): Promise<TaskResponseDto> {
    return Promise.resolve(
      TaskResponseDto.success(AgentTaskMode.CONVERSE, {
        content: { message: `Response from ${this.name}` },
        metadata: {},
      }),
    );
  }
}

describe('AgentRunnerRegistryService', () => {
  let service: AgentRunnerRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunnerRegistryService,
        {
          provide: ContextAgentRunnerService,
          useValue: new MockAgentRunner('context'),
        },
        {
          provide: ApiAgentRunnerService,
          useValue: new MockAgentRunner('api'),
        },
        {
          provide: ExternalAgentRunnerService,
          useValue: new MockAgentRunner('external'),
        },
        {
          provide: OrchestratorAgentRunnerService,
          useValue: new MockAgentRunner('orchestrator'),
        },
      ],
    }).compile();

    service = module.get<AgentRunnerRegistryService>(
      AgentRunnerRegistryService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerRunner', () => {
    it('should register a runner for a new agent type', () => {
      const mockRunner = new MockAgentRunner('custom');

      service.registerRunner('custom', mockRunner);

      expect(service.hasRunner('custom')).toBe(true);
      expect(service.getRunner('custom')).toBe(mockRunner);
    });

    it('should allow overwriting an existing runner', () => {
      const mockRunner1 = new MockAgentRunner('context-v1');
      const mockRunner2 = new MockAgentRunner('context-v2');

      service.registerRunner('context', mockRunner1);
      service.registerRunner('context', mockRunner2);

      const runner = service.getRunner('context');
      expect(runner).toBe(mockRunner2);
    });

    it('should register multiple runners for different types', () => {
      const custom1Runner = new MockAgentRunner('custom1');
      const custom2Runner = new MockAgentRunner('custom2');
      const custom3Runner = new MockAgentRunner('custom3');

      service.registerRunner('custom1', custom1Runner);
      service.registerRunner('custom2', custom2Runner);
      service.registerRunner('custom3', custom3Runner);

      // 4 auto-registered + 3 custom = 7
      expect(service.getRunnerCount()).toBe(7);
      expect(service.getRunner('custom1')).toBe(custom1Runner);
      expect(service.getRunner('custom2')).toBe(custom2Runner);
      expect(service.getRunner('custom3')).toBe(custom3Runner);
    });
  });

  describe('getRunner', () => {
    it('should return the runner for an auto-registered type', () => {
      const runner = service.getRunner('context');

      expect(runner).toBeDefined();
      expect(runner).not.toBeNull();
    });

    it('should return the runner for a newly registered type', () => {
      const mockRunner = new MockAgentRunner('custom');
      service.registerRunner('custom', mockRunner);

      const runner = service.getRunner('custom');

      expect(runner).toBe(mockRunner);
    });

    it('should return null for an unregistered type', () => {
      const runner = service.getRunner('unknown-type');

      expect(runner).toBeNull();
    });
  });

  describe('hasRunner', () => {
    it('should return true for auto-registered types', () => {
      expect(service.hasRunner('context')).toBe(true);
      expect(service.hasRunner('api')).toBe(true);
      expect(service.hasRunner('external')).toBe(true);
      expect(service.hasRunner('orchestrator')).toBe(true);
    });

    it('should return true for a newly registered type', () => {
      const mockRunner = new MockAgentRunner('custom');
      service.registerRunner('custom', mockRunner);

      expect(service.hasRunner('custom')).toBe(true);
    });

    it('should return false for an unregistered type', () => {
      expect(service.hasRunner('unknown-type')).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return all auto-registered agent types', () => {
      const types = service.getRegisteredTypes();

      // Registry auto-registers 4 types in constructor
      expect(types).toContain('context');
      expect(types).toContain('api');
      expect(types).toContain('external');
      expect(types).toContain('orchestrator');
      expect(types.length).toBe(4);
    });

    it('should return additional manually registered types', () => {
      service.registerRunner('custom', new MockAgentRunner('custom'));

      const types = service.getRegisteredTypes();

      expect(types).toContain('context');
      expect(types).toContain('api');
      expect(types).toContain('external');
      expect(types).toContain('orchestrator');
      expect(types).toContain('custom');
      expect(types.length).toBe(5);
    });
  });

  describe('getRunnerCount', () => {
    it('should return 4 for auto-registered runners', () => {
      // Registry auto-registers 4 runners in constructor
      expect(service.getRunnerCount()).toBe(4);
    });

    it('should return the correct count after adding more runners', () => {
      expect(service.getRunnerCount()).toBe(4);

      service.registerRunner('custom1', new MockAgentRunner('custom1'));
      expect(service.getRunnerCount()).toBe(5);

      service.registerRunner('custom2', new MockAgentRunner('custom2'));
      expect(service.getRunnerCount()).toBe(6);
    });
  });
});
