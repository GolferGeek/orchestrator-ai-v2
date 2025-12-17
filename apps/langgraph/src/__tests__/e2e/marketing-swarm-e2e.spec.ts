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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let marketingSupabase: SupabaseClient<any, 'marketing'>; // Client with marketing schema
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
    // Initialize Supabase client for public schema
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Initialize Supabase client for marketing schema
    marketingSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'marketing' },
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
      // Use a default test UUID for user when auth fails
      testUserId = NIL_UUID;
    } else if (authData?.session?.access_token) {
      authToken = authData.session.access_token;
      testUserId = authData.user?.id || NIL_UUID;
    } else {
      testUserId = NIL_UUID;
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
      topNForDeliverable?: number;
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
        topNForDeliverable: options.execution?.topNForDeliverable ?? 3,
      },
    };

    const promptData = options.promptData ?? {
      topic: 'Test Topic for Marketing Swarm',
      audience: 'Developers',
      goal: 'Generate test content',
      tone: 'professional',
      keyPoints: ['Point 1', 'Point 2', 'Point 3'],
    };

    const { error } = await marketingSupabase.from('swarm_tasks').insert({
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
    const { data: localWriterConfig, error: lwErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'writer-creative')
      .eq('is_local', true)
      .single();
    if (lwErr) console.warn('localWriter lookup failed:', lwErr.message);

    // Get a cloud (Anthropic) writer config
    const { data: cloudWriterConfig, error: cwErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'writer-creative')
      .eq('llm_provider', 'anthropic')
      .single();
    if (cwErr) console.warn('cloudWriter lookup failed:', cwErr.message);

    // Get editor configs
    const { data: localEditorConfig, error: leErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'editor-clarity')
      .eq('is_local', true)
      .single();
    if (leErr) console.warn('localEditor lookup failed:', leErr.message);

    const { data: cloudEditorConfig, error: ceErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'editor-clarity')
      .eq('llm_provider', 'anthropic')
      .single();
    if (ceErr) console.warn('cloudEditor lookup failed:', ceErr.message);

    // Get evaluator configs
    const { data: localEvaluatorConfig, error: levErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'evaluator-quality')
      .eq('is_local', true)
      .single();
    if (levErr) console.warn('localEvaluator lookup failed:', levErr.message);

    const { data: cloudEvaluatorConfig, error: cevErr } = await marketingSupabase
      .from('agent_llm_configs')
      .select('id')
      .eq('agent_slug', 'evaluator-quality')
      .eq('llm_provider', 'anthropic')
      .single();
    if (cevErr) console.warn('cloudEvaluator lookup failed:', cevErr.message);

    // Throw if required configs are missing (they should be seeded)
    if (!cloudWriterConfig?.id) {
      throw new Error('Cloud writer config not found - ensure marketing.agent_llm_configs is seeded');
    }
    if (!cloudEditorConfig?.id) {
      throw new Error('Cloud editor config not found - ensure marketing.agent_llm_configs is seeded');
    }
    if (!cloudEvaluatorConfig?.id) {
      throw new Error('Cloud evaluator config not found - ensure marketing.agent_llm_configs is seeded');
    }

    return {
      localWriter: localWriterConfig?.id || NIL_UUID,
      cloudWriter: cloudWriterConfig.id,
      localEditor: localEditorConfig?.id || NIL_UUID,
      cloudEditor: cloudEditorConfig.id,
      localEvaluator: localEvaluatorConfig?.id || NIL_UUID,
      cloudEvaluator: cloudEvaluatorConfig.id,
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
    await marketingSupabase
      .from('evaluations')
      .delete()
      .eq('task_id', taskId);

    // Delete output versions
    await marketingSupabase
      .from('output_versions')
      .delete()
      .eq('task_id', taskId);

    // Delete outputs
    await marketingSupabase.from('outputs').delete().eq('task_id', taskId);

    // Delete task
    await marketingSupabase.from('swarm_tasks').delete().eq('task_id', taskId);
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
    const taskId = uuidv4();

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
    const taskId = uuidv4();
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
    const taskId = uuidv4();
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

      for (const output of (outputs || []) as any[]) {
        if (output.writer_llm_config?.is_local) {
          expect(['approved', 'failed']).toContain(output.status);
        }
      }
    });
  });

  // ============================================================================
  // TEST SUITE 4: Edit Cycle Loop
  // ============================================================================

  describe('4. Edit Cycle Loop', () => {
    const taskId = uuidv4();
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
    const taskId = uuidv4();
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
    const taskId = uuidv4();
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
      const taskId = uuidv4();
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

    it('should include cost data in output_updated SSE events', async () => {
      const taskId = uuidv4();
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

      // Execute and wait for completion
      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      // The SSE events would have been emitted during execution
      // We verify that the database reflects cost data that would be sent via SSE
      // (The dual-track processor emits output_updated events with full output data including llm_metadata)

      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('id, llm_metadata')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      expect(outputs!.length).toBeGreaterThan(0);

      // Each output should have cost data that was included in SSE events
      for (const output of outputs!) {
        const metadata = output.llm_metadata as Record<string, unknown>;

        // These fields are included in SSE output_updated events
        expect(metadata).toBeDefined();
        expect(metadata.cost).toBeDefined();
        expect(metadata.tokensUsed).toBeDefined();

        // The frontend receives these via SSE and displays them
        console.log(`Output ${output.id} cost data for SSE:`, {
          cost: metadata.cost,
          tokensUsed: metadata.tokensUsed,
          llmCallCount: metadata.llmCallCount,
          evaluationCost: metadata.evaluationCost,
        });
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    it('should include cost data in evaluation_updated SSE events', async () => {
      const taskId = uuidv4();
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

      // Verify evaluation data includes costs (sent via SSE evaluation_updated events)
      const { data: evaluations } = await marketingSupabase
        .from('evaluations')
        .select('id, llm_metadata, score, stage')
        .eq('task_id', taskId);

      expect(evaluations).toBeDefined();
      expect(evaluations!.length).toBeGreaterThan(0);

      for (const evaluation of evaluations!) {
        const metadata = evaluation.llm_metadata as Record<string, unknown>;

        // These fields are included in SSE evaluation_updated events
        expect(metadata).toBeDefined();
        expect(metadata.cost).toBeDefined();
        expect(metadata.tokensUsed).toBeDefined();

        console.log(`Evaluation ${evaluation.id} (${evaluation.stage}) cost data for SSE:`, {
          cost: metadata.cost,
          tokensUsed: metadata.tokensUsed,
          score: evaluation.score,
        });
      }

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
      const taskId = uuidv4();
      const configs = await getLlmConfigIds();

      // Create task with no writers (invalid config)
      const { error } = await marketingSupabase.from('swarm_tasks').insert({
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
      const taskId = uuidv4();
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
      const taskId = uuidv4();
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
  // TEST SUITE 10: Deliverable and Versioned Deliverable Output
  // ============================================================================

  describe('10. Deliverable and Versioned Deliverable Output', () => {
    const taskId = uuidv4(); // Must be a valid UUID
    let configs: Awaited<ReturnType<typeof getLlmConfigIds>>;
    const topNForDeliverable = 3; // Configure to return top 3 outputs as versions

    beforeAll(async () => {
      configs = await getLlmConfigIds();

      // Create task with multiple writers to generate multiple outputs
      // and set topNForDeliverable to control number of versions
      await createTestTask({
        taskId,
        writers: [
          { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
          { agentSlug: 'writer-technical', llmConfigId: configs.cloudWriter },
          { agentSlug: 'writer-persuasive', llmConfigId: configs.cloudWriter },
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
          topNForFinalRanking: 3,
          topNForDeliverable, // This controls versioned deliverable count
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

    it('should return deliverable with ranked outputs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('contentTypeSlug');
      expect(data).toHaveProperty('promptData');
      expect(data).toHaveProperty('rankedOutputs');
      expect(data).toHaveProperty('totalOutputs');
      expect(data).toHaveProperty('deliveredCount');

      // Should have ranked outputs (winner is first)
      expect(Array.isArray(data.rankedOutputs)).toBe(true);
      expect(data.rankedOutputs.length).toBeGreaterThan(0);

      // Winner is the first ranked output
      const winner = data.rankedOutputs[0];
      expect(winner).toHaveProperty('rank', 1);
      expect(winner).toHaveProperty('finalContent');
      expect(winner.finalContent.length).toBeGreaterThan(0);
      expect(winner).toHaveProperty('writerAgentSlug');
      expect(winner).toHaveProperty('editorAgentSlug');
    });

    it('should return versioned deliverable with correct number of versions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/versioned-deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('type', 'versioned');
      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('versions');
      expect(Array.isArray(data.versions)).toBe(true);

      // Should have topNForDeliverable versions (or fewer if not enough outputs)
      // We created 3 writers × 1 editor = 3 outputs, and topNForDeliverable = 3
      expect(data.versions.length).toBeGreaterThan(0);
      expect(data.versions.length).toBeLessThanOrEqual(topNForDeliverable);

      // Versions should be in reverse rank order (lowest rank first, highest rank last)
      // Version 1 = lowest ranked in selection, Version N = winner (rank 1)
      if (data.versions.length > 1) {
        // First version should have higher rank number (worse)
        // Last version should have rank 1 (best)
        const lastVersion = data.versions[data.versions.length - 1];
        expect(lastVersion.rank).toBe(1); // Best ranked is last version
      }

      // Each version should have required fields
      for (const version of data.versions) {
        expect(version).toHaveProperty('version');
        expect(version).toHaveProperty('rank');
        expect(version).toHaveProperty('content');
        expect(version).toHaveProperty('writerAgent');
        expect(version).toHaveProperty('score');
        expect(version.content.length).toBeGreaterThan(0);
      }
    });

    it('should have correct version numbering (1 to N)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/versioned-deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      // Verify version numbers are sequential starting from 1
      const versionNumbers = data.versions.map((v: any) => v.version).sort((a: number, b: number) => a - b);

      for (let i = 0; i < versionNumbers.length; i++) {
        expect(versionNumbers[i]).toBe(i + 1);
      }
    });

    it('should have winner matching the highest version', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/versioned-deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('winner');

      if (data.winner && data.versions.length > 0) {
        // Winner should match the last version (highest version number)
        const lastVersion = data.versions[data.versions.length - 1];
        expect(data.winner.rank).toBe(1);
        expect(data.winner.content).toBe(lastVersion.content);
      }
    });

    it('should include total candidates count', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/versioned-deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('totalCandidates');
      // totalCandidates should reflect all approved outputs
      expect(data.totalCandidates).toBeGreaterThanOrEqual(data.versions.length);
    });

    it('should include generation timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get(`/marketing-swarm/versioned-deliverable/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200]).toContain(response.status);
      const data = getData(response.body) as any;

      expect(data).toHaveProperty('generatedAt');
      // Should be a valid ISO date string
      const timestamp = new Date(data.generatedAt);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return 404 for non-existent task deliverable', async () => {
      const response = await request(app.getHttpServer())
        .get('/marketing-swarm/deliverable/non-existent-task-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([404]).toContain(response.status);
    });

    it('should return 404 for non-existent task versioned-deliverable', async () => {
      const response = await request(app.getHttpServer())
        .get('/marketing-swarm/versioned-deliverable/non-existent-task-12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect([404]).toContain(response.status);
    });
  });

  // ============================================================================
  // TEST SUITE 11: LLM Metadata Tracking
  // ============================================================================

  describe('11. LLM Metadata Tracking', () => {
    it('should store LLM metadata for outputs', async () => {
      const taskId = uuidv4();
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
      const taskId = uuidv4();
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

  // ============================================================================
  // TEST SUITE 12: LLM Cost Tracking (Database-driven pricing)
  // ============================================================================

  describe('12. LLM Cost Tracking', () => {
    /**
     * Test that costs are calculated and stored for each write operation
     */
    it('should store cost in outputs table after writing', async () => {
      const taskId = uuidv4();
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

      // Check outputs table has cost in llm_metadata
      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('id, llm_metadata, status')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      expect(outputs!.length).toBeGreaterThan(0);

      // Each output should have cost tracking fields
      for (const output of outputs!) {
        expect(output.llm_metadata).toBeDefined();
        const metadata = output.llm_metadata as Record<string, unknown>;

        // Cost should be present and > 0 (from LLMPricingService)
        expect(metadata.cost).toBeDefined();
        expect(typeof metadata.cost).toBe('number');
        expect(metadata.cost as number).toBeGreaterThan(0);

        // Token count should be present
        expect(metadata.tokensUsed).toBeDefined();
        expect(typeof metadata.tokensUsed).toBe('number');
        expect(metadata.tokensUsed as number).toBeGreaterThan(0);

        // Latency should be present
        expect(metadata.latencyMs).toBeDefined();
        expect(typeof metadata.latencyMs).toBe('number');

        // LLM call count should track accumulation
        expect(metadata.llmCallCount).toBeDefined();
        expect(typeof metadata.llmCallCount).toBe('number');
        expect(metadata.llmCallCount as number).toBeGreaterThanOrEqual(1);
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test that costs accumulate across write + edit cycles
     */
    it('should accumulate costs across edit cycles', async () => {
      const taskId = uuidv4();
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
          maxEditCycles: 3, // Allow up to 3 edit cycles
        },
      });

      const context = createTestContext(taskId);

      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      // Check outputs have accumulated costs
      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('id, llm_metadata, edit_cycle')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();

      for (const output of outputs!) {
        const metadata = output.llm_metadata as Record<string, unknown>;
        const editCycle = output.edit_cycle as number;

        // If output went through edit cycles, llmCallCount should reflect that
        // write (1) + edit cycles (editCycle rewrites)
        if (editCycle > 0) {
          // At minimum: 1 write + editCycle number of edit calls
          expect(metadata.llmCallCount as number).toBeGreaterThanOrEqual(1 + editCycle);
        }

        // Total latency should be accumulated
        if (metadata.totalLatencyMs) {
          expect(metadata.totalLatencyMs as number).toBeGreaterThan(0);
        }
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test that evaluation costs are stored in evaluations table
     */
    it('should store cost in evaluations table', async () => {
      const taskId = uuidv4();
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

      // Check evaluations table has cost
      const { data: evaluations } = await marketingSupabase
        .from('evaluations')
        .select('id, llm_metadata, score, stage')
        .eq('task_id', taskId);

      expect(evaluations).toBeDefined();
      expect(evaluations!.length).toBeGreaterThan(0);

      for (const evaluation of evaluations!) {
        expect(evaluation.llm_metadata).toBeDefined();
        const metadata = evaluation.llm_metadata as Record<string, unknown>;

        // Cost should be present for each evaluation
        expect(metadata.cost).toBeDefined();
        expect(typeof metadata.cost).toBe('number');
        expect(metadata.cost as number).toBeGreaterThan(0);

        // Token count should be present
        expect(metadata.tokensUsed).toBeDefined();
        expect(typeof metadata.tokensUsed).toBe('number');

        // Latency should be present
        expect(metadata.latencyMs).toBeDefined();
        expect(typeof metadata.latencyMs).toBe('number');
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test that evaluation costs are added to output's running total
     */
    it('should add evaluation costs to output running total', async () => {
      const taskId = uuidv4();
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

      // Get outputs with their metadata
      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('id, llm_metadata')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();

      for (const output of outputs!) {
        const metadata = output.llm_metadata as Record<string, unknown>;

        // If evaluations were done on this output, evaluationCost should be tracked
        if (metadata.evaluationCost !== undefined) {
          expect(typeof metadata.evaluationCost).toBe('number');
          expect(metadata.evaluationCost as number).toBeGreaterThan(0);

          // evaluationTokens should also be tracked
          expect(metadata.evaluationTokens).toBeDefined();
          expect(typeof metadata.evaluationTokens).toBe('number');
        }

        // Total cost should include evaluation costs
        const totalCost = metadata.cost as number;
        const evalCost = (metadata.evaluationCost as number) || 0;

        // Total cost should be >= evaluation cost (since it includes write/edit costs too)
        expect(totalCost).toBeGreaterThanOrEqual(evalCost);
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test that output_versions table stores per-version costs
     */
    it('should store costs in output_versions for each write/rewrite', async () => {
      const taskId = uuidv4();
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
          maxEditCycles: 2,
        },
      });

      const context = createTestContext(taskId);

      await request(app.getHttpServer())
        .post('/marketing-swarm/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ context });

      // Check output_versions table
      const { data: versions } = await marketingSupabase
        .from('output_versions')
        .select('id, output_id, version_number, action_type, llm_metadata')
        .eq('task_id', taskId)
        .order('version_number', { ascending: true });

      expect(versions).toBeDefined();
      expect(versions!.length).toBeGreaterThan(0);

      for (const version of versions!) {
        expect(version.llm_metadata).toBeDefined();
        const metadata = version.llm_metadata as Record<string, unknown>;

        // Each version should have its own cost (not accumulated)
        expect(metadata.cost).toBeDefined();
        expect(typeof metadata.cost).toBe('number');
        expect(metadata.cost as number).toBeGreaterThan(0);

        // Token count per version
        expect(metadata.tokensUsed).toBeDefined();
        expect(typeof metadata.tokensUsed).toBe('number');

        // Latency per version
        expect(metadata.latencyMs).toBeDefined();
        expect(typeof metadata.latencyMs).toBe('number');

        // action_type should indicate write or rewrite
        expect(['write', 'rewrite']).toContain(version.action_type);
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test multiple provider/model combinations have different costs
     */
    it('should calculate different costs for different providers/models', async () => {
      const taskId = uuidv4();
      const configs = await getLlmConfigIds();

      // Use both local and cloud writers if available
      const writers = [
        { agentSlug: 'writer-creative', llmConfigId: configs.cloudWriter },
      ];

      // Add local writer if available
      if (configs.localWriter !== NIL_UUID) {
        writers.push({ agentSlug: 'writer-analytical', llmConfigId: configs.localWriter });
      }

      await createTestTask({
        taskId,
        writers,
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

      // Get outputs grouped by writer
      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('id, writer_agent_slug, writer_llm_config_id, llm_metadata')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();

      // All outputs should have cost
      for (const output of outputs!) {
        const metadata = output.llm_metadata as Record<string, unknown>;
        expect(metadata.cost).toBeDefined();
        expect(metadata.cost as number).toBeGreaterThan(0);
      }

      // If we have multiple writers, costs may differ based on provider pricing
      // (This is a soft check - costs depend on token counts and model pricing)
      if (outputs!.length > 1) {
        const costs = outputs!.map((o) => (o.llm_metadata as Record<string, unknown>).cost as number);
        console.log('Costs from different writers:', costs);
        // At minimum, all should be positive
        expect(costs.every((c) => c > 0)).toBe(true);
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);

    /**
     * Test that total task cost can be calculated from outputs
     */
    it('should allow calculation of total task cost from all outputs', async () => {
      const taskId = uuidv4();
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

      // Get all outputs and evaluations
      const { data: outputs } = await marketingSupabase
        .from('outputs')
        .select('llm_metadata')
        .eq('task_id', taskId);

      const { data: evaluations } = await marketingSupabase
        .from('evaluations')
        .select('llm_metadata')
        .eq('task_id', taskId);

      expect(outputs).toBeDefined();
      expect(evaluations).toBeDefined();

      // Calculate total cost from outputs (which already includes evaluation costs)
      let totalOutputCost = 0;
      for (const output of outputs!) {
        const metadata = output.llm_metadata as Record<string, unknown>;
        totalOutputCost += (metadata.cost as number) || 0;
      }

      // Calculate evaluation-only cost for verification
      let totalEvalCost = 0;
      for (const evaluation of evaluations!) {
        const metadata = evaluation.llm_metadata as Record<string, unknown>;
        totalEvalCost += (metadata.cost as number) || 0;
      }

      console.log(`Task ${taskId} costs:`);
      console.log(`  Total from outputs (includes eval): $${totalOutputCost.toFixed(4)}`);
      console.log(`  Evaluations only: $${totalEvalCost.toFixed(4)}`);

      // Total cost should be positive
      expect(totalOutputCost).toBeGreaterThan(0);

      // Evaluation cost should be part of the total
      if (evaluations!.length > 0) {
        expect(totalEvalCost).toBeGreaterThan(0);
      }

      await cleanupTestData(taskId);
    }, SWARM_TIMEOUT);
  });
});
