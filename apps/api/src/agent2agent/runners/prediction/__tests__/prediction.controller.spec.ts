/**
 * Prediction Controller Tests
 *
 * Tests the PredictionController REST API endpoints.
 * Uses mocked services to isolate controller logic.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PredictionController } from '../prediction.controller';
import { AmbientAgentOrchestratorService } from '../ambient-agent-orchestrator.service';
import { PredictionDbService } from '../base/services/prediction-db.service';
import { SupabaseService } from '../../../../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../../../../auth/dto/auth.dto';
import { AgentStatus } from '../base/base-prediction.types';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';

describe('PredictionController', () => {
  let controller: PredictionController;
  let orchestratorService: jest.Mocked<AmbientAgentOrchestratorService>;

  const mockUser: SupabaseAuthUserDto = {
    id: 'user-1',
    email: 'test@example.com',
  };

  const mockAgentId = 'agent-123';

  const mockAgent = {
    id: mockAgentId,
    slug: 'us-tech-stocks-2025',
    org_slug: 'test-org',
    metadata: {
      runnerConfig: {
        runner: 'stock-predictor',
        instruments: ['AAPL', 'MSFT', 'GOOGL'],
        riskProfile: 'moderate',
        pollIntervalMs: 300000,
      },
    },
  };

  const mockAgentStatus: AgentStatus = {
    state: 'running',
    startedAt: '2026-01-07T10:00:00Z',
    lastPollAt: '2026-01-07T11:00:00Z',
    nextPollAt: '2026-01-07T11:05:00Z',
    stats: {
      pollCount: 10,
      errorCount: 0,
      recommendationCount: 5,
      avgPollDurationMs: 2500,
    },
  };

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.limit.mockReturnThis();
    mockSupabaseClient.range.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictionController],
      providers: [
        {
          provide: AmbientAgentOrchestratorService,
          useValue: {
            getAgentStatus: jest.fn(),
            startAgent: jest.fn(),
            stopAgent: jest.fn(),
            pauseAgent: jest.fn(),
            resumeAgent: jest.fn(),
            triggerPollNow: jest.fn(),
          },
        },
        {
          provide: PredictionDbService,
          useValue: {
            storeDatapoint: jest.fn(),
            getClaimsForInstrument: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PredictionController>(PredictionController);
    orchestratorService = module.get(AmbientAgentOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to setup agent ownership verification
  function setupAgentOwnership(agentFound = true) {
    // Mock loadAgent
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: agentFound ? mockAgent : null,
      error: agentFound ? null : { code: 'PGRST116' },
    });

    // Mock organization_members query
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.select.mockResolvedValueOnce({
      data: [{ org_id: 'org-1' }],
      error: null,
    });

    // Mock organizations query
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'org-1' },
      error: null,
    });
  }

  describe('getCurrentPredictions', () => {
    it('should return current predictions for agent', async () => {
      setupAgentOwnership();

      // Mock datapoints query
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'dp-1',
            timestamp: '2026-01-07T11:00:00Z',
            sources: [],
          },
        ],
        error: null,
      });

      // Mock recommendations query
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'rec-1',
            instrument: 'AAPL',
            action: 'buy',
            confidence: 0.85,
          },
        ],
        error: null,
      });

      // Mock loadAgent again for response
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      const result = await controller.getCurrentPredictions(
        mockAgentId,
        mockUser,
      );

      expect(result.agentId).toBe(mockAgentId);
      expect(result.agentSlug).toBe('us-tech-stocks-2025');
      expect(result.recommendations).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        controller.getCurrentPredictions(mockAgentId, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('should return paginated history', async () => {
      setupAgentOwnership();

      // Mock recommendations query with pagination
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: [
          { id: 'rec-1', instrument: 'AAPL', action: 'buy' },
          { id: 'rec-2', instrument: 'MSFT', action: 'sell' },
        ],
        error: null,
        count: 50,
      });

      const result = await controller.getHistory(
        mockAgentId,
        '2',
        '10',
        mockUser,
      );

      expect(result.agentId).toBe(mockAgentId);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(50);
      expect(result.recommendations).toHaveLength(2);
    });

    it('should use default pagination when not specified', async () => {
      setupAgentOwnership();

      mockSupabaseClient.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      const result = await controller.getHistory(
        mockAgentId,
        undefined,
        undefined,
        mockUser,
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should throw BadRequestException when user not authenticated', async () => {
      await expect(
        controller.getHistory(mockAgentId, '1', '10', undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInstruments', () => {
    it('should return tracked instruments', async () => {
      setupAgentOwnership();

      // Mock loadAgent for response
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      const result = await controller.getInstruments(mockAgentId, mockUser);

      expect(result.agentId).toBe(mockAgentId);
      expect(result.instruments).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    it('should throw BadRequestException if no runnerConfig', async () => {
      const agentWithoutConfig = { ...mockAgent, metadata: {} };

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: agentWithoutConfig, error: null })
        .mockResolvedValueOnce({ data: [{ org_id: 'org-1' }], error: null })
        .mockResolvedValueOnce({ data: { id: 'org-1' }, error: null })
        .mockResolvedValueOnce({ data: agentWithoutConfig, error: null });

      await expect(
        controller.getInstruments(mockAgentId, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateInstruments', () => {
    it('should update instruments successfully', async () => {
      setupAgentOwnership();

      // Mock loadAgent for update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      // Mock update
      mockSupabaseClient.eq.mockResolvedValueOnce({
        error: null,
      });

      const result = await controller.updateInstruments(
        mockAgentId,
        { instruments: ['AAPL', 'NVDA'] },
        mockUser,
      );

      expect(result.instruments).toEqual(['AAPL', 'NVDA']);
    });

    it('should throw BadRequestException for empty instruments', async () => {
      setupAgentOwnership();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      await expect(
        controller.updateInstruments(
          mockAgentId,
          { instruments: [] },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-array instruments', async () => {
      setupAgentOwnership();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      await expect(
        controller.updateInstruments(
          mockAgentId,
          { instruments: 'AAPL' as unknown as string[] },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getToolStatus', () => {
    it('should return tool status with recent sources', async () => {
      setupAgentOwnership();

      // Mock datapoints query with tools data
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'dp-1',
            timestamp: '2026-01-07T11:00:00Z',
            sources: [
              {
                tool: 'yahoo-finance',
                fetchedAt: '2026-01-07T11:00:00Z',
                claims: [{ type: 'price', value: 175.5 }],
              },
              {
                tool: 'bloomberg-news',
                fetchedAt: '2026-01-07T11:00:00Z',
                claims: [{ type: 'news', value: 'Breaking news' }],
              },
            ],
          },
        ],
        error: null,
      });

      const result = await controller.getToolStatus(mockAgentId, mockUser);

      expect(result.agentId).toBe(mockAgentId);
      expect(result.tools).toHaveLength(2);
      expect(result.recentSources.length).toBeGreaterThan(0);
    });

    it('should track error status for failed tools', async () => {
      setupAgentOwnership();

      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'dp-1',
            timestamp: '2026-01-07T11:00:00Z',
            sources: [
              {
                tool: 'sec-filings',
                fetchedAt: '2026-01-07T11:00:00Z',
                claims: [],
                metadata: {
                  error: true,
                  errorMessage: 'Rate limit exceeded',
                },
              },
            ],
          },
        ],
        error: null,
      });

      const result = await controller.getToolStatus(mockAgentId, mockUser);

      const secTool = result.tools.find((t) => t.name === 'sec-filings');
      expect(secTool?.status).toBe('failed');
      expect(secTool?.errorMessage).toBe('Rate limit exceeded');
    });
  });

  describe('getConfig', () => {
    it('should return agent configuration', async () => {
      setupAgentOwnership();

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      const result = await controller.getConfig(mockAgentId, mockUser);

      expect(result.agentId).toBe(mockAgentId);
      expect(result.config.runner).toBe('stock-predictor');
      expect(result.config.instruments).toEqual(['AAPL', 'MSFT', 'GOOGL']);
      expect(result.config.riskProfile).toBe('moderate');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration successfully', async () => {
      setupAgentOwnership();

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      mockSupabaseClient.eq.mockResolvedValueOnce({
        error: null,
      });

      const result = await controller.updateConfig(
        mockAgentId,
        {
          config: {
            riskProfile: 'aggressive',
            pollIntervalMs: 600000,
          },
        },
        mockUser,
      );

      expect(result.config.riskProfile).toBe('aggressive');
      expect(result.config.pollIntervalMs).toBe(600000);
      // Should preserve existing fields
      expect(result.config.runner).toBe('stock-predictor');
      expect(result.config.instruments).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    it('should validate required config fields', async () => {
      setupAgentOwnership();

      const incompleteAgent = {
        ...mockAgent,
        metadata: {
          runnerConfig: {
            // Missing required fields
          },
        },
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: incompleteAgent,
        error: null,
      });

      await expect(
        controller.updateConfig(mockAgentId, { config: {} }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatus', () => {
    it('should return agent runtime status', async () => {
      setupAgentOwnership();

      orchestratorService.getAgentStatus.mockReturnValue(mockAgentStatus);

      const result = await controller.getStatus(mockAgentId, mockUser);

      expect(result.status).toEqual(mockAgentStatus);
      expect(result.isRunning).toBe(true);
    });

    it('should return isRunning false when stopped', async () => {
      setupAgentOwnership();

      const stoppedStatus: AgentStatus = {
        ...mockAgentStatus,
        state: 'stopped',
      };

      orchestratorService.getAgentStatus.mockReturnValue(stoppedStatus);

      const result = await controller.getStatus(mockAgentId, mockUser);

      expect(result.isRunning).toBe(false);
    });
  });

  describe('startAgent', () => {
    it('should start agent and return status', async () => {
      setupAgentOwnership();

      orchestratorService.startAgent.mockResolvedValue(undefined);
      orchestratorService.getAgentStatus.mockReturnValue(mockAgentStatus);

      const result = await controller.startAgent(mockAgentId, mockUser);

      expect(orchestratorService.startAgent).toHaveBeenCalledWith(mockAgentId);
      expect(result.isRunning).toBe(true);
    });
  });

  describe('stopAgent', () => {
    it('should stop agent and return status', async () => {
      setupAgentOwnership();

      const stoppedStatus: AgentStatus = {
        ...mockAgentStatus,
        state: 'stopped',
      };

      orchestratorService.stopAgent.mockReturnValue(undefined);
      orchestratorService.getAgentStatus.mockReturnValue(stoppedStatus);

      const result = await controller.stopAgent(mockAgentId, mockUser);

      expect(orchestratorService.stopAgent).toHaveBeenCalledWith(mockAgentId);
      expect(result.isRunning).toBe(false);
    });
  });

  describe('pauseAgent', () => {
    it('should pause agent and return status', async () => {
      setupAgentOwnership();

      const pausedStatus: AgentStatus = {
        ...mockAgentStatus,
        state: 'paused',
      };

      orchestratorService.pauseAgent.mockReturnValue(undefined);
      orchestratorService.getAgentStatus.mockReturnValue(pausedStatus);

      const result = await controller.pauseAgent(mockAgentId, mockUser);

      expect(orchestratorService.pauseAgent).toHaveBeenCalledWith(mockAgentId);
      expect(result.isRunning).toBe(false);
      expect(result.status.state).toBe('paused');
    });
  });

  describe('resumeAgent', () => {
    it('should resume paused agent and return status', async () => {
      setupAgentOwnership();

      orchestratorService.resumeAgent.mockReturnValue(undefined);
      orchestratorService.getAgentStatus.mockReturnValue(mockAgentStatus);

      const result = await controller.resumeAgent(mockAgentId, mockUser);

      expect(orchestratorService.resumeAgent).toHaveBeenCalledWith(mockAgentId);
      expect(result.isRunning).toBe(true);
    });
  });

  describe('triggerPoll', () => {
    it('should trigger immediate poll', async () => {
      setupAgentOwnership();

      orchestratorService.triggerPollNow.mockResolvedValue(undefined);

      const result = await controller.triggerPoll(mockAgentId, mockUser);

      expect(orchestratorService.triggerPollNow).toHaveBeenCalledWith(
        mockAgentId,
      );
      expect(result.message).toBe('Poll triggered successfully');
    });
  });

  describe('agent ownership verification', () => {
    it('should throw NotFoundException when user does not own agent', async () => {
      // Mock loadAgent success
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockAgent,
        error: null,
      });

      // Mock user has no org memberships
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock organization lookup
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'different-org' },
        error: null,
      });

      await expect(
        controller.getCurrentPredictions(mockAgentId, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
