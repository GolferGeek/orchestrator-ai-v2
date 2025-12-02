import {
  Controller,
  Get,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlansService } from './services/plans.service';
import { PlanVersionsService } from './services/plan-versions.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly planVersionsService: PlanVersionsService,
  ) {}

  @Get('conversation/:conversationId')
  @ApiOperation({
    summary: 'Get plans by conversation ID',
    description:
      'Retrieves plan and all versions associated with a specific conversation',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Plan retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid conversation ID format',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req()
    req: {
      user?: { sub?: string; id?: string; userId?: string };
    },
  ): Promise<unknown> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Build ExecutionContext for plan operations
    // Note: planId will be set after we fetch the plan
    const context: ExecutionContext = {
      orgSlug: 'global', // TODO: Get from request or plan data if available
      userId,
      conversationId,
      taskId: NIL_UUID,
      planId: NIL_UUID, // Will be updated after finding the plan
      deliverableId: NIL_UUID,
      agentSlug: 'unknown', // TODO: Get from plan data if available
      agentType: 'context',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    const plan = await this.plansService.findByConversationId(context);

    if (!plan) {
      return null;
    }

    // Update context with the planId
    const planContext: ExecutionContext = {
      ...context,
      planId: plan.id,
    };

    // Get all versions for the plan using ExecutionContext
    const versions =
      await this.planVersionsService.getVersionHistory(planContext);

    return {
      ...plan,
      versions,
    };
  }
}
