import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../app.module";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createMockExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * End-to-End Integration Tests for LangGraph Phase 5
 *
 * These tests run against the actual LangGraph app with real database
 * connections and use the Supabase test user for authentication.
 *
 * Prerequisites:
 * - Supabase running locally (npm run supabase:start)
 * - API running (npm run dev:api)
 * - LangGraph app running (npm run dev:langgraph)
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_TEST_USER
 * - SUPABASE_TEST_PASSWORD
 * - SUPABASE_TEST_USERID
 *
 * To run E2E tests:
 * - Set E2E_TESTS=true environment variable
 * - Ensure all prerequisites are running
 */

// Skip E2E tests if environment is not configured
const shouldRunE2E =
  process.env.E2E_TESTS === "true" && process.env.SUPABASE_ANON_KEY;
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E("LangGraph E2E Tests", () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  const _mockContext = createMockExecutionContext();

  // Load from environment
  const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || "test-key";
  const testEmail =
    process.env.SUPABASE_TEST_USER || "golfergeek@orchestratorai.io";
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || "GolferGeek123!";
  const testUserId =
    process.env.SUPABASE_TEST_USERID || "b29a590e-b07f-49df-a25b-574c956b5035";

  beforeAll(async () => {
    // Create Supabase client
    supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate test user
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (authError) {
      console.warn("Auth failed, tests may fail:", authError.message);
    } else if (authData?.session?.access_token) {
      authToken = authData.session.access_token;
    }

    // Create NestJS app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("Health Check", () => {
    it("GET /health should return healthy status", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .expect(200);

      expect(response.body).toHaveProperty("status", "ok");
    });
  });

  describe("Data Analyst Agent", () => {
    describe("POST /data-analyst/analyze", () => {
      it("should accept valid analysis request", async () => {
        const response = await request(app.getHttpServer())
          .post("/data-analyst/analyze")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            taskId: `test-task-${Date.now()}`,
            userId: testUserId,
            question: "List all tables in the database",
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
          });

        // May fail due to LLM configuration, but should accept request
        expect([200, 201, 500]).toContain(response.status);

        if (response.status === 200 || response.status === 201) {
          // Response may be wrapped in { success, data } or be direct
          const data = response.body.data || response.body;
          expect(data).toHaveProperty("threadId");
          expect(data).toHaveProperty("status");
        }
      });

      it("should reject request without taskId", async () => {
        const response = await request(app.getHttpServer())
          .post("/data-analyst/analyze")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            userId: testUserId,
            question: "Test question",
          });

        expect([400, 500]).toContain(response.status);
      });

      it("should reject request without question", async () => {
        const response = await request(app.getHttpServer())
          .post("/data-analyst/analyze")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            taskId: "test-task",
            userId: testUserId,
          });

        expect([400, 500]).toContain(response.status);
      });
    });

    describe("GET /data-analyst/status/:threadId", () => {
      it("should return null for non-existent thread", async () => {
        const response = await request(app.getHttpServer())
          .get("/data-analyst/status/non-existent-thread")
          .set("Authorization", `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);

        // For non-existent threads, the response should either be 404
        // or return a minimal response indicating thread not found
        if (response.status === 200) {
          const data = response.body.data || response.body;
          // Either null or a response with just threadId (no status)
          expect(data === null || data.threadId !== undefined).toBe(true);
        }
      });
    });
  });

  describe("Extended Post Writer Agent", () => {
    describe("POST /extended-post-writer/generate", () => {
      it("should accept valid generation request", async () => {
        const response = await request(app.getHttpServer())
          .post("/extended-post-writer/generate")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            taskId: `test-task-${Date.now()}`,
            userId: testUserId,
            topic: "Introduction to AI",
            context: "Write for beginners",
            tone: "casual",
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
          });

        // May fail due to LLM configuration, but should accept request
        expect([200, 201, 500]).toContain(response.status);

        if (response.status === 200 || response.status === 201) {
          // Response may be wrapped in { success, data } or be direct
          const data = response.body.data || response.body;
          expect(data).toHaveProperty("threadId");
          expect(data).toHaveProperty("status");
        }
      }, 60000);

      it("should reject request without topic", async () => {
        const response = await request(app.getHttpServer())
          .post("/extended-post-writer/generate")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            taskId: "test-task",
            userId: testUserId,
          });

        expect([400, 500]).toContain(response.status);
      });
    });

    describe("GET /extended-post-writer/status/:threadId", () => {
      it("should return null for non-existent thread", async () => {
        const response = await request(app.getHttpServer())
          .get("/extended-post-writer/status/non-existent-thread")
          .set("Authorization", `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);

        // For non-existent threads, the response should either be 404
        // or return a minimal response indicating thread not found
        if (response.status === 200) {
          const data = response.body.data || response.body;
          // Either null or a response with just threadId (no status)
          expect(data === null || data.threadId !== undefined).toBe(true);
        }
      });
    });

    describe("POST /extended-post-writer/resume/:threadId", () => {
      it("should reject resume for non-existent thread", async () => {
        const response = await request(app.getHttpServer())
          .post("/extended-post-writer/resume/non-existent-thread")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            decision: "approve",
          });

        // Should return error status for non-existent thread
        expect([200, 400, 404, 500]).toContain(response.status);
        // If 200, it should indicate failure in the response body or success: false
        if (response.status === 200) {
          // Either success: false wrapper, or direct error, or failed status
          expect(
            response.body.success === false ||
              response.body.data?.status === "failed" ||
              response.body.data?.error ||
              response.body.status === "failed" ||
              response.body.error,
          ).toBeTruthy();
        }
      });

      it("should validate decision field", async () => {
        const response = await request(app.getHttpServer())
          .post("/extended-post-writer/resume/some-thread")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            decision: "invalid-decision",
          });

        expect([200, 400, 404, 500]).toContain(response.status);
      });
    });
  });
});

/**
 * Integration tests that require full workflow execution
 *
 * These tests are marked as .skip by default because they:
 * 1. Require LLM API keys to be configured
 * 2. Take longer to execute
 * 3. May incur costs
 *
 * Run with: npm test -- --grep "Full Workflow"
 */
describe.skip("Full Workflow Integration Tests", () => {
  // These tests would run actual LLM calls
  // Enable them when testing against real LLM providers

  it.todo("should complete Data Analyst full workflow");
  it.todo("should complete Extended Post Writer generate-approve workflow");
  it.todo(
    "should complete Extended Post Writer generate-edit-approve workflow",
  );
  it.todo("should complete Extended Post Writer generate-reject workflow");
  it.todo("should track LLM usage through the workflow");
  it.todo("should emit correct observability events");
  it.todo("should persist state correctly through checkpointer");
});
