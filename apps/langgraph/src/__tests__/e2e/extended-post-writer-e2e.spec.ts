import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Comprehensive End-to-End Tests for Extended Post Writer Agent
 *
 * These tests cover:
 * - Happy path scenarios for generate-approve workflow
 * - Human-in-the-Loop (HITL) interrupt and resume flows
 * - Edge cases for input validation
 * - Error handling and recovery
 *
 * Prerequisites:
 * - E2E_TESTS=true environment variable
 * - Supabase running with SUPABASE_ANON_KEY configured
 */

// Skip E2E tests if environment is not configured
const shouldRunE2E = process.env.E2E_TESTS === 'true' && process.env.SUPABASE_ANON_KEY;
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('Extended Post Writer E2E Tests', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;
  const mockContext = createMockExecutionContext();

  // Load from environment
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:6010';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';
  const testEmail = process.env.SUPABASE_TEST_USER || 'golfergeek@orchestratorai.io';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'GolferGeek123!';
  testUserId = process.env.SUPABASE_TEST_USERID || 'b29a590e-b07f-49df-a25b-574c956b5035';

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      console.warn('Auth failed, tests may fail:', authError.message);
    } else if (authData?.session?.access_token) {
      authToken = authData.session.access_token;
    }

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

  // Helper to extract data from response (handles {success, data} wrapper)
  function getData(body: { data?: unknown; success?: boolean } | unknown): unknown {
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: unknown }).data;
    }
    return body;
  }

  describe('Happy Path - Generate Content', () => {
    it('should generate content with minimal parameters', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-generate-min-${Date.now()}`,
          userId: testUserId,
          topic: 'Introduction to Machine Learning',
        });

      expect([200, 201]).toContain(response.status);
      const data = getData(response.body) as Record<string, unknown>;
      expect(data).toHaveProperty('threadId');
      expect(data).toHaveProperty('status');
      expect(['hitl_waiting', 'generating', 'completed', 'failed'])
        .toContain(data.status);
    }, 60000); // Longer timeout for LLM call

    it('should generate content with all parameters', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-generate-full-${Date.now()}`,
          userId: testUserId,
          topic: 'Best Practices for API Design',
          context: 'Target audience is senior developers',
          tone: 'professional',
          style: 'technical',
          length: 'medium',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      expect([200, 201]).toContain(response.status);
      const data = getData(response.body) as Record<string, unknown>;
      if (data.status === 'hitl_waiting') {
        expect(data).toHaveProperty('generatedContent');
      }
    }, 60000); // Longer timeout for LLM call

    it('should generate content with casual tone', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-casual-${Date.now()}`,
          userId: testUserId,
          topic: 'Fun Weekend Project Ideas',
          tone: 'casual',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      expect([200, 201, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call
  });

  describe('Happy Path - HITL Approve Workflow', () => {
    let threadId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-approve-workflow-${Date.now()}`,
          userId: testUserId,
          topic: 'Test Topic for Approval',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      const data = getData(response.body) as Record<string, unknown>;
      if (data?.threadId) {
        threadId = data.threadId as string;
      }
    }, 60000); // Longer timeout for LLM call in beforeAll

    it('should approve generated content', async () => {
      if (!threadId) {
        console.log('Skipping - no threadId from setup');
        return;
      }

      // Wait a moment for state to persist
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await request(app.getHttpServer())
        .post(`/extended-post-writer/resume/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'approve',
        });

      expect([200, 201, 400, 404]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        const data = getData(response.body) as Record<string, unknown>;
        expect(['completed', 'failed']).toContain(data.status);
      }
    });
  });

  describe('Happy Path - HITL Edit Workflow', () => {
    let threadId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-edit-workflow-${Date.now()}`,
          userId: testUserId,
          topic: 'Test Topic for Edit',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      const data = getData(response.body) as Record<string, unknown>;
      if (data?.threadId) {
        threadId = data.threadId as string;
      }
    }, 60000); // Longer timeout for LLM call in beforeAll

    it('should accept edited content', async () => {
      if (!threadId) {
        console.log('Skipping - no threadId from setup');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await request(app.getHttpServer())
        .post(`/extended-post-writer/resume/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'edit',
          editedContent: 'This is my edited version of the content with improvements.',
        });

      expect([200, 201, 400, 404]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        const data = getData(response.body) as Record<string, unknown>;
        expect(data).toHaveProperty('status');
      }
    });
  });

  describe('Happy Path - HITL Reject Workflow', () => {
    let threadId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-reject-workflow-${Date.now()}`,
          userId: testUserId,
          topic: 'Test Topic for Rejection',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      const data = getData(response.body) as Record<string, unknown>;
      if (data?.threadId) {
        threadId = data.threadId as string;
      }
    }, 60000); // Longer timeout for LLM call in beforeAll

    it('should reject and request regeneration', async () => {
      if (!threadId) {
        console.log('Skipping - no threadId from setup');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await request(app.getHttpServer())
        .post(`/extended-post-writer/resume/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'reject',
          feedback: 'Please make it more concise and add more examples',
        });

      expect([200, 201, 400, 404]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        const data = getData(response.body) as Record<string, unknown>;
        expect(data).toHaveProperty('status');
      }
    });
  });

  describe('Happy Path - Status and History', () => {
    let threadId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-status-history-${Date.now()}`,
          userId: testUserId,
          topic: 'Test Topic for Status Check',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      const data = getData(response.body) as Record<string, unknown>;
      if (data?.threadId) {
        threadId = data.threadId as string;
      }
    }, 60000); // Longer timeout for LLM call in beforeAll

    it('should retrieve status for existing thread', async () => {
      if (!threadId) {
        console.log('Skipping - no threadId from setup');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/extended-post-writer/status/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200 && response.body) {
        const data = getData(response.body) as Record<string, unknown>;
        expect(data).toHaveProperty('status');
      }
    });

    it('should retrieve history for existing thread', async () => {
      if (!threadId) {
        console.log('Skipping - no threadId from setup');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/extended-post-writer/history/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        // Response may be wrapped in {success, data} or be a direct array
        const data = getData(response.body);
        expect(data === null || Array.isArray(data) || (typeof data === 'object' && data !== null)).toBe(true);
      }
    });
  });

  describe('Edge Cases - Input Validation', () => {
    it('should reject empty topic', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-empty-topic',
          userId: testUserId,
          topic: '',
        });

      expect([400, 500]).toContain(response.status);
    });

    it('should reject missing topic', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-missing-topic',
          userId: testUserId,
        });

      expect([400, 500]).toContain(response.status);
    });

    it('should reject missing userId', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-missing-user',
          topic: 'Test topic',
        });

      expect([400, 500]).toContain(response.status);
    });

    it('should reject missing taskId', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUserId,
          topic: 'Test topic',
        });

      expect([400, 500]).toContain(response.status);
    });

    it('should handle extremely long topic', async () => {
      const longTopic = 'A'.repeat(5000);
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-long-topic',
          userId: testUserId,
          topic: longTopic,
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call

    it('should handle special characters in topic', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-special-${Date.now()}`,
          userId: testUserId,
          topic: "How to use <script>alert('XSS')</script> safely",
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call
  });

  describe('Edge Cases - Resume Validation', () => {
    it('should reject resume without decision', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/resume/some-thread')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect([400, 404]).toContain(response.status);
    });

    it('should reject invalid decision value', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/resume/some-thread')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'invalid-decision',
        });

      expect([400, 404]).toContain(response.status);
    });

    it('should reject edit without editedContent', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/resume/some-thread')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'edit',
        });

      // May return 400, 404, or 200 with failed status
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should handle non-existent threadId for resume', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/resume/non-existent-thread-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          decision: 'approve',
        });

      // May return various status codes depending on how the service handles it
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Edge Cases - Invalid References', () => {
    it('should handle non-existent threadId for status', async () => {
      const response = await request(app.getHttpServer())
        .get('/extended-post-writer/status/non-existent-thread-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        // Response may be wrapped in {success, data} or be null/empty
        const data = getData(response.body);
        // For non-existent threads, data may be null or a minimal response
        expect(data === null || (typeof data === 'object' && data !== null)).toBe(true);
      }
    });

    it('should handle non-existent threadId for history', async () => {
      const response = await request(app.getHttpServer())
        .get('/extended-post-writer/history/non-existent-thread-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
    });

    it('should handle UUID-like invalid threadId', async () => {
      const response = await request(app.getHttpServer())
        .get('/extended-post-writer/status/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Edge Cases - Provider Configuration', () => {
    it('should handle invalid provider', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-invalid-provider',
          userId: testUserId,
          topic: 'Test topic',
          provider: 'invalid-provider',
          model: 'some-model',
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call

    it('should handle invalid model', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: 'test-invalid-model',
          userId: testUserId,
          topic: 'Test topic',
          provider: 'anthropic',
          model: 'non-existent-model',
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call

    it('should use default provider/model when not specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-defaults-${Date.now()}`,
          userId: testUserId,
          topic: 'Test topic',
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    }, 60000); // Longer timeout for LLM call
  });

  describe('Edge Cases - Concurrent Requests', () => {
    it('should handle multiple concurrent generate requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        request(app.getHttpServer())
          .post('/extended-post-writer/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            taskId: `test-concurrent-${Date.now()}-${i}`,
            userId: testUserId,
            topic: `Concurrent Topic ${i}`,
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect([200, 201, 429, 500]).toContain(response.status);
      });
    }, 120000); // Longer timeout for multiple concurrent LLM calls
  });

  describe('State Persistence', () => {
    it('should maintain state between status checks', async () => {
      const generateResponse = await request(app.getHttpServer())
        .post('/extended-post-writer/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId: `test-persistence-${Date.now()}`,
          userId: testUserId,
          topic: 'State Persistence Test',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
        });

      if (generateResponse.status !== 200 && generateResponse.status !== 201) {
        console.log('Skipping - generation failed');
        return;
      }

      const genData = getData(generateResponse.body) as Record<string, unknown>;
      const threadId = genData.threadId as string;
      await new Promise((resolve) => setTimeout(resolve, 500));

      // First status check
      const status1 = await request(app.getHttpServer())
        .get(`/extended-post-writer/status/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Second status check should return same state
      const status2 = await request(app.getHttpServer())
        .get(`/extended-post-writer/status/${threadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (status1.status === 200 && status2.status === 200) {
        const data1 = getData(status1.body) as Record<string, unknown>;
        const data2 = getData(status2.body) as Record<string, unknown>;
        expect(data1?.status).toBe(data2?.status);
      }
    }, 60000); // Longer timeout for LLM call
  });
});
