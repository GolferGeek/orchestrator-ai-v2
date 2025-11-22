import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryService, QueryResponse } from './query.service';
import { QueryCollectionDto } from './dto';

/**
 * Get organization slug from header
 */
function getOrgSlug(orgHeader?: string): string {
  if (!orgHeader) {
    throw new BadRequestException(
      'x-organization-slug header is required for RAG operations',
    );
  }
  return orgHeader;
}

@Controller('api/rag/collections/:collectionId/query')
@UseGuards(JwtAuthGuard)
export class QueryController {
  constructor(private queryService: QueryService) {}

  /**
   * Query a collection for relevant chunks
   * POST /api/rag/collections/:collectionId/query
   * Header: x-organization-slug (required)
   */
  @Post()
  async queryCollection(
    @Param('collectionId') collectionId: string,
    @Body() dto: QueryCollectionDto,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<QueryResponse> {
    return this.queryService.queryCollection(
      collectionId,
      getOrgSlug(orgSlug),
      dto,
    );
  }
}
