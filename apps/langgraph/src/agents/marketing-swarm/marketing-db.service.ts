import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execution configuration from task.config.execution
 */
export interface ExecutionConfig {
  maxLocalConcurrent: number;
  maxCloudConcurrent: number;
  maxEditCycles: number;
  topNForFinalRanking: number;
}

/**
 * Agent selection from task.config
 */
export interface AgentSelection {
  agentSlug: string;
  llmConfigId: string;
}

/**
 * Task configuration
 */
export interface TaskConfig {
  writers: AgentSelection[];
  editors: AgentSelection[];
  evaluators: AgentSelection[];
  execution: ExecutionConfig;
}

/**
 * Output row from marketing.outputs
 */
export interface OutputRow {
  id: string;
  task_id: string;
  writer_agent_slug: string;
  writer_llm_config_id: string;
  editor_agent_slug: string | null;
  editor_llm_config_id: string | null;
  content: string | null;
  status: string;
  edit_cycle: number;
  editor_feedback: string | null;
  initial_avg_score: number | null;
  initial_rank: number | null;
  is_finalist: boolean;
  final_total_score: number | null;
  final_rank: number | null;
  llm_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Evaluation row from marketing.evaluations
 */
export interface EvaluationRow {
  id: string;
  task_id: string;
  output_id: string;
  evaluator_agent_slug: string;
  evaluator_llm_config_id: string;
  stage: 'initial' | 'final';
  status: string;
  score: number | null;
  rank: number | null;
  weighted_score: number | null;
  reasoning: string | null;
  llm_metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Agent LLM config with is_local flag
 */
export interface AgentLlmConfig {
  id: string;
  agent_slug: string;
  llm_provider: string;
  llm_model: string;
  display_name: string | null;
  is_default: boolean;
  is_local: boolean;
}

/**
 * Agent personality
 */
export interface AgentPersonality {
  slug: string;
  name: string;
  role: 'writer' | 'editor' | 'evaluator';
  personality: Record<string, unknown>;
}

/**
 * Next action to process
 */
export interface NextAction {
  type: 'write' | 'edit' | 'rewrite' | 'evaluate_initial' | 'evaluate_final';
  output?: OutputRow;
  evaluation?: EvaluationRow;
  agentPersonality?: AgentPersonality;
  llmConfig?: AgentLlmConfig;
}

/**
 * Running counts by local/cloud
 */
export interface RunningCounts {
  local: number;
  cloud: number;
}

/**
 * MarketingDbService
 *
 * Database operations for the Marketing Swarm.
 * Implements the database-driven state machine approach.
 */
@Injectable()
export class MarketingDbService {
  private readonly logger = new Logger(MarketingDbService.name);
  private supabase: SupabaseClient<unknown, 'marketing'>;

  constructor() {
    // Use API URL (6010), not database port (6012)
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:6010';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      // Use the marketing schema for all queries
      db: { schema: 'marketing' },
    });
  }

  /**
   * Get task configuration by task ID
   */
  async getTaskConfig(taskId: string): Promise<TaskConfig | null> {
    const { data, error } = await this.supabase
      .from('swarm_tasks')
      .select('config')
      .eq('task_id', taskId)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to get task config: ${error?.message}`);
      return null;
    }

    return data.config as TaskConfig;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };

    if (status === 'running' && !progress) {
      updates.started_at = new Date().toISOString();
    }
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    if (progress) {
      updates.progress = progress;
    }
    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('swarm_tasks')
      .update(updates)
      .eq('task_id', taskId);

    if (error) {
      this.logger.error(`Failed to update task status: ${error.message}`);
    }
  }

  /**
   * Build the output matrix - create all output rows upfront
   * Writers × Editors combinations with status 'pending_write'
   */
  async buildOutputMatrix(
    taskId: string,
    config: TaskConfig,
  ): Promise<OutputRow[]> {
    const outputs: Partial<OutputRow>[] = [];

    // Create all writer × editor combinations
    for (const writer of config.writers) {
      for (const editor of config.editors) {
        outputs.push({
          id: uuidv4(),
          task_id: taskId,
          writer_agent_slug: writer.agentSlug,
          writer_llm_config_id: writer.llmConfigId,
          editor_agent_slug: editor.agentSlug,
          editor_llm_config_id: editor.llmConfigId,
          status: 'pending_write',
          edit_cycle: 0,
          is_finalist: false,
        });
      }
    }

    const { data, error } = await this.supabase
      .from('outputs')
      .insert(outputs)
      .select();

    if (error) {
      this.logger.error(`Failed to build output matrix: ${error.message}`);
      throw new Error(`Failed to build output matrix: ${error.message}`);
    }

    this.logger.log(`Built output matrix: ${data.length} combinations`);
    return data as OutputRow[];
  }

  /**
   * Get running counts by local/cloud
   */
  async getRunningCounts(taskId: string): Promise<RunningCounts> {
    // Query outputs that are currently in-progress
    const { data, error } = await this.supabase.rpc('get_running_counts', {
      p_task_id: taskId,
    });

    if (error) {
      this.logger.error(`Failed to get running counts: ${error.message}`);
      return { local: 0, cloud: 0 };
    }

    const counts: RunningCounts = { local: 0, cloud: 0 };
    for (const row of data || []) {
      if (row.is_local) {
        counts.local = Number(row.running_count);
      } else {
        counts.cloud = Number(row.running_count);
      }
    }

    return counts;
  }

  /**
   * Get next outputs to process (for writing/editing phase)
   */
  async getNextOutputs(
    taskId: string,
    isLocal: boolean,
    maxCount: number,
  ): Promise<OutputRow[]> {
    const { data, error } = await this.supabase.rpc('get_next_outputs', {
      p_task_id: taskId,
      p_is_local: isLocal,
      p_max_count: maxCount,
    });

    if (error) {
      this.logger.error(`Failed to get next outputs: ${error.message}`);
      return [];
    }

    // Map output_id to id (function returns output_id as the column name)
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      id: row.output_id as string,
    })) as OutputRow[];
  }

  /**
   * Get all pending outputs for any status
   */
  async getPendingOutputs(
    taskId: string,
    statuses: string[],
  ): Promise<OutputRow[]> {
    const { data, error } = await this.supabase
      .from('outputs')
      .select('*')
      .eq('task_id', taskId)
      .in('status', statuses)
      .order('created_at');

    if (error) {
      this.logger.error(`Failed to get pending outputs: ${error.message}`);
      return [];
    }

    return data as OutputRow[];
  }

  /**
   * Update output status (mark as in-progress)
   */
  async updateOutputStatus(
    outputId: string,
    status: string,
    additionalFields?: Partial<OutputRow>,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      ...additionalFields,
    };

    const { error } = await this.supabase
      .from('outputs')
      .update(updates)
      .eq('id', outputId);

    if (error) {
      this.logger.error(`Failed to update output status: ${error.message}`);
    }
  }

  /**
   * Update output with content (after writing completes)
   */
  async updateOutputContent(
    outputId: string,
    content: string,
    status: string,
    llmMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('outputs')
      .update({
        content,
        status,
        llm_metadata: llmMetadata,
      })
      .eq('id', outputId);

    if (error) {
      this.logger.error(`Failed to update output content: ${error.message}`);
    }
  }

  /**
   * Update output after editing
   */
  async updateOutputAfterEdit(
    outputId: string,
    content: string,
    status: string, // 'approved' or 'pending_rewrite'
    editorFeedback: string,
    editCycle: number,
    llmMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('outputs')
      .update({
        content,
        status,
        editor_feedback: editorFeedback,
        edit_cycle: editCycle,
        llm_metadata: llmMetadata,
      })
      .eq('id', outputId);

    if (error) {
      this.logger.error(`Failed to update output after edit: ${error.message}`);
    }
  }

  /**
   * Get agent personality by slug
   */
  async getAgentPersonality(agentSlug: string): Promise<AgentPersonality | null> {
    const { data, error } = await this.supabase
      .from('agents')
      .select('slug, name, role, personality')
      .eq('slug', agentSlug)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to get agent personality: ${error?.message}`);
      return null;
    }

    return data as AgentPersonality;
  }

  /**
   * Get LLM config by ID
   */
  async getLlmConfig(configId: string): Promise<AgentLlmConfig | null> {
    const { data, error } = await this.supabase
      .from('agent_llm_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to get LLM config: ${error?.message}`);
      return null;
    }

    return data as AgentLlmConfig;
  }

  /**
   * Check if all outputs are complete (approved or failed)
   */
  async areAllOutputsComplete(taskId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('outputs')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .not('status', 'in', '("approved","failed")');

    if (error) {
      this.logger.error(`Failed to check outputs complete: ${error.message}`);
      return false;
    }

    return count === 0;
  }

  /**
   * Build initial evaluation rows for all evaluators × outputs
   */
  async buildInitialEvaluations(
    taskId: string,
    config: TaskConfig,
  ): Promise<EvaluationRow[]> {
    // Get all approved outputs
    const { data: outputs, error: outputsError } = await this.supabase
      .from('outputs')
      .select('id')
      .eq('task_id', taskId)
      .eq('status', 'approved');

    if (outputsError || !outputs) {
      this.logger.error(`Failed to get outputs for evaluations: ${outputsError?.message}`);
      return [];
    }

    const evaluations: Partial<EvaluationRow>[] = [];

    for (const output of outputs) {
      for (const evaluator of config.evaluators) {
        evaluations.push({
          id: uuidv4(),
          task_id: taskId,
          output_id: output.id,
          evaluator_agent_slug: evaluator.agentSlug,
          evaluator_llm_config_id: evaluator.llmConfigId,
          stage: 'initial',
          status: 'pending',
        });
      }
    }

    const { data, error } = await this.supabase
      .from('evaluations')
      .insert(evaluations)
      .select();

    if (error) {
      this.logger.error(`Failed to build initial evaluations: ${error.message}`);
      return [];
    }

    this.logger.log(`Built ${data.length} initial evaluations`);
    return data as EvaluationRow[];
  }

  /**
   * Get pending evaluations
   */
  async getPendingEvaluations(
    taskId: string,
    stage: 'initial' | 'final',
  ): Promise<EvaluationRow[]> {
    const { data, error } = await this.supabase
      .from('evaluations')
      .select('*')
      .eq('task_id', taskId)
      .eq('stage', stage)
      .eq('status', 'pending')
      .order('created_at');

    if (error) {
      this.logger.error(`Failed to get pending evaluations: ${error.message}`);
      return [];
    }

    return data as EvaluationRow[];
  }

  /**
   * Update evaluation with score
   */
  async updateEvaluation(
    evaluationId: string,
    score: number,
    reasoning: string,
    status: string,
    rank?: number,
    weightedScore?: number,
    llmMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      score,
      reasoning,
      status,
      llm_metadata: llmMetadata,
    };

    if (rank !== undefined) {
      updates.rank = rank;
    }
    if (weightedScore !== undefined) {
      updates.weighted_score = weightedScore;
    }

    const { error } = await this.supabase
      .from('evaluations')
      .update(updates)
      .eq('id', evaluationId);

    if (error) {
      this.logger.error(`Failed to update evaluation: ${error.message}`);
    }
  }

  /**
   * Check if all initial evaluations are complete
   */
  async areAllInitialEvaluationsComplete(taskId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('evaluations')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .eq('stage', 'initial')
      .neq('status', 'completed');

    if (error) {
      this.logger.error(`Failed to check evaluations complete: ${error.message}`);
      return false;
    }

    return count === 0;
  }

  /**
   * Calculate initial rankings and select finalists
   */
  async calculateInitialRankingsAndSelectFinalists(
    taskId: string,
    topN: number,
  ): Promise<number> {
    // Calculate rankings
    const { error: rankError } = await this.supabase.rpc(
      'calculate_initial_rankings',
      { p_task_id: taskId },
    );

    if (rankError) {
      this.logger.error(`Failed to calculate rankings: ${rankError.message}`);
      return 0;
    }

    // Select finalists
    const { data, error: selectError } = await this.supabase.rpc(
      'select_finalists',
      { p_task_id: taskId, p_top_n: topN },
    );

    if (selectError) {
      this.logger.error(`Failed to select finalists: ${selectError.message}`);
      return 0;
    }

    this.logger.log(`Selected ${data} finalists`);
    return data as number;
  }

  /**
   * Build final evaluation rows for finalists
   */
  async buildFinalEvaluations(
    taskId: string,
    config: TaskConfig,
  ): Promise<EvaluationRow[]> {
    // Get finalist outputs
    const { data: finalists, error: finalistsError } = await this.supabase
      .from('outputs')
      .select('id')
      .eq('task_id', taskId)
      .eq('is_finalist', true);

    if (finalistsError || !finalists) {
      this.logger.error(`Failed to get finalists: ${finalistsError?.message}`);
      return [];
    }

    const evaluations: Partial<EvaluationRow>[] = [];

    for (const output of finalists) {
      for (const evaluator of config.evaluators) {
        evaluations.push({
          id: uuidv4(),
          task_id: taskId,
          output_id: output.id,
          evaluator_agent_slug: evaluator.agentSlug,
          evaluator_llm_config_id: evaluator.llmConfigId,
          stage: 'final',
          status: 'pending',
        });
      }
    }

    const { data, error } = await this.supabase
      .from('evaluations')
      .insert(evaluations)
      .select();

    if (error) {
      this.logger.error(`Failed to build final evaluations: ${error.message}`);
      return [];
    }

    this.logger.log(`Built ${data.length} final evaluations`);
    return data as EvaluationRow[];
  }

  /**
   * Check if all final evaluations are complete
   */
  async areAllFinalEvaluationsComplete(taskId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('evaluations')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId)
      .eq('stage', 'final')
      .neq('status', 'completed');

    if (error) {
      this.logger.error(`Failed to check final evaluations: ${error.message}`);
      return false;
    }

    return count === 0;
  }

  /**
   * Calculate final rankings
   */
  async calculateFinalRankings(taskId: string): Promise<void> {
    const { error } = await this.supabase.rpc(
      'calculate_final_rankings',
      { p_task_id: taskId },
    );

    if (error) {
      this.logger.error(`Failed to calculate final rankings: ${error.message}`);
    }
  }

  /**
   * Get output by ID with full details
   */
  async getOutputById(outputId: string): Promise<OutputRow | null> {
    const { data, error } = await this.supabase
      .from('outputs')
      .select('*')
      .eq('id', outputId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as OutputRow;
  }

  /**
   * Get all outputs for a task
   */
  async getAllOutputs(taskId: string): Promise<OutputRow[]> {
    const { data, error } = await this.supabase
      .from('outputs')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at');

    if (error) {
      this.logger.error(`Failed to get all outputs: ${error.message}`);
      return [];
    }

    return data as OutputRow[];
  }

  /**
   * Get all evaluations for a task
   */
  async getAllEvaluations(taskId: string): Promise<EvaluationRow[]> {
    const { data, error } = await this.supabase
      .from('evaluations')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at');

    if (error) {
      this.logger.error(`Failed to get all evaluations: ${error.message}`);
      return [];
    }

    return data as EvaluationRow[];
  }

  /**
   * Get content type context
   */
  async getContentTypeContext(contentTypeSlug: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('content_types')
      .select('system_context')
      .eq('slug', contentTypeSlug)
      .single();

    if (error || !data) {
      return null;
    }

    return data.system_context;
  }

  /**
   * Get prompt data from task
   */
  async getPromptData(taskId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabase
      .from('swarm_tasks')
      .select('prompt_data, content_type_slug')
      .eq('task_id', taskId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      promptData: data.prompt_data,
      contentTypeSlug: data.content_type_slug,
    };
  }

  /**
   * Delete all data for a task (evaluations, outputs, and the task itself)
   *
   * Order matters due to foreign key constraints:
   * 1. Delete evaluations (references outputs)
   * 2. Delete outputs (references swarm_tasks)
   * 3. Delete swarm_task
   *
   * @returns true if deletion was successful, false otherwise
   */
  async deleteTaskData(taskId: string): Promise<boolean> {
    this.logger.log(`Deleting all data for task: ${taskId}`);

    try {
      // 1. Delete evaluations first (references outputs)
      const { error: evalError } = await this.supabase
        .from('evaluations')
        .delete()
        .eq('task_id', taskId);

      if (evalError) {
        this.logger.error(`Failed to delete evaluations: ${evalError.message}`);
        return false;
      }

      // 2. Delete outputs (references swarm_tasks)
      const { error: outputError } = await this.supabase
        .from('outputs')
        .delete()
        .eq('task_id', taskId);

      if (outputError) {
        this.logger.error(`Failed to delete outputs: ${outputError.message}`);
        return false;
      }

      // 3. Delete the swarm_task
      const { error: taskError } = await this.supabase
        .from('swarm_tasks')
        .delete()
        .eq('task_id', taskId);

      if (taskError) {
        this.logger.error(`Failed to delete swarm_task: ${taskError.message}`);
        return false;
      }

      this.logger.log(`Successfully deleted all data for task: ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting task data: ${error}`);
      return false;
    }
  }

  /**
   * Check if a task exists
   */
  async taskExists(taskId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('swarm_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (error) {
      this.logger.error(`Failed to check task exists: ${error.message}`);
      return false;
    }

    return (count ?? 0) > 0;
  }
}
