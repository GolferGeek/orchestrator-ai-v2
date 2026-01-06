import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { EvaluationService } from "./evaluation.service";
import { FinanceRequestDto } from "./dto";
import { createMockExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * Unit tests for FinanceController
 *
 * Tests the REST API endpoints for the Finance Research agent.
 */
describe("FinanceController", () => {
  let controller: FinanceController;
  let financeService: jest.Mocked<FinanceService>;
  let evaluationService: jest.Mocked<EvaluationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: {
            execute: jest.fn(),
            getRecommendations: jest.fn(),
          },
        },
        {
          provide: EvaluationService,
          useValue: {
            evaluatePendingRecommendations: jest.fn(),
            getLearningContext: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    financeService = module.get(FinanceService);
    evaluationService = module.get(EvaluationService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("POST /finance/run", () => {
    const mockContext = createMockExecutionContext({
      taskId: "task-123",
      userId: "user-456",
      conversationId: "conv-789",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });

    const validRequest: FinanceRequestDto = {
      context: mockContext,
      universeVersionId: "version-123",
    };

    it("should return success for completed execution", async () => {
      const mockResult = {
        taskId: "task-123",
        runId: "run-456",
        status: "completed" as const,
        recommendations: [
          {
            id: "rec-1",
            instrument: "AAPL",
            action: "buy" as const,
            timingWindow: "pre_close" as const,
            entryStyle: "market",
            rationale: "Strong momentum",
          },
        ],
        duration: 5000,
      };

      financeService.execute.mockResolvedValue(mockResult);

      const result = await controller.run(validRequest);

      expect(result.success).toBe(true);
      expect(result.data.runId).toBe("run-456");
      expect(result.data.recommendationCount).toBe(1);
    });

    it("should return failure for failed execution", async () => {
      const mockResult = {
        taskId: "task-123",
        runId: "run-456",
        status: "failed" as const,
        recommendations: [],
        error: "Market data fetch failed",
        duration: 1000,
      };

      financeService.execute.mockResolvedValue(mockResult);

      const result = await controller.run(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Market data fetch failed");
    });

    it("should throw BadRequestException when context is missing", async () => {
      const invalidRequest = {
        universeVersionId: "version-123",
      } as FinanceRequestDto;

      await expect(controller.run(invalidRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when taskId is missing", async () => {
      const contextNoTaskId = { ...mockContext, taskId: "" };
      const invalidRequest: FinanceRequestDto = {
        context: contextNoTaskId,
        universeVersionId: "version-123",
      };

      await expect(controller.run(invalidRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when universeVersionId is missing", async () => {
      const invalidRequest = { context: mockContext } as FinanceRequestDto;

      await expect(controller.run(invalidRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException on service error", async () => {
      financeService.execute.mockRejectedValue(new Error("Service error"));

      await expect(controller.run(validRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("GET /finance/recommendations/:runId", () => {
    it("should return recommendations for existing run", async () => {
      const mockRecommendations = [
        {
          id: "rec-1",
          instrument: "AAPL",
          action: "buy" as const,
          timingWindow: "pre_close" as const,
          entryStyle: "market",
          rationale: "Strong momentum",
        },
        {
          id: "rec-2",
          instrument: "MSFT",
          action: "hold" as const,
          timingWindow: "post_close" as const,
          entryStyle: "limit",
          rationale: "Awaiting earnings",
        },
      ];

      financeService.getRecommendations.mockResolvedValue(mockRecommendations);

      const result = await controller.getRecommendations("run-123");

      expect(result.success).toBe(true);
      expect(result.data.runId).toBe("run-123");
      expect(result.data.recommendations).toHaveLength(2);
    });

    it("should throw NotFoundException when no recommendations found", async () => {
      financeService.getRecommendations.mockResolvedValue([]);

      await expect(
        controller.getRecommendations("run-nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when recommendations is null", async () => {
      financeService.getRecommendations.mockResolvedValue(null as never);

      await expect(
        controller.getRecommendations("run-nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("POST /finance/evaluate", () => {
    const mockContext = createMockExecutionContext({
      taskId: "task-eval",
      userId: "user-456",
    });

    it("should return evaluation results", async () => {
      const mockResults = [
        {
          recommendationId: "rec-1",
          outcome: { winLoss: "win", returnPct: 5.2 },
          postmortem: "Momentum carried through as expected",
        },
        {
          recommendationId: "rec-2",
          outcome: { winLoss: "loss", returnPct: -2.1 },
          postmortem: "Unexpected earnings miss",
        },
      ];

      evaluationService.evaluatePendingRecommendations.mockResolvedValue(
        mockResults as never,
      );

      const result = await controller.evaluate({ context: mockContext }, "48");

      expect(result.success).toBe(true);
      expect(result.data.summary.evaluated).toBe(2);
      expect(result.data.summary.wins).toBe(1);
      expect(result.data.summary.losses).toBe(1);
    });

    it("should throw BadRequestException when context is missing", async () => {
      await expect(
        controller.evaluate({ context: undefined as never }, "48"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should use default lookback hours when not specified", async () => {
      evaluationService.evaluatePendingRecommendations.mockResolvedValue([]);

      await controller.evaluate({ context: mockContext }, undefined);

      expect(
        evaluationService.evaluatePendingRecommendations,
      ).toHaveBeenCalledWith(mockContext, 48);
    });
  });

  describe("GET /finance/learning-context", () => {
    it("should return learning context for instruments", async () => {
      const mockContext =
        "AAPL: Strong price action, consider buying on dips. MSFT: Awaiting cloud earnings.";

      evaluationService.getLearningContext.mockResolvedValue(mockContext);

      const result = await controller.getLearningContext("AAPL,MSFT", "10");

      expect(result.success).toBe(true);
      expect(result.data.instruments).toEqual(["AAPL", "MSFT"]);
      expect(result.data.context).toBe(mockContext);
    });

    it("should throw BadRequestException when instruments is missing", async () => {
      await expect(controller.getLearningContext("", "10")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should use default limit when not specified", async () => {
      evaluationService.getLearningContext.mockResolvedValue("");

      await controller.getLearningContext("AAPL", undefined);

      expect(evaluationService.getLearningContext).toHaveBeenCalledWith(
        ["AAPL"],
        10,
      );
    });
  });
});
