import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpException,
  HttpCode,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RbacGuard } from '@/rbac/guards/rbac.guard';
import { RequirePermission } from '@/rbac/decorators/require-permission.decorator';
import { FinanceService } from './finance.service';
import {
  CreateUniverseDto,
  UpdateUniverseDto,
  CreateUniverseVersionDto,
} from './dto';

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
  };
}

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(private readonly financeService: FinanceService) {}

  // =============================================================================
  // UNIVERSES
  // =============================================================================

  @Get('universes')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'List all universes for org finance' })
  @ApiResponse({
    status: 200,
    description: 'List of universes',
  })
  async listUniverses() {
    return this.financeService.listUniverses();
  }

  @Post('universes')
  @RequirePermission('finance:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new universe' })
  @ApiResponse({
    status: 201,
    description: 'Universe created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Forbidden - not org finance' })
  async createUniverse(
    @Body() dto: CreateUniverseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.createUniverse({
      org_slug: 'finance', // Enforce org_slug = 'finance'
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      metadata: dto.metadata,
      created_by: req.user.id,
    });
  }

  @Get('universes/:id')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'Get a single universe by ID' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiResponse({
    status: 200,
    description: 'Universe details',
  })
  @ApiResponse({ status: 404, description: 'Universe not found' })
  async getUniverse(@Param('id') id: string) {
    const universe = await this.financeService.getUniverse(id);
    if (!universe) {
      throw new HttpException('Universe not found', HttpStatus.NOT_FOUND);
    }
    return universe;
  }

  @Patch('universes/:id')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'Update a universe' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiResponse({
    status: 200,
    description: 'Universe updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Universe not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async updateUniverse(
    @Param('id') id: string,
    @Body() dto: UpdateUniverseDto,
  ) {
    return this.financeService.updateUniverse(id, {
      name: dto.name,
      description: dto.description,
      metadata: dto.metadata,
    });
  }

  @Delete('universes/:id')
  @RequirePermission('finance:admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a universe' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiResponse({
    status: 204,
    description: 'Universe deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Universe not found' })
  async deleteUniverse(@Param('id') id: string): Promise<void> {
    await this.financeService.deleteUniverse(id);
  }

  // =============================================================================
  // UNIVERSE VERSIONS
  // =============================================================================

  @Post('universes/:id/versions')
  @RequirePermission('finance:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new universe version' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiResponse({
    status: 201,
    description: 'Universe version created successfully',
  })
  @ApiResponse({ status: 404, description: 'Universe not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createUniverseVersion(
    @Param('id') universeId: string,
    @Body() dto: CreateUniverseVersionDto,
  ) {
    return this.financeService.createUniverseVersion({
      universe_id: universeId,
      version: dto.version,
      is_active: dto.is_active,
      config_json: dto.config_json,
    });
  }

  @Patch('universes/:id/versions/:versionId/activate')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'Set active version for a universe' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiParam({ name: 'versionId', description: 'Universe Version ID' })
  @ApiResponse({
    status: 200,
    description: 'Active version set successfully',
  })
  @ApiResponse({ status: 404, description: 'Universe or version not found' })
  async setActiveVersion(
    @Param('id') universeId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.financeService.setActiveVersion(universeId, versionId);
  }

  // =============================================================================
  // RECOMMENDATIONS
  // =============================================================================

  @Get('universes/:id/recommendations')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'List recommendations for a universe' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiResponse({
    status: 200,
    description: 'List of recommendations',
  })
  @ApiResponse({ status: 404, description: 'Universe not found' })
  async listRecommendations(@Param('id') universeId: string) {
    return this.financeService.listRecommendations(universeId);
  }

  @Get('universes/:id/recommendations/:recId/outcome')
  @RequirePermission('finance:admin')
  @ApiOperation({ summary: 'Get recommendation outcome' })
  @ApiParam({ name: 'id', description: 'Universe ID' })
  @ApiParam({ name: 'recId', description: 'Recommendation ID' })
  @ApiResponse({
    status: 200,
    description: 'Recommendation outcome',
  })
  @ApiResponse({ status: 404, description: 'Universe or outcome not found' })
  async getRecommendationOutcome(
    @Param('id') universeId: string,
    @Param('recId') recommendationId: string,
  ) {
    const outcome = await this.financeService.getRecommendationOutcome(
      universeId,
      recommendationId,
    );
    if (!outcome) {
      throw new HttpException(
        'Recommendation outcome not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return outcome;
  }
}
