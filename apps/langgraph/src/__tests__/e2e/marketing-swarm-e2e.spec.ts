import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createMockExecutionContext,
  ExecutionContext,
  NIL_UUID,
} from '@orchestrator-ai/transport-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Comprehensive End-to-End Tests for Marketing Swarm Agent (Phase 2)
 *
 * These tests cover:
 * 1. Database-driven state machine
 * 2. Dual-track execution (local sequential + cloud parallel)
 * 3. Edit cycle loop (up to maxEditCycles)
 * 4. Two-stage evaluation (initial 1-10 scoring, final weighted ranking)
 * 5. SSE/Observability message structure
 * 6. Status and state retrieval endpoints
 * 7. Edge cases and error handling
 *
 * Prerequisites:
 * - E2E_TESTS=true environment variable
 * - Supabase running with test data seeded
 * - SUPABASE_SERVICE_ROLE_KEY configured
 */

// Skip E2E tests if environment is not configured
const shouldRunE2E =
  process.env.E2E_TESTS === 'true' && process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeE2E = shouldRunE2E ? describe : describe.skip;

// Test timeout for LLM operations (longer for swarm operations)
const LLM_TIMEOUT = 120000; // 2 minutes
const SWARM_TIMEOUT = 300000; // 5 minutes for full swarm execution

describeE2E('Marketing Swarm E2E Tests', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;
  let testOrgSlug: string;

  // Environment variables
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:6010';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const testEmail =
    process.env.SUPABASE_TEST_USER || 'golfergeek@orchestratorai.io';
  const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'GolferGeek123!';

  /**
   * Collected observability events for verification
   */
  let observabilityEvents: any[] = [];

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Authenticate
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } =
      await anonClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (authError) {
      console.warn('Auth failed, tests may fail:', authError.message);
    } else if (authData?.session?.access_token) {
      authToken = authData.session.access_token;
      testUserId = authData.user?.id || 'test-user-id';
    }

    testOrgSlug = 'demo-org';

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

  /**
   * Helper to create a task in the database (simulating frontend task creation)
   */
  async function createTestTask(options: {
    taskId: string;
    contentTypeSlug?: string;
    promptData?: Record<string, unknown>;
    writers: { agentSlug: string; llmConfigId: string }[];
    editors: { agentSlug: string; llmConfigId: string }[];
    evaluators: { agentSlug: string; llmConfigId: string }[];
    execution?: {
      maxLocalConcurrent?: number;
      maxCloudConcurrent?: number;
      maxEditCycles?: number;
      topNForFinalRanking?: number;
    };
  }): Promise<void> {
    const config = {
      writers: options.writers,
      editors: options.editors,
      evaluators: options.evaluators,
      execution: {
        maxLocalConcurrent: options.execution?.maxLocalConcurrent ?? 1,
        maxCloudConcurrent: options.execution?.maxCloudConcurrent ?? 5,
        maxEditCycles: options.execution?.maxEditCycles ?? 2,
        topNForFinalRanking: options.execution?.topNForFinalRanking ?? 3,
      },
    };

    const promptData = options.promptData ?? {
      topic: 'Test Topic for Marketing Swarm',
      audience: 'Developers',
      goal: 'Generate test content',
      tone: 'professional',
      keyPoints: ['Point 1', 'Point 2', 'Point 3'],
    };

    const { error } = await supabase.from('marketing.swarm_tasks').insert({
      task_id: options.taskId,
      organization_slug: testOrgSlug,
      user_id: testUserId,
      content_type_slug: options.contentTypeSlug ?? 'blog-post',
      prompt_data: promptData,
      config,
      status: 'pending',
    });

    if (error) {
      throw new Error(`Failed to create test task: ${error.message}`);
    }
  }

  /**
   * Helper to get LLM config IDs from database
   */
  async function getLlmConfigIds(): Promise<{
    localWriter: string;
    cloudWriter: string;
    localEditor: string;
    cloudEditor: string;
    localEvaluator: string;
    cloudEvaluator: string;
  }> {
    // Get a local (Ollama) writer config
    const { data: localWriterConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'writer-creative')
      .eq('is_local', true)
      .single();

    // Get a cloud (Anthropic) writer config
    const { data: cloudWriterConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'writer-creative')
      .eq('llm_provider', 'anthropic')
      .single();

    // Get editor configs
    const { data: localEditorConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'editor-clarity')
      .eq('is_local', true)
      .single();

    const { data: cloudEditorConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'editor-clarity')
      .eq('llm_provider', 'anthropic')
      .single();

    // Get evaluator configs
    const { data: localEvaluatorConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'evaluator-quality')
      .eq('is_local', true)
      .single();

    const { data: cloudEvaluatorConfig } = await supabase
      .from('marketing.agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'evaluator-quality')
      .eq('llm_provider', 'anthropic')
      .single();

    return {
      localWriter: localWriterConfig?.id || '',
      cloudWriter: cloudWriterConfig?.id || '',
      localEditor: localEditorConfig?.id || '',
      cloudEditor: cloudEditorConfig?.id || '',
      localEvaluator: localEvaluatorConfig?.id || '',
      cloudEvaluator: cloudEvaluatorConfig?.id || '',
    };
  }

  /**
   * Helper to create execution context
   */
  function createTestContext(taskId: string): ExecutionContext {
    return createMockExecutionContext({
      orgSlug: testOrgSlug,
      userId: testUserId,
      taskId,
      conversationId: `conv-${taskId}`,
      agentSlug: 'marketing-swarm',
      agentType: 'langgraph',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  }

  /**
   * Helper to clean up test data
   */
  async function cleanupTestData(taskId: string): Promise<void> {
    // Delete evaluations
    await supabase
      .from('marketing.evaluations')
      .delete()
      .eq('task_id', taskId);

    // Delete outputs
    await supabase.from('marketing.outputs').delete().eq('task_id', taskId);

    // Delete task
    await supabase.from('marketing.swarm_tasks').delete().eq('task_id', taskId);
  }

  /**
   * Helper to extract data from API response
   */
  function getData(body: { data?: unknown; success?: boolean } | unknown): unknown {
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as { data: unknown }).data;
    }
    return body;
  }

  // ============================================================================
  // TEST SUITE 1: Database Setup and Task Creation
  // ============================================================================

  describe('1. Database Setup and Task Creation', () => {
    const taskId = `test-setup-${Date.now()}`;

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should have required agents seeded in database', async () => {
      const { data: writers } = await supabase
        .from('marketing.agents')
        .select('slug, name, role')
        .eq('role', 'writer');

      expect(writers).toBeDefined();
      expect(writers!.length).toBeGreaterThanOrEqual(4);

      const { data: editors } = await supabase
        .from('marketing.agents')
        .select('slug, name, role')
        .eq('role', 'editor');

      expect(editors).toBeDefined();
      expect(editors!.length).toBeGreaterThanOrEqual(4);

      const { data: evaluators } = await supabase
        .from('marketing.agents')
        .select('slug, name, role')
        .eq('role', 'evaluator');

      expect(evaluators).toBeDefined();
      expect(evaluators!.length).toBeGreaterThanOrEqual(3);
    });

    it('should have LLM configs with is_local flag', async () => {
      const { data: localConfigs } = await supabase
        .from('marketing.agent_llm_configs')
        .select('*')
        .eq('is_local', true);

      expect(localConfigs).toBeDefined();
      expect(localConfigs!.length).toBeGreaterThan(0);

      // Verify local configs are for Ollama
      for (const config of localConfigs!) {
        expect(config.llm_provider).toBe('ollama');
      }

      const { data: cloudConfigs } = await supabase
        .from('marketing.agent_llm_configs')
        .select('*')
        .eq('is_local', false);

      expect(cloudConfigs).toBeDefined();
      expect(cloudConfigs!.length).toBeGreaterThan(0);

      // Verify cloud configs are for Anthropic/OpenAI
      for (const config of cloudConfigs!) {
        expect(['anthropic', 'openai', 'google']).toContain(config.llm_provider);
      }
    });

    it('should create a task with proper config structure', async () => {
      const configs = await getLlmConfigIds();

      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 1,
          maxCloudConcurrent: 3,
          maxEditCycles: 2,
          topNForFinalRanking: 3,
        },
      });

      // Verify task was created
      const { data: task } = await supabase
        .from('marketing.swarm_tasks')
        .select('*')
        .eq('task_id', taskId)
        .single();

      expect(task).toBeDefined();
      expect(task!.status).toBe('pending');
      expect(task!.config.writers).toHaveLength(1);
      expect(task!.config.editors).toHaveLength(1);
      expect(task!.config.evaluators).toHaveLength(1);
      expect(task!.config.execution.maxEditCycles).toBe(2);
      expect(task!.config.execution.topNForFinalRanking).toBe(3);
    });
  });

  // ============================================================================
  // TEST SUITE 2: Basic Execution Flow
  // ============================================================================

  describe('2. Basic Execution Flow (Cloud Only)', () => {
    const taskId = `test-basic-${Date.now()}`;
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Create minimal task: 1 writer, 1 editor, 1 evaluator (all cloud)
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0, // No local
          maxCloudConcurrent: 5,
          maxEditCycles: 1, // Single edit cycle
          topNForFinalRanking: 1,
        },
      });
    });

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should execute the swarm and return results', async () => {
      const context = createTestContext(taskId);

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context,
        });

      expect([200, 201]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('status');
      expect(['completed', 'failed']).toContain(data.status);

      if (data.status === 'completed') {
        expect(data).toHaveProperty('outputs');
        expect(data).toHaveProperty('evaluations');
        expect(data.outputs.length).toBeGreaterThan(0);
      }
    }, SWARM_TIMEOUT);

    it('should update task status in database', async () => {
      const { data: task } = await supabase
        .from('marketing.swarm_tasks')
        .select('status, started_at, completed_at')
        .eq('task_id', taskId)
        .single();

      expect(task).toBeDefined();
      expect(['completed', 'failed']).toContain(task!.status);

      if (task!.status === 'completed') {
        expect(task!.started_at).toBeDefined();
        expect(task!.completed_at).toBeDefined();
      }
    });

    it('should create outputs with correct status flow', async () => {
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('*')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      expect(outputs!.length).toBe(1); // 1 writer × 1 editor

      const output = outputs![0];
      expect(output.writer_agent_slug).toBe('writer-creative');
      expect(output.editor_agent_slug).toBe('editor-clarity');
      expect(['approved', 'failed']).toContain(output.status);

      if (output.status === 'approved') {
        expect(output.content).toBeDefined();
        expect(output.content.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // TEST SUITE 3: Dual-Track Execution (Local + Cloud)
  // ============================================================================

  describe('3. Dual-Track Execution', () => {
    const taskId = `test-dual-${Date.now()}`;
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Skip if no local LLM configs available
      if (!configs.localWriter || !configs.localEditor) {
        console.log('Skipping dual-track tests - no local LLM configs');
        return;
      }

      // Create task with both local and cloud agents
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
          { agentSlug: 'writer-technical', llmConfigId: configs.localWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 1, // Local runs sequentially
          maxCloudConcurrent: 3, // Cloud runs in parallel
          maxEditCycles: 1,
          topNForFinalRanking: 2,
        },
      });
    });

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should process local and cloud outputs separately', async () => {
      if (!configs.localWriter) {
        console.log('Skipping - no local config');
        return;
      }

      const context = createTestContext(taskId);

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      expect([200, 201]).toContain(response.status);
      const data = getData(response.body) as any;

      // Check outputs were created for both tracks
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('*, writer_llm_config:marketing.agent_llm_configs!writer_llm_config_id(is_local)')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      // 2 writers × 1 editor = 2 outputs
      expect(outputs!.length).toBe(2);

      // Verify we have both local and cloud outputs
      const localOutputs = outputs!.filter((o: any) => o.writer_llm_config?.is_local);
      const cloudOutputs = outputs!.filter((o: any) => !o.writer_llm_config?.is_local);

      expect(localOutputs.length).toBe(1);
      expect(cloudOutputs.length).toBe(1);
    }, SWARM_TIMEOUT);

    it('should respect maxLocalConcurrent limit', async () => {
      // This test verifies that local outputs are processed sequentially
      // We can't directly observe this, but we can check that all local outputs completed
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('*, writer_llm_config:marketing.agent_llm_configs!writer_llm_config_id(is_local, llm_provider)')
        .eq('task_id', taskId);

      for (const output of outputs || []) {
        if ((output as any).writer_llm_config?.is_local) {
          expect(['approved', 'failed']).toContain(output.status);
        }
      }
    });
  });

  // ============================================================================
  // TEST SUITE 4: Edit Cycle Loop
  // ============================================================================

  describe('4. Edit Cycle Loop', () => {
    const taskId = `test-edit-${Date.now()}`;
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Create task with multiple edit cycles allowed
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0,
          maxCloudConcurrent: 5,
          maxEditCycles: 3, // Allow up to 3 edit cycles
          topNForFinalRanking: 1,
        },
      });
    });

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should track edit cycles correctly', async () => {
      const context = createTestContext(taskId);

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      expect([200, 201]).toContain(response.status);

      // Check output edit_cycle field
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('edit_cycle, status, editor_feedback')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      const output = outputs![0];

      // edit_cycle should be >= 1 (at least one edit happened)
      expect(output.edit_cycle).toBeGreaterThanOrEqual(1);

      // Should not exceed maxEditCycles
      expect(output.edit_cycle).toBeLessThanOrEqual(3);

      // Status should be approved (or failed)
      expect(['approved', 'failed']).toContain(output.status);
    }, SWARM_TIMEOUT);

    it('should store editor feedback', async () => {
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('editor_feedback')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();

      // If there was an edit cycle, there should be feedback
      const output = outputs![0];
      if (output.editor_feedback) {
        expect(output.editor_feedback.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // TEST SUITE 5: Two-Stage Evaluation
  // ============================================================================

  describe('5. Two-Stage Evaluation', () => {
    const taskId = `test-eval-${Date.now()}`;
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Create task with multiple outputs for evaluation
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
          { agentSlug: 'writer-technical', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
          { agentSlug: 'evaluator-conversion', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0,
          maxCloudConcurrent: 5,
          maxEditCycles: 1,
          topNForFinalRanking: 2, // Top 2 go to final round
        },
      });
    });

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should complete initial evaluation with 1-10 scores', async () => {
      const context = createTestContext(taskId);

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      expect([200, 201]).toContain(response.status);

      // Check initial evaluations
      const { data: initialEvals } = await supabase
        .from('marketing.evaluations')
        .select('*')
        .eq('task_id', taskId)
        .eq('stage', 'initial');

      expect(initialEvals).toBeDefined();
      // 2 writers × 1 editor × 2 evaluators = 4 initial evaluations
      expect(initialEvals!.length).toBe(4);

      for (const evaluation of initialEvals!) {
        expect(['completed', 'failed']).toContain(evaluation.status);
        if (evaluation.status === 'completed') {
          expect(evaluation.score).toBeGreaterThanOrEqual(1);
          expect(evaluation.score).toBeLessThanOrEqual(10);
          expect(evaluation.reasoning).toBeDefined();
        }
      }
    }, SWARM_TIMEOUT);

    it('should calculate initial rankings and select finalists', async () => {
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('id, initial_avg_score, initial_rank, is_finalist')
        .eq('task_id', taskId)
        .order('initial_rank', { ascending: true });

      expect(outputs).toBeDefined();

      // Check rankings are assigned
      let rankedOutputs = outputs!.filter((o) => o.initial_rank !== null);
      expect(rankedOutputs.length).toBeGreaterThan(0);

      // Check finalists are selected
      const finalists = outputs!.filter((o) => o.is_finalist);
      expect(finalists.length).toBeLessThanOrEqual(2); // topNForFinalRanking = 2

      // Finalists should have the best initial ranks
      for (const finalist of finalists) {
        expect(finalist.initial_rank).toBeLessThanOrEqual(2);
      }
    });

    it('should complete final evaluation with weighted ranking', async () => {
      const { data: finalEvals } = await supabase
        .from('marketing.evaluations')
        .select('*')
        .eq('task_id', taskId)
        .eq('stage', 'final');

      expect(finalEvals).toBeDefined();

      if (finalEvals!.length > 0) {
        for (const evaluation of finalEvals!) {
          expect(['completed', 'failed']).toContain(evaluation.status);
          if (evaluation.status === 'completed') {
            // Final evaluations have rank (1-5) and weighted_score
            if (evaluation.rank !== null) {
              expect(evaluation.rank).toBeGreaterThanOrEqual(1);
              expect(evaluation.rank).toBeLessThanOrEqual(5);
            }
            if (evaluation.weighted_score !== null) {
              expect([100, 60, 30, 10, 5, 0]).toContain(evaluation.weighted_score);
            }
          }
        }
      }
    });

    it('should calculate final rankings with weighted scores', async () => {
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('id, final_total_score, final_rank, is_finalist')
        .eq('task_id', taskId)
        .eq('is_finalist', true)
        .order('final_rank', { ascending: true });

      // Check that finalists have final rankings
      const rankedFinalists = outputs?.filter((o) => o.final_rank !== null) || [];

      if (rankedFinalists.length > 0) {
        // Best ranked output should have highest total score
        expect(rankedFinalists[0].final_rank).toBe(1);

        // Verify ranking order matches score order (descending)
        for (let i = 1; i < rankedFinalists.length; i++) {
          expect(rankedFinalists[i].final_total_score).toBeLessThanOrEqual(
            rankedFinalists[i - 1].final_total_score
          );
        }
      }
    });
  });

  // ============================================================================
  // TEST SUITE 6: Status and State Endpoints
  // ============================================================================

  describe('6. Status and State Endpoints', () => {
    const taskId = `test-status-${Date.now()}`;
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Create and execute a simple task
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0,
          maxCloudConcurrent: 5,
          maxEditCycles: 1,
          topNForFinalRanking: 1,
        },
      });

      // Execute the task
      const context = createTestContext(taskId);
      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });
    }, SWARM_TIMEOUT);

    afterAll(async () => {
      await cleanupTestData(taskId);
    });

    it('should return status for existing task', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/status/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('status');
      expect(['completed', 'failed', 'running']).toContain(data.status);
      expect(data).toHaveProperty('progress');
      expect(data.progress).toHaveProperty('total');
      expect(data.progress).toHaveProperty('completed');
      expect(data.progress).toHaveProperty('percentage');
    });

    it('should return full state for reconnection', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/state/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('outputs');
      expect(data).toHaveProperty('evaluations');
      expect(Array.isArray(data.outputs)).toBe(true);
      expect(Array.isArray(data.evaluations)).toBe(true);

      // Outputs should have full data for UI reconstruction
      if (data.outputs.length > 0) {
        const output = data.outputs[0];
        expect(output).toHaveProperty('id');
        expect(output).toHaveProperty('status');
        expect(output).toHaveProperty('writer_agent_slug');
        expect(output).toHaveProperty('editor_agent_slug');
        expect(output).toHaveProperty('content');
      }
    });

    it('should return 404 for non-existent task status', async () => {
      const response = await request(app.getHttpServer())
        .get('/marketing-swarm/status/non-existent-task-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([404]).toContain(response.status);
    });

    it('should return 404 for non-existent task state', async () => {
      const response = await request(app.getHttpServer())
        .get('/marketing-swarm/state/non-existent-task-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([404]).toContain(response.status);
    });
  });

  // ============================================================================
  // TEST SUITE 7: SSE/Observability Messages
  // ============================================================================

  describe('7. SSE/Observability Messages', () => {
    it('should emit events with correct metadata structure', async () => {
      const taskId = `test-sse-${Date.now()}`;
      const configs = await getLlmConfigIds();

      // Create simple task
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0,
          maxCloudConcurrent: 5,
          maxEditCycles: 1,
          topNForFinalRanking: 1,
        },
      });

      // Note: Full SSE testing would require listening to the SSE endpoint
      // For this test, we verify the task executes successfully
      // and the database state reflects correct phase transitions

      const context = createTestContext(taskId);

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      expect([200, 201]).toContain(response.status);

      // Verify task went through all phases (reflected in final state)
      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('status')
        .eq('task_id', taskId);

      const { data: evaluations } = await supabase
        .from('marketing.evaluations')
        .select('stage, status')
        .eq('task_id', taskId);

      // Should have outputs (writing phase completed)
      expect(outputs).toBeDefined();
      expect(outputs!.length).toBeGreaterThan(0);

      // Should have evaluations (evaluation phase completed)
      expect(evaluations).toBeDefined();
      expect(evaluations!.length).toBeGreaterThan(0);

      // Clean up
      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);
  });

  // ============================================================================
  // TEST SUITE 8: Edge Cases and Error Handling
  // ============================================================================

  describe('8. Edge Cases and Error Handling', () => {
    it('should reject execution without context', async () => {
      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect([400]).toContain(response.status);
    });

    it('should reject execution without taskId in context', async () => {
      const context = createMockExecutionContext({
        taskId: '', // Empty taskId
      });

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      expect([400]).toContain(response.status);
    });

    it('should handle task not found in database', async () => {
      const context = createTestContext('non-existent-task-id');

      const response = await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      // Should fail gracefully
      expect([200, 400, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = getData(response.body) as any;
        expect(data.status).toBe('failed');
      }
    });

    it('should handle empty writers array', async () => {
      const taskId = `test-empty-writers-${Date.now()}`;
      const configs = await getLlmConfigIds();

      // Create task with no writers (invalid config)
      const { error } = await supabase.from('marketing.swarm_tasks').insert({
        task_id: taskId,
        organization_slug: testOrgSlug,
        user_id: testUserId,
        content_type_slug: 'blog-post',
        prompt_data: { topic: 'Test' },
        config: {
          writers: [], // Empty!
          editors: [{ agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor }],
          evaluators: [{ agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator }],
          execution: { maxLocalConcurrent: 0, maxCloudConcurrent: 5, maxEditCycles: 1, topNForFinalRanking: 1 },
        },
        status: 'pending',
      });

      if (!error) {
        const context = createTestContext(taskId);
        const response = await request(app.getHttpServer())
          .post('/marketing-swarm/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ context });

        // Should either fail gracefully or produce 0 outputs
        expect([200, 400, 500]).toContain(response.status);

        await cleanupTestData(taskId);
      }
    });

    it('should handle concurrent execution requests', async () => {
      const taskId = `test-concurrent-${Date.now()}`;
      const configs = await getLlmConfigIds();

      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
      });

      const context = createTestContext(taskId);

      // Send multiple concurrent requests
      const requests = [
        request(app.getHttpServer())
          .post('/marketing-swarm/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ context }),
        request(app.getHttpServer())
          .post('/marketing-swarm/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ context }),
      ];

      const responses = await Promise.all(requests);

      // At least one should succeed or they should handle concurrency
      const successCount = responses.filter((r) => r.status === 200 || r.status === 201).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);
  });

  // ============================================================================
  // TEST SUITE 9: Output Matrix Validation
  // ============================================================================

  describe('9. Output Matrix Validation', () => {
    it('should create correct number of outputs (writers × editors)', async () => {
      const taskId = `test-matrix-${Date.now()}`;
      const configs = await getLlmConfigIds();

      // 2 writers × 3 editors = 6 outputs
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
          { agentSlug: 'writer-technical', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
          { agentSlug: 'editor-brand', llmConfigId: configs.cloudEditor },
          { agentSlug: 'editor-engagement', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
        execution: {
          maxLocalConcurrent: 0,
          maxCloudConcurrent: 10,
          maxEditCycles: 1,
          topNForFinalRanking: 3,
        },
      });

      const context = createTestContext(taskId);

      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('writer_agent_slug, editor_agent_slug')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      expect(outputs!.length).toBe(6); // 2 × 3

      // Verify all combinations exist
      const combinations = new Set(
        outputs!.map((o) => `${o.writer_agent_slug}:${o.editor_agent_slug}`)
      );
      expect(combinations.size).toBe(6);

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);
  });

  // ============================================================================
  // TEST SUITE 10: LLM Metadata Tracking
  // ============================================================================

  describe('10. LLM Metadata Tracking', () => {
    it('should store LLM metadata for outputs', async () => {
      const taskId = `test-metadata-${Date.now()}`;
      const configs = await getLlmConfigIds();

      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
      });

      const context = createTestContext(taskId);

      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      const { data: outputs } = await supabase
        .from('marketing.outputs')
        .select('llm_metadata')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();

      // LLM metadata should include token usage and latency
      const output = outputs![0];
      if (output.llm_metadata) {
        expect(output.llm_metadata).toHaveProperty('latencyMs');
        // tokensUsed may be present depending on provider
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    it('should store LLM metadata for evaluations', async () => {
      const taskId = `test-eval-metadata-${Date.now()}`;
      const configs = await getLlmConfigIds();

      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
        ],
        editors: [
          { agentSlug: 'editor-clarity', llmConfigId: configs.cloudEditor },
        ],
        evaluators: [
          { agentSlug: 'evaluator-quality', llmConfigId: configs.cloudEvaluator },
        ],
      });

      const context = createTestContext(taskId);

      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      const { data: evaluations } = await supabase
        .from('marketing.evaluations')
        .select('llm_metadata')
        .eq('task_id', taskId);

      expect(evaluations).toBeDefined();

      // LLM metadata should include latency
      if (evaluations!.length > 0 && evaluations![0].llm_metadata) {
        expect(evaluations![0].llm_metadata).toHaveProperty('latencyMs');
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);
  });
});
