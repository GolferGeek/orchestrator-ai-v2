import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { randomUUID } from 'crypto';
import { VisionExtractionService } from './vision-extraction.service';
import { OCRExtractionService } from './ocr-extraction.service';

/**
 * Document metadata from file upload
 */
export interface DocumentMetadata {
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Base64-encoded file data */
  base64Data: string;
  /** Extraction method used (vision/ocr) */
  extractionMethod?: 'vision' | 'ocr';
  /** Extracted text content */
  extractedText?: string;
  /** Vision model used (if vision extraction) */
  visionModel?: string;
  /** OCR confidence score (if OCR extraction) */
  ocrConfidence?: number;
}

/**
 * Document processing result
 */
export interface ProcessedDocumentResult {
  /** Document ID (UUID) */
  documentId: string;
  /** Public URL to access the document */
  url: string;
  /** Storage path within bucket */
  storagePath: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Extracted text content (if applicable) */
  extractedText?: string;
  /** Extraction method used */
  extractionMethod?: 'vision' | 'ocr' | 'none';
}

/**
 * Document Processing Service
 *
 * Handles processing of document files for Legal Department AI:
 * 1. Accepts base64-encoded files from metadata
 * 2. Determines if document needs text extraction (images, scanned PDFs)
 * 3. Routes to VisionExtractionService or OCRExtractionService
 * 4. Uploads original file to legal-documents storage bucket
 * 5. Returns document metadata with extracted text
 *
 * Storage Structure:
 * ```
 * legal-documents/
 *   {orgSlug}/
 *     {conversationId}/
 *       {taskId}/
 *         {uuid}_{filename}
 * ```
 *
 * ExecutionContext Flow:
 * - Uses context.orgSlug for organization path
 * - Uses context.conversationId for conversation path
 * - Uses context.taskId for task path
 * - Uses context.userId for document ownership
 *
 * Text Extraction:
 * - Image files (PNG, JPG, JPEG, WEBP): Vision extraction (primary), OCR (fallback)
 * - Scanned PDFs: Vision extraction (primary), OCR (fallback)
 * - Native PDFs: pdf-parse (direct text extraction)
 * - Word docs (DOCX): mammoth (direct text extraction)
 * - Text files: Direct read
 *
 * @example
 * ```typescript
 * const result = await documentProcessing.processDocument(
 *   {
 *     filename: 'contract.pdf',
 *     mimeType: 'application/pdf',
 *     size: 12345,
 *     base64Data: 'data:application/pdf;base64,...'
 *   },
 *   executionContext
 * );
 * // result: { documentId: '...', url: 'https://...', extractedText: '...', ... }
 * ```
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);
  private readonly bucketName =
    process.env.LEGAL_DOCUMENTS_BUCKET || 'legal-documents';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly visionExtraction: VisionExtractionService,
    private readonly ocrExtraction: OCRExtractionService,
  ) {}

  /**
   * Process a document file from base64 metadata
   *
   * @param metadata - Document metadata with base64 data
   * @param context - ExecutionContext for ownership and path construction
   * @returns ProcessedDocumentResult with documentId, url, extractedText
   */
  async processDocument(
    metadata: DocumentMetadata,
    context: ExecutionContext,
  ): Promise<ProcessedDocumentResult> {
    this.logger.log(
      `📄 [DOC-PROCESSING] Processing document: ${metadata.filename} (${metadata.mimeType}, ${metadata.size} bytes)`,
    );

    // Decode base64 data to buffer
    const buffer = this.decodeBase64(metadata.base64Data);

    // Determine if text extraction is needed
    const needsExtraction = this.needsTextExtraction(metadata.mimeType);
    let extractedText: string | undefined;
    let extractionMethod: 'vision' | 'ocr' | 'none' = 'none';

    if (needsExtraction) {
      // Use vision extraction for images and scanned PDFs
      if (this.isImageFile(metadata.mimeType)) {
        this.logger.log(
          `📄 [DOC-PROCESSING] Image file detected, using vision extraction`,
        );
        try {
          const visionResult = await this.visionExtraction.extractText(
            buffer,
            metadata.mimeType,
            context,
          );
          extractedText = visionResult.text;
          extractionMethod = 'vision';
          this.logger.log(
            `📄 [DOC-PROCESSING] Vision extraction successful (${extractedText.length} chars)`,
          );
        } catch (error) {
          this.logger.warn(
            `📄 [DOC-PROCESSING] Vision extraction failed, falling back to OCR: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Fallback to OCR
          const ocrResult = await this.ocrExtraction.extractText(
            buffer,
            metadata.mimeType,
          );
          extractedText = ocrResult.text;
          extractionMethod = 'ocr';
          this.logger.log(
            `📄 [DOC-PROCESSING] OCR extraction successful (${extractedText.length} chars)`,
          );
        }
      } else if (metadata.mimeType === 'application/pdf') {
        // For PDFs, try vision first (handles scanned PDFs)
        this.logger.log(
          `📄 [DOC-PROCESSING] PDF file detected, attempting vision extraction`,
        );
        try {
          const visionResult = await this.visionExtraction.extractText(
            buffer,
            metadata.mimeType,
            context,
          );
          extractedText = visionResult.text;
          extractionMethod = 'vision';
          this.logger.log(
            `📄 [DOC-PROCESSING] Vision extraction successful (${extractedText.length} chars)`,
          );
        } catch (error) {
          this.logger.warn(
            `📄 [DOC-PROCESSING] Vision extraction failed for PDF, falling back to OCR: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Fallback to OCR
          const ocrResult = await this.ocrExtraction.extractText(
            buffer,
            metadata.mimeType,
          );
          extractedText = ocrResult.text;
          extractionMethod = 'ocr';
          this.logger.log(
            `📄 [DOC-PROCESSING] OCR extraction successful (${extractedText.length} chars)`,
          );
        }
      }
    }

    // Upload to storage
    const documentId = randomUUID();
    const storagePath = this.buildStoragePath(context, documentId, metadata.filename);

    const client = this.supabaseService.getServiceClient();

    this.logger.log(
      `📄 [DOC-PROCESSING] Uploading to storage: ${storagePath}`,
    );

    const { error: uploadError } = await client.storage
      .from(this.bucketName)
      .upload(storagePath, buffer, {
        contentType: metadata.mimeType,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(
        `📄 [DOC-PROCESSING] Upload failed: ${uploadError.message}`,
      );
      throw new Error(`Failed to upload document: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    this.logger.log(
      `📄 [DOC-PROCESSING] Document uploaded successfully: ${publicUrl}`,
    );

    return {
      documentId,
      url: publicUrl,
      storagePath,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.size,
      extractedText,
      extractionMethod,
    };
  }

  /**
   * Decode base64 data to buffer
   * Handles both data URLs (data:mime;base64,xxx) and raw base64
   */
  private decodeBase64(base64Data: string): Buffer {
    // Remove data URL prefix if present
    const base64 = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    return Buffer.from(base64, 'base64');
  }

  /**
   * Check if file type needs text extraction
   */
  private needsTextExtraction(mimeType: string): boolean {
    const extractionTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];

    return extractionTypes.includes(mimeType);
  }

  /**
   * Check if file is an image
   */
  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Build storage path from ExecutionContext
   * Structure: {orgSlug}/{conversationId}/{taskId}/{uuid}_{filename}
   */
  private buildStoragePath(
    context: ExecutionContext,
    documentId: string,
    filename: string,
  ): string {
    const orgSlug = context.orgSlug || 'global';
    const conversationId = context.conversationId || 'unknown';
    const taskId = context.taskId || 'unknown';

    // Sanitize filename (remove path traversal attempts)
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    return `${orgSlug}/${conversationId}/${taskId}/${documentId}_${sanitizedFilename}`;
  }
}
