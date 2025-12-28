import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { WorkflowRequestDto } from "./workflow-request.dto";

describe("WorkflowRequestDto", () => {
  describe("Validation - Happy Path", () => {
    it("should validate a valid WorkflowRequestDto", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Analyze this data and provide insights",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.taskId).toBe(validData.taskId);
      expect(dto.conversationId).toBe(validData.conversationId);
      expect(dto.userId).toBe(validData.userId);
      expect(dto.provider).toBe(validData.provider);
      expect(dto.model).toBe(validData.model);
      expect(dto.prompt).toBe(validData.prompt);
    });

    it("should validate with optional statusWebhook URL", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "anthropic",
        model: "claude-3-opus",
        prompt: "Write a blog post about AI",
        statusWebhook: "http://localhost:6100/webhooks/status",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.statusWebhook).toBe(validData.statusWebhook);
    });

    it("should validate with HTTPS statusWebhook URL", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4-turbo",
        prompt: "Generate a report",
        statusWebhook: "https://api.example.com/webhooks/task-updates",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.statusWebhook).toBe(validData.statusWebhook);
    });

    it("should validate with optional metadata", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        prompt: "Create a marketing campaign",
        metadata: {
          organizationId: "org-123",
          priority: "high",
          deadline: "2025-12-31",
          tags: ["marketing", "campaign"],
        },
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.metadata).toEqual(validData.metadata);
    });

    it("should validate without optional fields", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.statusWebhook).toBeUndefined();
      expect(dto.metadata).toBeUndefined();
    });
  });

  describe("Validation - Invalid UUID Fields", () => {
    it("should fail validation when taskId is not a valid UUID", async () => {
      // Arrange
      const invalidData = {
        taskId: "invalid-uuid",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const taskIdError = errors.find((error) => error.property === "taskId");
      expect(taskIdError).toBeDefined();
      expect(taskIdError?.constraints).toHaveProperty("isUuid");
    });

    it("should fail validation when conversationId is not a valid UUID", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "not-a-uuid",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const conversationIdError = errors.find(
        (error) => error.property === "conversationId",
      );
      expect(conversationIdError).toBeDefined();
      expect(conversationIdError?.constraints).toHaveProperty("isUuid");
    });

    it("should fail validation when userId is not a valid UUID", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "123456",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find((error) => error.property === "userId");
      expect(userIdError).toBeDefined();
      expect(userIdError?.constraints).toHaveProperty("isUuid");
    });
  });

  describe("Validation - Missing Required Fields", () => {
    it("should fail validation when taskId is missing", async () => {
      // Arrange
      const invalidData = {
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const taskIdError = errors.find((error) => error.property === "taskId");
      expect(taskIdError).toBeDefined();
    });

    it("should fail validation when conversationId is missing", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const conversationIdError = errors.find(
        (error) => error.property === "conversationId",
      );
      expect(conversationIdError).toBeDefined();
    });

    it("should fail validation when userId is missing", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find((error) => error.property === "userId");
      expect(userIdError).toBeDefined();
    });

    it("should fail validation when provider is missing", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const providerError = errors.find(
        (error) => error.property === "provider",
      );
      expect(providerError).toBeDefined();
    });

    it("should fail validation when model is missing", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((error) => error.property === "model");
      expect(modelError).toBeDefined();
    });

    it("should fail validation when prompt is missing", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((error) => error.property === "prompt");
      expect(promptError).toBeDefined();
    });
  });

  describe("Validation - Invalid String Fields", () => {
    it("should fail validation when provider is not a string", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: 123, // Should be string
        model: "gpt-4",
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const providerError = errors.find(
        (error) => error.property === "provider",
      );
      expect(providerError).toBeDefined();
      expect(providerError?.constraints).toHaveProperty("isString");
    });

    it("should fail validation when model is not a string", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: { name: "gpt-4" }, // Should be string
        prompt: "Test prompt",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const modelError = errors.find((error) => error.property === "model");
      expect(modelError).toBeDefined();
      expect(modelError?.constraints).toHaveProperty("isString");
    });

    it("should fail validation when prompt is not a string", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: ["Test", "prompt"], // Should be string
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const promptError = errors.find((error) => error.property === "prompt");
      expect(promptError).toBeDefined();
      expect(promptError?.constraints).toHaveProperty("isString");
    });
  });

  describe("Validation - Invalid URL Fields", () => {
    it("should fail validation when statusWebhook is not a valid URL", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
        statusWebhook: "not-a-valid-url",
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const statusWebhookError = errors.find(
        (error) => error.property === "statusWebhook",
      );
      expect(statusWebhookError).toBeDefined();
      expect(statusWebhookError?.constraints).toHaveProperty("isUrl");
    });

    it("should fail validation when statusWebhook has no protocol", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
        statusWebhook: "localhost:6100/webhooks", // Missing protocol
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const statusWebhookError = errors.find(
        (error) => error.property === "statusWebhook",
      );
      expect(statusWebhookError).toBeDefined();
      expect(statusWebhookError?.constraints).toHaveProperty("isUrl");
    });
  });

  describe("Validation - Invalid Metadata Field", () => {
    it("should fail validation when metadata is not an object", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
        metadata: "not-an-object", // Should be object
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const metadataError = errors.find(
        (error) => error.property === "metadata",
      );
      expect(metadataError).toBeDefined();
      expect(metadataError?.constraints).toHaveProperty("isObject");
    });

    it("should fail validation when metadata is an array", async () => {
      // Arrange
      const invalidData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
        metadata: ["item1", "item2"], // Should be object, not array
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, invalidData);
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const metadataError = errors.find(
        (error) => error.property === "metadata",
      );
      expect(metadataError).toBeDefined();
      expect(metadataError?.constraints).toHaveProperty("isObject");
    });
  });

  describe("Common Provider and Model Combinations", () => {
    it.each([
      ["openai", "gpt-4"],
      ["openai", "gpt-4-turbo"],
      ["openai", "gpt-3.5-turbo"],
      ["anthropic", "claude-3-opus"],
      ["anthropic", "claude-3-sonnet"],
      ["anthropic", "claude-sonnet-4-20250514"],
    ])(
      "should validate with provider '%s' and model '%s'",
      async (provider, model) => {
        // Arrange
        const validData = {
          taskId: "550e8400-e29b-41d4-a716-446655440000",
          conversationId: "660e8400-e29b-41d4-a716-446655440001",
          userId: "770e8400-e29b-41d4-a716-446655440002",
          provider,
          model,
          prompt: "Test prompt",
        };

        // Act
        const dto = plainToInstance(WorkflowRequestDto, validData);
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
        expect(dto.provider).toBe(provider);
        expect(dto.model).toBe(model);
      },
    );
  });

  describe("Edge Cases", () => {
    it("should validate with empty string prompt (validation passes, business logic may reject)", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "", // Empty but still a string
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.prompt).toBe("");
    });

    it("should validate with very long prompt", async () => {
      // Arrange
      const longPrompt = "A".repeat(10000);
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: longPrompt,
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.prompt).toBe(longPrompt);
    });

    it("should validate with nested metadata", async () => {
      // Arrange
      const validData = {
        taskId: "550e8400-e29b-41d4-a716-446655440000",
        conversationId: "660e8400-e29b-41d4-a716-446655440001",
        userId: "770e8400-e29b-41d4-a716-446655440002",
        provider: "openai",
        model: "gpt-4",
        prompt: "Test prompt",
        metadata: {
          nested: {
            level1: {
              level2: {
                value: "deep nesting",
              },
            },
          },
        },
      };

      // Act
      const dto = plainToInstance(WorkflowRequestDto, validData);
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
      expect(dto.metadata).toEqual(validData.metadata);
    });
  });
});
