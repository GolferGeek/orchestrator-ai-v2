import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Auth
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

// Database
import { RagDatabaseService } from './rag-database.service';

// Services
import { CollectionsService } from './collections.service';
import { DocumentsService } from './documents.service';
import { QueryService } from './query.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { DocumentProcessorService } from './document-processor.service';

// Extractors
import { PdfExtractorService } from './extractors/pdf-extractor.service';
import { DocxExtractorService } from './extractors/docx-extractor.service';
import { TextExtractorService } from './extractors/text-extractor.service';

// Controllers
import { CollectionsController } from './collections.controller';
import { DocumentsController } from './documents.controller';
import { QueryController } from './query.controller';

/**
 * RAG Module
 *
 * Provides Retrieval-Augmented Generation infrastructure:
 * - Collections: Knowledge base containers
 * - Documents: Source files (PDF, TXT, MD, DOCX)
 * - Chunks: Embedded document segments
 * - Query: Vector similarity search
 *
 * Uses separate database (rag_data) for vector storage.
 * All operations are organization-scoped for multi-tenant isolation.
 */
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SupabaseModule,
    MulterModule.register({
      storage: memoryStorage(), // Store files in memory for processing
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [CollectionsController, DocumentsController, QueryController],
  providers: [
    // Database
    RagDatabaseService,

    // Core Services
    CollectionsService,
    DocumentsService,
    QueryService,

    // Processing Pipeline
    ChunkingService,
    EmbeddingService,
    DocumentProcessorService,

    // Text Extractors
    PdfExtractorService,
    DocxExtractorService,
    TextExtractorService,
  ],
  exports: [
    RagDatabaseService,
    CollectionsService,
    DocumentsService,
    QueryService,
    EmbeddingService,
    // Extractors (used by DocumentProcessingService in Agent2Agent)
    PdfExtractorService,
  ],
})
export class RagModule {}
