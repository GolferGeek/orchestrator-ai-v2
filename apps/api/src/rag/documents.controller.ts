import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService, RagDocument, RagChunk } from './documents.service';
import { DocumentProcessorService } from './document-processor.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
  };
}

// 50MB max file size
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

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

@Controller('api/rag/collections/:collectionId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private documentProcessorService: DocumentProcessorService,
  ) {}

  /**
   * List documents in a collection
   * GET /api/rag/collections/:collectionId/documents
   * Header: x-organization-slug (required)
   */
  @Get()
  async listDocuments(
    @Param('collectionId') collectionId: string,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<RagDocument[]> {
    return this.documentsService.getDocuments(
      collectionId,
      getOrgSlug(orgSlug),
    );
  }

  /**
   * Upload a document
   * POST /api/rag/collections/:collectionId/documents
   * Header: x-organization-slug (required)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('collectionId') collectionId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({
            fileType: new RegExp(
              ALLOWED_MIME_TYPES.join('|').replace(/\//g, '\\/'),
            ),
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<{
    id: string;
    filename: string;
    status: string;
    message: string;
  }> {
    const organizationSlug = getOrgSlug(orgSlug);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Determine file type from extension
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const fileType = this.getFileType(ext || '');

    if (!fileType) {
      throw new BadRequestException(
        `Unsupported file type: ${ext}. Allowed: pdf, txt, md, docx`,
      );
    }

    // Create document record
    const document = await this.documentsService.createDocument(
      collectionId,
      organizationSlug,
      file.originalname,
      fileType,
      file.size,
      undefined, // fileHash - could compute SHA-256
      undefined, // storagePath - direct processing
      req.user.id,
    );

    // Queue document for processing (async - fire and forget)
    void this.documentProcessorService.processDocument(
      document.id,
      organizationSlug,
      collectionId,
      file.buffer,
      fileType,
    );

    return {
      id: document.id,
      filename: document.filename,
      status: 'pending',
      message: 'Document queued for processing',
    };
  }

  /**
   * Get a single document
   * GET /api/rag/collections/:collectionId/documents/:docId
   * Header: x-organization-slug (required)
   */
  @Get(':docId')
  async getDocument(
    @Param('collectionId') _collectionId: string,
    @Param('docId') docId: string,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<RagDocument> {
    return this.documentsService.getDocument(docId, getOrgSlug(orgSlug));
  }

  /**
   * Delete a document
   * DELETE /api/rag/collections/:collectionId/documents/:docId
   * Header: x-organization-slug (required)
   */
  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Param('collectionId') _collectionId: string,
    @Param('docId') docId: string,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<void> {
    await this.documentsService.deleteDocument(docId, getOrgSlug(orgSlug));
  }

  /**
   * Get chunks for a document
   * GET /api/rag/collections/:collectionId/documents/:docId/chunks
   * Header: x-organization-slug (required)
   */
  @Get(':docId/chunks')
  async getDocumentChunks(
    @Param('collectionId') _collectionId: string,
    @Param('docId') docId: string,
    @Headers('x-organization-slug') orgSlug?: string,
  ): Promise<RagChunk[]> {
    return this.documentsService.getDocumentChunks(docId, getOrgSlug(orgSlug));
  }

  /**
   * Map file extension to file type
   */
  private getFileType(ext: string): string | null {
    const typeMap: Record<string, string> = {
      pdf: 'pdf',
      txt: 'txt',
      md: 'md',
      markdown: 'md',
      docx: 'docx',
    };
    return typeMap[ext] || null;
  }
}
