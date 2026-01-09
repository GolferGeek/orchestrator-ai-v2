import { Injectable, Logger } from '@nestjs/common';
import { AnalystRepository } from '../repositories/analyst.repository';
import {
  Analyst,
  ActiveAnalyst,
  LlmTier,
} from '../interfaces/analyst.interface';
import { CreateAnalystDto, UpdateAnalystDto } from '../dto/analyst.dto';

@Injectable()
export class AnalystService {
  private readonly logger = new Logger(AnalystService.name);

  constructor(private readonly analystRepository: AnalystRepository) {}

  /**
   * Get active analysts for a target with effective weights/tiers
   * Uses database function to respect scope hierarchy and overrides
   */
  async getActiveAnalysts(
    targetId: string,
    tier?: LlmTier,
  ): Promise<ActiveAnalyst[]> {
    this.logger.log(
      `Getting active analysts for target: ${targetId}, tier: ${tier || 'default'}`,
    );
    return this.analystRepository.getActiveAnalysts(targetId, tier);
  }

  async findById(id: string): Promise<Analyst | null> {
    return this.analystRepository.findById(id);
  }

  async findByIdOrThrow(id: string): Promise<Analyst> {
    return this.analystRepository.findByIdOrThrow(id);
  }

  async findBySlug(
    slug: string,
    scopeLevel?: string,
    domain?: string,
  ): Promise<Analyst[]> {
    return this.analystRepository.findBySlug(slug, scopeLevel, domain);
  }

  async create(dto: CreateAnalystDto): Promise<Analyst> {
    this.logger.log(
      `Creating analyst: ${dto.slug} at scope ${dto.scope_level}`,
    );
    return this.analystRepository.create(dto);
  }

  async update(id: string, dto: UpdateAnalystDto): Promise<Analyst> {
    this.logger.log(`Updating analyst: ${id}`);
    return this.analystRepository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting analyst: ${id}`);
    return this.analystRepository.delete(id);
  }

  async findByDomain(domain: string): Promise<Analyst[]> {
    return this.analystRepository.findByDomain(domain);
  }

  async findRunnerLevel(): Promise<Analyst[]> {
    return this.analystRepository.findRunnerLevel();
  }
}
