import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  RiskAssessment,
  CreateRiskAssessmentData,
} from '../interfaces/assessment.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

export interface AssessmentFilter {
  includeTest?: boolean;
  testScenarioId?: string;
}

@Injectable()
export class AssessmentRepository {
  private readonly logger = new Logger(AssessmentRepository.name);
  private readonly schema = 'risk';
  private readonly table = 'assessments';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  private applyTestFilter<T extends { eq: (col: string, val: unknown) => T }>(
    query: T,
    filter?: AssessmentFilter,
  ): T {
    if (filter?.testScenarioId) {
      query = query.eq('test_scenario_id', filter.testScenarioId);
    } else if (!filter?.includeTest) {
      query = query.eq('is_test', false);
    }
    return query;
  }

  async findBySubject(
    subjectId: string,
    filter?: AssessmentFilter,
  ): Promise<RiskAssessment[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('subject_id', subjectId);

    query = this.applyTestFilter(query, filter);

    const { data, error } = (await query.order('created_at', {
      ascending: false,
    })) as SupabaseSelectListResponse<RiskAssessment>;

    if (error) {
      this.logger.error(`Failed to fetch assessments: ${error.message}`);
      throw new Error(`Failed to fetch assessments: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Find the latest assessment for a subject and dimension
   */
  async findLatestBySubjectAndDimension(
    subjectId: string,
    dimensionId: string,
    filter?: AssessmentFilter,
  ): Promise<RiskAssessment | null> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('subject_id', subjectId)
      .eq('dimension_id', dimensionId);

    query = this.applyTestFilter(query, filter);

    const { data, error } = (await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single()) as SupabaseSelectResponse<RiskAssessment>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch latest assessment: ${error.message}`);
      throw new Error(`Failed to fetch latest assessment: ${error.message}`);
    }

    return data;
  }

  /**
   * Find all assessments for a task (all dimensions analyzed in one run)
   */
  async findByTask(taskId: string): Promise<RiskAssessment[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', {
        ascending: true,
      })) as SupabaseSelectListResponse<RiskAssessment>;

    if (error) {
      this.logger.error(
        `Failed to fetch assessments by task: ${error.message}`,
      );
      throw new Error(`Failed to fetch assessments by task: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<RiskAssessment | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<RiskAssessment>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch assessment: ${error.message}`);
      throw new Error(`Failed to fetch assessment: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<RiskAssessment> {
    const assessment = await this.findById(id);
    if (!assessment) {
      throw new NotFoundException(`Assessment not found: ${id}`);
    }
    return assessment;
  }

  async create(
    assessmentData: CreateRiskAssessmentData,
  ): Promise<RiskAssessment> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(assessmentData)
      .select()
      .single()) as SupabaseSelectResponse<RiskAssessment>;

    if (error) {
      this.logger.error(`Failed to create assessment: ${error.message}`);
      throw new Error(`Failed to create assessment: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no assessment returned');
    }

    this.logger.log(`Created assessment: ${data.id} (score: ${data.score})`);
    return data;
  }

  async createBatch(
    assessments: CreateRiskAssessmentData[],
  ): Promise<RiskAssessment[]> {
    if (assessments.length === 0) {
      return [];
    }

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(assessments)
      .select()) as SupabaseSelectListResponse<RiskAssessment>;

    if (error) {
      this.logger.error(`Failed to create assessments batch: ${error.message}`);
      throw new Error(`Failed to create assessments batch: ${error.message}`);
    }

    this.logger.log(`Created ${data?.length ?? 0} assessments in batch`);
    return data ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete assessment: ${error.message}`);
      throw new Error(`Failed to delete assessment: ${error.message}`);
    }

    this.logger.log(`Deleted assessment: ${id}`);
  }

  /**
   * Find recent assessments for a subject (for history/timeline)
   */
  async findRecentBySubject(
    subjectId: string,
    limit: number = 10,
    filter?: AssessmentFilter,
  ): Promise<RiskAssessment[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('subject_id', subjectId);

    query = this.applyTestFilter(query, filter);

    const { data, error } = (await query
      .order('created_at', { ascending: false })
      .limit(limit)) as SupabaseSelectListResponse<RiskAssessment>;

    if (error) {
      this.logger.error(`Failed to fetch recent assessments: ${error.message}`);
      throw new Error(`Failed to fetch recent assessments: ${error.message}`);
    }

    return data ?? [];
  }
}
