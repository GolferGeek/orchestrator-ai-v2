import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

/**
 * Test target mirror entity - maps production targets to test symbols
 * Based on prediction.test_target_mirrors table
 */
export interface TestTargetMirror {
  id: string;
  organization_slug: string;
  production_target_id: string;
  test_symbol: string;
  created_at: string;
}

/**
 * Data for creating a new test target mirror
 */
export interface CreateTestTargetMirrorData {
  id?: string;
  organization_slug: string;
  production_target_id: string;
  test_symbol: string;
}

/**
 * Repository for test target mirrors (prediction.test_target_mirrors)
 * Part of the Test Data Injection Framework (Phase 3)
 *
 * Maps production targets to test symbols for data isolation.
 * Test symbols must start with 'T_' prefix.
 */
@Injectable()
export class TestTargetMirrorRepository {
  private readonly logger = new Logger(TestTargetMirrorRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'test_target_mirrors';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Find a test target mirror by ID
   */
  async findById(id: string): Promise<TestTargetMirror | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<TestTargetMirror>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch test target mirror: ${error.message}`);
      throw new Error(`Failed to fetch test target mirror: ${error.message}`);
    }

    return data;
  }

  /**
   * Find all test target mirrors for an organization
   */
  async findByOrganization(
    organizationSlug: string,
  ): Promise<TestTargetMirror[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('organization_slug', organizationSlug)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<TestTargetMirror>;

    if (error) {
      this.logger.error(
        `Failed to fetch test target mirrors: ${error.message}`,
      );
      throw new Error(`Failed to fetch test target mirrors: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Find a test target mirror by production target ID
   */
  async findByProductionTarget(
    productionTargetId: string,
  ): Promise<TestTargetMirror | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('production_target_id', productionTargetId)
      .single()) as SupabaseSelectResponse<TestTargetMirror>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to fetch test target mirror by production target: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch test target mirror by production target: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Find a test target mirror by test symbol
   */
  async findByTestSymbol(testSymbol: string): Promise<TestTargetMirror | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('test_symbol', testSymbol)
      .single()) as SupabaseSelectResponse<TestTargetMirror>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to fetch test target mirror by test symbol: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch test target mirror by test symbol: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Create a new test target mirror
   */
  async create(
    mirrorData: CreateTestTargetMirrorData,
  ): Promise<TestTargetMirror> {
    // Validate test symbol prefix
    if (!mirrorData.test_symbol.startsWith('T_')) {
      throw new Error('Test symbol must start with T_ prefix');
    }

    const dataToInsert = {
      ...mirrorData,
      id: mirrorData.id ?? uuidv4(),
    };

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(dataToInsert)
      .select()
      .single()) as SupabaseSelectResponse<TestTargetMirror>;

    if (error) {
      this.logger.error(
        `Failed to create test target mirror: ${error.message}`,
      );
      throw new Error(`Failed to create test target mirror: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no test target mirror returned');
    }

    this.logger.log(
      `Created test target mirror: ${data.id} (${data.production_target_id} -> ${data.test_symbol})`,
    );
    return data;
  }

  /**
   * Delete a test target mirror
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Failed to delete test target mirror: ${error.message}`,
      );
      throw new Error(`Failed to delete test target mirror: ${error.message}`);
    }

    this.logger.log(`Deleted test target mirror: ${id}`);
  }

  /**
   * Ensure a test target mirror exists for a production target
   * Creates one if it doesn't exist
   * @param productionTargetId - The production target ID to mirror
   * @param organizationSlug - The organization slug
   * @param baseSymbol - Optional base symbol for the test symbol (default: uses UUID)
   * @returns The existing or newly created test target mirror
   */
  async ensureMirrorExists(
    productionTargetId: string,
    organizationSlug: string,
    baseSymbol?: string,
  ): Promise<TestTargetMirror> {
    // Check if mirror already exists
    const existing = await this.findByProductionTarget(productionTargetId);
    if (existing) {
      return existing;
    }

    // Generate test symbol
    const testSymbol = baseSymbol
      ? `T_${baseSymbol}`
      : `T_${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create new mirror
    return this.create({
      organization_slug: organizationSlug,
      production_target_id: productionTargetId,
      test_symbol: testSymbol,
    });
  }

  /**
   * Get the test symbol for a production target
   * Returns null if no mirror exists
   * @param productionTargetId - The production target ID
   * @returns The test symbol or null
   */
  async getTestSymbol(productionTargetId: string): Promise<string | null> {
    const mirror = await this.findByProductionTarget(productionTargetId);
    return mirror?.test_symbol ?? null;
  }

  /**
   * Get the production target ID for a test symbol
   * Returns null if no mirror exists
   * @param testSymbol - The test symbol
   * @returns The production target ID or null
   */
  async getProductionTargetId(testSymbol: string): Promise<string | null> {
    const mirror = await this.findByTestSymbol(testSymbol);
    return mirror?.production_target_id ?? null;
  }
}
