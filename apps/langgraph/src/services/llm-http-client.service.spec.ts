import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";
import type { AxiosResponse } from "axios";
import {
  LLMHttpClientService,
  LLMCallRequest,
} from "./llm-http-client.service";
import type { LLMCallResponse as _LLMCallResponse } from "./llm-http-client.service";

/**
 * Unit tests for LLMHttpClientService
 *
 * Tests the centralized LLM client that routes all LLM calls
 * through the Orchestrator AI API.
 */
describe("LLMHttpClientService", () => {
  let service: LLMHttpClientService;
  let httpService: jest.Mocked<HttpService>;
  let _configService: jest.Mocked<ConfigService>;

  const createMockAxiosResponse = <T = unknown>(
    data: T,
    status = 200,
    statusText = "OK",
  ): AxiosResponse<T> => ({
    data,
    status,
    statusText,
    headers: {},
    config: { headers: {} as never },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMHttpClientService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                API_PORT: "6100",
                API_HOST: "localhost",
                LLM_ENDPOINT: "/llm/generate",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LLMHttpClientService>(LLMHttpClientService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("constructor", () => {
    it("should throw error when API_PORT is not configured", async () => {
      const moduleRef = Test.createTestingModule({
        providers: [
          LLMHttpClientService,
          {
            provide: HttpService,
            useValue: { post: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(moduleRef.compile()).rejects.toThrow(
        "API_PORT environment variable is required",
      );
    });
  });

  describe("callLLM", () => {
    const validRequest: LLMCallRequest = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      systemMessage: "You are a helpful assistant",
      userMessage: "Hello, world!",
      userId: "test-user-123",
      callerName: "test-caller",
    };

    it("should make successful LLM call with required parameters", async () => {
      const mockResponse = createMockAxiosResponse({
        response: "Hello! How can I help you today?",
        metadata: {
          usage: {
            promptTokens: 10,
            completionTokens: 8,
            totalTokens: 18,
          },
        },
      });

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.callLLM(validRequest);

      expect(result.text).toBe("Hello! How can I help you today?");
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        "http://localhost:6100/llm/generate",
        expect.objectContaining({
          systemPrompt: validRequest.systemMessage,
          userPrompt: validRequest.userMessage,
          options: expect.objectContaining({
            provider: validRequest.provider,
            modelName: validRequest.model,
            userId: validRequest.userId,
            callerType: "langgraph",
            callerName: validRequest.callerName,
          }),
        }),
      );
    });

    it("should handle response with content field instead of response", async () => {
      const mockResponse = createMockAxiosResponse({
        content: "Response from content field",
      });

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.callLLM(validRequest);

      expect(result.text).toBe("Response from content field");
    });

    it("should return empty string when response is missing text", async () => {
      const mockResponse = createMockAxiosResponse({});

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.callLLM(validRequest);

      expect(result.text).toBe("");
    });

    it("should throw error when userId is missing", async () => {
      const requestWithoutUserId: LLMCallRequest = {
        ...validRequest,
        userId: "",
      };

      await expect(service.callLLM(requestWithoutUserId)).rejects.toThrow(
        "userId is required for LLM calls",
      );
    });

    it("should use default values for optional parameters", async () => {
      const minimalRequest: LLMCallRequest = {
        provider: "openai",
        model: "gpt-4",
        userMessage: "Test message",
        userId: "user-123",
      };

      const mockResponse = createMockAxiosResponse({ response: "OK" });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.callLLM(minimalRequest);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          systemPrompt: "",
          options: expect.objectContaining({
            temperature: 0.7,
            maxTokens: 3500,
            callerName: "workflow",
          }),
        }),
      );
    });

    it("should handle HTTP error with response data", async () => {
      const error = {
        message: "Request failed",
        response: {
          status: 500,
          data: { error: "Internal server error" },
          statusText: "Internal Server Error",
        },
      };

      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.callLLM(validRequest)).rejects.toThrow(
        "LLM call failed: Request failed with status code 500",
      );
    });

    it("should handle HTTP error without response", async () => {
      const error = {
        message: "Network error",
        request: {},
      };

      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.callLLM(validRequest)).rejects.toThrow(
        "LLM call failed: No response received: Network error",
      );
    });

    it("should handle generic error", async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error("Unknown error")),
      );

      await expect(service.callLLM(validRequest)).rejects.toThrow(
        "LLM call failed: Unknown error",
      );
    });
  });

  describe("configuration", () => {
    it("should use default API_HOST when not configured", async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LLMHttpClientService,
          {
            provide: HttpService,
            useValue: { post: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "API_PORT") return "6100";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithDefaults =
        moduleRef.get<LLMHttpClientService>(LLMHttpClientService);

      expect(serviceWithDefaults).toBeDefined();
    });

    it("should use default LLM_ENDPOINT when not configured", async () => {
      const mockResponse = createMockAxiosResponse({ response: "OK" });
      httpService.post.mockReturnValue(of(mockResponse));

      const request: LLMCallRequest = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        userMessage: "Test",
        userId: "user-123",
      };

      await service.callLLM(request);

      expect(httpService.post).toHaveBeenCalledWith(
        "http://localhost:6100/llm/generate",
        expect.any(Object),
      );
    });
  });
});
