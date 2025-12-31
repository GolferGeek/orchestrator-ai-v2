import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityService } from '../observability.service';
import type { HumanInTheLoopResponse, HookEvent } from '../../types';

// Mock the ws module
jest.mock('ws', () => ({
  WebSocket: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
  })),
}));

describe('ObservabilityService', () => {
  let service: ObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObservabilityService],
    }).compile();

    service = module.get<ObservabilityService>(ObservabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendResponseToAgent', () => {
    it('should be a function', () => {
      expect(typeof service.sendResponseToAgent).toBe('function');
    });

    it('should reject on timeout when WebSocket never opens', async () => {
      // The mock WebSocket never fires 'open', so it should timeout
      const mockHookEvent: HookEvent = {
        source_app: 'test-app',
        session_id: 'session-123',
        hook_event_type: 'hitl',
        payload: {},
      };

      const response: HumanInTheLoopResponse = {
        response: 'Test response',
        hookEvent: mockHookEvent,
        respondedAt: Date.now(),
      };

      await expect(
        service.sendResponseToAgent('ws://localhost:9999', response),
      ).rejects.toThrow('Timeout sending response to agent');
    }, 10000);
  });
});
