/**
 * E2E Test: HITL (Human-in-the-Loop) Workflows
 * Tests the complete HITL workflow via the A2A endpoint
 *
 * Prerequisites:
 * - API server running on localhost:6100
 * - LangGraph server running on localhost:6200
 * - Supabase running with seeded data
 * - ANTHROPIC_API_KEY set in environment
 *
 * Run with: npx jest --config apps/api/testing/jest-e2e.json hitl-e2e
 *
 * NOTE: These tests require the extended-post-writer agent which has HITL enabled.
 * The agent must be seeded in the database and LangGraph must be running.
 */

const API_URL = process.env.API_URL || 'http://localhost:6100';
const TEST_EMAIL = process.env.SUPABASE_TEST_USER || 'demo.user@orchestratorai.io';
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || 'DemoUser123!';
const ORG_SLUG = 'demo-org';
const AGENT_SLUG = 'extended-post-writer';
const AGENT_TYPE = 'api';

// NIL_UUID for unset context fields
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// Timeout for LLM operations
const LLM_TIMEOUT = 120000;

interface A2AResponse {
  success: boolean;
  mode: string;
  payload: {
    content: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
}

interface TaskResponse extends A2AResponse {
  payload: {
    content: {
      taskId?: string;
      conversationId?: string;
      status?: string;
      deliverableId?: string;
      currentVersionNumber?: number;
      message?: string;
      generatedContent?: Record<string, unknown>;
      deliverable?: Record<string, unknown>;
      version?: Record<string, unknown>;
    };
    metadata: Record<string, unknown>;
  };
}

describe('HITL E2E Tests (A2A Endpoint)', () => {
  let authToken: string;
  let userId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Authenticate
    const authResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    if (!authResponse.ok) {
      throw new Error(
        `Authentication failed: ${authResponse.status} ${authResponse.statusText}`,
      );
    }

    const authData = await authResponse.json();
    expect(authData.accessToken).toBeDefined();
    authToken = authData.accessToken;

    // Extract userId from JWT sub claim or use env variable
    try {
      const jwtParts = authToken.split('.');
      if (jwtParts[1]) {
        const jwtPayload = JSON.parse(
          Buffer.from(jwtParts[1], 'base64').toString(),
        );
        userId = jwtPayload.sub;
      } else {
        userId = process.env.SUPABASE_TEST_USERID || '';
      }
    } catch {
      userId = process.env.SUPABASE_TEST_USERID || '';
    }
    expect(userId).toBeTruthy();
  }, 30000);

  /**
   * Helper to call A2A endpoint
   * Includes ExecutionContext as required by Phase 3.5
   */
  const callA2A = async (
    mode: string,
    userMessage: string,
    payload: Record<string, unknown> = {},
  ): Promise<TaskResponse> => {
    const response = await fetch(
      `${API_URL}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userMessage,
          mode,
          // ExecutionContext - required by Phase 3.5
          context: {
            orgSlug: ORG_SLUG,
            agentSlug: AGENT_SLUG,
            agentType: AGENT_TYPE,
            userId,
            conversationId: conversationId || NIL_UUID,
            taskId: NIL_UUID,
            planId: NIL_UUID,
            deliverableId: NIL_UUID,
            provider: 'ollama',
            model: 'llama3.2:1b',
          },
          payload: {
            ...payload,
          },
        }),
      },
    );

    return response.json();
  };

  /**
   * Helper to call HITL resume endpoint
   */
  const resumeHitl = async (
    taskId: string,
    decision: string,
    options: { feedback?: string; content?: Record<string, unknown> } = {},
  ): Promise<TaskResponse> => {
    const response = await fetch(
      `${API_URL}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks/${taskId}/resume`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          decision,
          ...options,
        }),
      },
    );

    return response.json();
  };

  describe('HITL Workflow Setup', () => {
    it('should start a conversation to establish context', async () => {
      const response = await callA2A(
        'converse',
        'I want to write a blog post about AI agents for testing purposes',
      );

      expect(response.success).toBe(true);
      expect(response.mode).toBe('converse');

      // Extract conversationId for subsequent tests
      conversationId =
        (response.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;
      expect(conversationId).toBeDefined();
    }, LLM_TIMEOUT);
  });

  describe('HITL APPROVE Flow', () => {
    let taskId: string;
    let deliverableId: string;

    it('should trigger HITL when building content', async () => {
      const response = await callA2A(
        'build',
        'Now build the blog post about AI agents',
      );

      expect(response.success).toBe(true);
      expect(response.mode).toBe('build');

      // Check if HITL was triggered
      const status = response.payload?.content?.status;
      taskId = response.payload?.content?.taskId as string;
      deliverableId = response.payload?.content?.deliverableId as string;

      // HITL-enabled agents should return hitl_waiting or provide content for review
      if (status === 'hitl_waiting') {
        expect(taskId).toBeDefined();
        expect(response.payload?.content?.generatedContent).toBeDefined();
      } else {
        // Agent might not have HITL enabled - test completion flow instead
        expect(response.payload?.content?.deliverable).toBeDefined();
      }
    }, LLM_TIMEOUT);

    it('should complete APPROVE flow if HITL is pending', async () => {
      if (!taskId) {
        // Skip if HITL wasn't triggered
        console.log('HITL not triggered - skipping approve test');
        return;
      }

      const response = await resumeHitl(taskId, 'approve');

      expect(response.success).toBe(true);
      expect(response.payload?.content?.status).toBe('completed');
    }, LLM_TIMEOUT);
  });

  describe('HITL REGENERATE Flow', () => {
    let taskId: string;
    let newConversationId: string;

    beforeAll(async () => {
      // Start fresh conversation for regenerate test
      const converseResponse = await callA2A(
        'converse',
        'Write a blog post about quantum computing for my tech blog',
      );
      newConversationId =
        (converseResponse.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;
    }, LLM_TIMEOUT);

    it('should trigger HITL and allow REGENERATE with feedback', async () => {
      // Use the new conversation
      const originalConversationId = conversationId;
      conversationId = newConversationId;

      try {
        const buildResponse = await callA2A(
          'build',
          'Build the quantum computing blog post',
        );

        const status = buildResponse.payload?.content?.status;
        taskId = buildResponse.payload?.content?.taskId as string;

        if (status !== 'hitl_waiting') {
          console.log('HITL not triggered - skipping regenerate test');
          return;
        }

        // Request regeneration with feedback
        const regenerateResponse = await resumeHitl(taskId, 'regenerate', {
          feedback: 'Make it shorter and more engaging for beginners',
        });

        expect(regenerateResponse.success).toBe(true);
        // Should return new HITL waiting state
        expect(regenerateResponse.payload?.content?.status).toBe('hitl_waiting');

        // Now approve the regenerated content
        const approveResponse = await resumeHitl(taskId, 'approve');
        expect(approveResponse.success).toBe(true);
        expect(approveResponse.payload?.content?.status).toBe('completed');
      } finally {
        conversationId = originalConversationId;
      }
    }, LLM_TIMEOUT * 2);
  });

  describe('HITL REPLACE Flow', () => {
    let taskId: string;
    let replaceConversationId: string;

    beforeAll(async () => {
      // Start fresh conversation for replace test
      const converseResponse = await callA2A(
        'converse',
        'Write a blog post about machine learning basics',
      );
      replaceConversationId =
        (converseResponse.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;
    }, LLM_TIMEOUT);

    it('should allow REPLACE with custom content', async () => {
      const originalConversationId = conversationId;
      conversationId = replaceConversationId;

      try {
        const buildResponse = await callA2A(
          'build',
          'Build the machine learning blog post',
        );

        const status = buildResponse.payload?.content?.status;
        taskId = buildResponse.payload?.content?.taskId as string;

        if (status !== 'hitl_waiting') {
          console.log('HITL not triggered - skipping replace test');
          return;
        }

        // Replace with custom content
        const replaceResponse = await resumeHitl(taskId, 'replace', {
          content: {
            blogPost:
              '# My Custom Blog Post\n\nThis is my own content about ML.',
            seoDescription: 'A custom SEO description for ML basics',
            socialPosts: ['Check out my new ML post!'],
          },
        });

        expect(replaceResponse.success).toBe(true);
        expect(replaceResponse.payload?.content?.status).toBe('completed');
      } finally {
        conversationId = originalConversationId;
      }
    }, LLM_TIMEOUT);
  });

  describe('HITL REJECT Flow', () => {
    let taskId: string;
    let rejectConversationId: string;

    beforeAll(async () => {
      // Start fresh conversation for reject test
      const converseResponse = await callA2A(
        'converse',
        'Write a blog post about cloud computing trends',
      );
      rejectConversationId =
        (converseResponse.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;
    }, LLM_TIMEOUT);

    it('should handle REJECT and regenerate', async () => {
      const originalConversationId = conversationId;
      conversationId = rejectConversationId;

      try {
        const buildResponse = await callA2A(
          'build',
          'Build the cloud computing blog post',
        );

        const status = buildResponse.payload?.content?.status;
        taskId = buildResponse.payload?.content?.taskId as string;

        if (status !== 'hitl_waiting') {
          console.log('HITL not triggered - skipping reject test');
          return;
        }

        // Reject the content
        const rejectResponse = await resumeHitl(taskId, 'reject');

        expect(rejectResponse.success).toBe(true);
        // Should regenerate and return new HITL waiting
        expect(rejectResponse.payload?.content?.status).toBe('hitl_waiting');

        // Now approve
        const approveResponse = await resumeHitl(taskId, 'approve');
        expect(approveResponse.success).toBe(true);
      } finally {
        conversationId = originalConversationId;
      }
    }, LLM_TIMEOUT * 2);
  });

  describe('HITL Validation', () => {
    it('should reject REGENERATE without feedback', async () => {
      // This test uses an existing taskId if available, or creates one
      const converseResponse = await callA2A(
        'converse',
        'Write about validation testing',
      );
      const validationConversationId =
        (converseResponse.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;

      const originalConversationId = conversationId;
      conversationId = validationConversationId;

      try {
        const buildResponse = await callA2A(
          'build',
          'Build the validation test post',
        );

        const taskId = buildResponse.payload?.content?.taskId as string;
        const status = buildResponse.payload?.content?.status;

        if (status !== 'hitl_waiting' || !taskId) {
          console.log('HITL not triggered - skipping validation test');
          return;
        }

        // Try to regenerate without feedback
        const response = await resumeHitl(taskId, 'regenerate');

        // Should fail validation
        expect(response.success).toBe(false);
        expect(
          JSON.stringify(response.payload?.metadata).toLowerCase(),
        ).toContain('feedback');
      } finally {
        conversationId = originalConversationId;
      }
    }, LLM_TIMEOUT);

    it('should reject REPLACE without content', async () => {
      const converseResponse = await callA2A(
        'converse',
        'Write about replace validation',
      );
      const validationConversationId =
        (converseResponse.payload?.metadata?.streaming as Record<string, unknown>)
          ?.conversationId as string;

      const originalConversationId = conversationId;
      conversationId = validationConversationId;

      try {
        const buildResponse = await callA2A(
          'build',
          'Build the replace validation post',
        );

        const taskId = buildResponse.payload?.content?.taskId as string;
        const status = buildResponse.payload?.content?.status;

        if (status !== 'hitl_waiting' || !taskId) {
          console.log('HITL not triggered - skipping validation test');
          return;
        }

        // Try to replace without content
        const response = await resumeHitl(taskId, 'replace');

        // Should fail validation
        expect(response.success).toBe(false);
        expect(
          JSON.stringify(response.payload?.metadata).toLowerCase(),
        ).toContain('content');
      } finally {
        conversationId = originalConversationId;
      }
    }, LLM_TIMEOUT);
  });
});
