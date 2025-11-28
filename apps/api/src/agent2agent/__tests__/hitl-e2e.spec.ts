import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { HitlE2ETestModule } from './hitl-e2e-test.module';
import { HitlTestFixtures } from './fixtures/hitl-test-fixtures';
import { LangGraphMockService } from './mocks/langgraph-mock.service';

/**
 * HITL E2E Tests (A2A Endpoint)
 *
 * These tests validate the complete HITL workflow using the A2A endpoint.
 * All HITL operations use JSON-RPC methods via the A2A endpoint.
 *
 * Port configuration (from root .env):
 * - API: 6100
 * - LangGraph: 6200
 * - Frontend: 6101
 *
 * NOTE: These tests require full module setup with database connections.
 * Currently scaffolded as skip() until proper test infrastructure is in place.
 */
describe.skip('HITL E2E Tests (A2A Endpoint)', () => {
  let app: INestApplication;
  let fixtures: HitlTestFixtures;
  let langGraphMock: LangGraphMockService;
  let authToken: string;
  let userId: string;
  let taskId: string;
  const orgSlug = 'demo';
  const agentSlug = 'extended-post-writer';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HitlE2ETestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    langGraphMock = moduleFixture.get('LANGGRAPH_SERVICE');
    fixtures = new HitlTestFixtures();

    // Seed test data
    const testUser = await fixtures.seedTestUser();
    userId = testUser.userId;
    authToken = testUser.authToken;
  });

  afterAll(async () => {
    await fixtures.cleanup(userId);
    await app.close();
  });

  beforeEach(() => {
    // Reset mock state between tests
    langGraphMock.reset();
  });

  /**
   * Helper to call A2A endpoint with JSON-RPC
   * ALL HITL operations use this pattern
   */
  const callA2A = (method: string, params: Record<string, unknown>) => {
    return request(app.getHttpServer())
      .post(`/agent-to-agent/${orgSlug}/${agentSlug}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      });
  };

  describe('Complete HITL Flows', () => {
    it('should complete APPROVE flow', async () => {
      // 1. Start a task that triggers HITL
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about AI in healthcare' },
        mode: 'build',
      });

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.result.payload.status).toBe('hitl_waiting');

      taskId = startResponse.body.result.payload.taskId;
      const deliverableId = startResponse.body.result.payload.deliverableId;

      expect(taskId).toBeDefined();
      expect(deliverableId).toBeDefined();

      // 2. Get status via A2A
      const statusResponse = await callA2A('hitl.status', { taskId });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.result.payload.hitlPending).toBe(true);

      // 3. Resume with APPROVE via A2A
      const resumeResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(resumeResponse.status).toBe(200);
      expect(resumeResponse.body.result.payload.status).toBe('completed');

      // 4. Verify deliverable has one version via A2A
      const historyResponse = await callA2A('hitl.history', { taskId });

      expect(historyResponse.body.result.payload.versionCount).toBe(1);
    });

    it('should complete REGENERATE flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about quantum computing' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Resume with REGENERATE
      const regenerateResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'regenerate',
        feedback: 'Make it shorter and more engaging',
      });

      expect(regenerateResponse.status).toBe(200);
      // Should return another HITL response for review
      expect(regenerateResponse.body.result.payload.status).toBe('hitl_waiting');

      // 3. Now approve
      const approveResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(approveResponse.status).toBe(200);

      // 4. Verify deliverable has two versions
      const historyResponse = await callA2A('hitl.history', { taskId });

      expect(historyResponse.body.result.payload.versionCount).toBe(2);
    });

    it('should complete REPLACE flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write a blog post about machine learning' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Resume with REPLACE
      const replaceResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'replace',
        content: {
          blogPost: '# My Custom Blog Post\n\nThis is my own content.',
          seoDescription: 'A custom SEO description',
          socialPosts: ['Check out my new post!'],
        },
      });

      expect(replaceResponse.status).toBe(200);
      expect(replaceResponse.body.result.payload.status).toBe('completed');

      // 3. Verify deliverable has two versions (original + replacement)
      const historyResponse = await callA2A('hitl.history', { taskId });

      expect(historyResponse.body.result.payload.versionCount).toBe(2);
    });

    it('should complete REJECT flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about cloud computing' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Reject via A2A
      const rejectResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'reject',
      });

      expect(rejectResponse.status).toBe(200);
      // Should regenerate and return HITL again
      expect(rejectResponse.body.result.payload.status).toBe('hitl_waiting');

      // 3. Approve the new version
      const approveResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'approve',
      });

      expect(approveResponse.status).toBe(200);
    });

    it('should complete SKIP flow', async () => {
      // 1. Start task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about data science' },
        mode: 'build',
      });

      taskId = startResponse.body.result.payload.taskId;

      // 2. Skip via A2A (auto-approve)
      const skipResponse = await callA2A('hitl.resume', {
        taskId,
        decision: 'skip',
      });

      expect(skipResponse.status).toBe(200);
      expect(skipResponse.body.result.payload.status).toBe('completed');

      // Should not create new version
      const historyResponse = await callA2A('hitl.history', { taskId });
      expect(historyResponse.body.result.payload.versionCount).toBe(1);
    });
  });

  describe('HITL Pending List', () => {
    it('should return pending HITL items for user (taskId as primary identifier)', async () => {
      // Start a task but don't complete it
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about pending test' },
        mode: 'build',
      });

      const pendingTaskId = startResponse.body.result.payload.taskId;

      // Query pending list - this queries TASKS table, not conversations
      const pendingResponse = await callA2A('hitl.pending', {});

      expect(pendingResponse.status).toBe(200);
      expect(pendingResponse.body.result.payload.items).toBeInstanceOf(Array);
      expect(pendingResponse.body.result.payload.items.length).toBeGreaterThan(
        0,
      );

      // Verify structure of pending item
      // NOTE: taskId is the PRIMARY identifier since hitl_pending is on tasks table
      const pendingItem = pendingResponse.body.result.payload.items.find(
        (item: { taskId: string }) => item.taskId === pendingTaskId,
      );
      expect(pendingItem).toBeDefined();
      // taskId is first because it's the primary identifier
      expect(pendingItem.taskId).toBe(pendingTaskId);
      expect(pendingItem.agentSlug).toBe(agentSlug);
      expect(pendingItem.pendingSince).toBeDefined();
      // conversationId is for navigation, not the primary key
      expect(pendingItem.conversationId).toBeDefined();

      // Clean up - approve it
      await callA2A('hitl.resume', {
        taskId: pendingTaskId,
        decision: 'approve',
      });
    });
  });

  describe('HITL Validation Errors (A2A Endpoint)', () => {
    it('should reject REGENERATE without feedback', async () => {
      // Start a task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about validation test' },
        mode: 'build',
      });

      const validationTaskId = startResponse.body.result.payload.taskId;

      // Try to regenerate without feedback
      const response = await callA2A('hitl.resume', {
        taskId: validationTaskId,
        decision: 'regenerate',
        // Missing feedback
      });

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(false);
      expect(response.body.result.error).toContain('feedback');
    });

    it('should reject REPLACE without content', async () => {
      // Start a task
      const startResponse = await callA2A('tasks/send', {
        message: { text: 'Write about replace test' },
        mode: 'build',
      });

      const replaceTaskId = startResponse.body.result.payload.taskId;

      // Try to replace without content
      const response = await callA2A('hitl.resume', {
        taskId: replaceTaskId,
        decision: 'replace',
        // Missing content
      });

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(false);
      expect(response.body.result.error).toContain('content');
    });

    it('should reject missing taskId', async () => {
      const response = await callA2A('hitl.resume', {
        // Missing taskId
        decision: 'approve',
      });

      expect(response.status).toBe(200);
      expect(response.body.result.success).toBe(false);
      expect(response.body.result.error).toContain('taskId');
    });
  });

  describe('HITL Response Format', () => {
    it('should return correct HITL waiting response format', async () => {
      const response = await callA2A('tasks/send', {
        message: { text: 'Write about APIs' },
        mode: 'build',
      });

      const payload = response.body.result.payload;

      // Verify all required fields for frontend
      expect(payload).toHaveProperty('taskId');
      expect(payload).toHaveProperty('conversationId');
      expect(payload).toHaveProperty('status', 'hitl_waiting');
      expect(payload).toHaveProperty('deliverableId');
      expect(payload).toHaveProperty('currentVersionNumber');
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('generatedContent');

      // Verify generated content structure
      expect(payload.generatedContent).toHaveProperty('blogPost');
    });

    it('should return correct pending list item format', async () => {
      const response = await callA2A('hitl.pending', {});

      const payload = response.body.result.payload;

      expect(payload).toHaveProperty('items');
      expect(payload).toHaveProperty('totalCount');

      if (payload.items.length > 0) {
        const item = payload.items[0];
        expect(item).toHaveProperty('conversationId');
        expect(item).toHaveProperty('conversationTitle');
        expect(item).toHaveProperty('taskId');
        expect(item).toHaveProperty('agentSlug');
        expect(item).toHaveProperty('pendingSince');
      }
    });
  });
});
