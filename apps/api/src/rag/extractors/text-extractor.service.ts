import { Injectable, Logger } from '@nestjs/common';

export interface TextExtractionResult {
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * Plain Text Extraction Service
 *
 * Handles .txt and .md files by converting buffer to string.
 */
@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  /**
   * Extract text from a text/markdown buffer
   */
  extract(buffer: Buffer): TextExtractionResult {
    try {
      // Detect encoding (default to UTF-8)
      const text = buffer.toString('utf-8').trim();

      // Remove BOM if present
      const cleanText = text.replace(/^\uFEFF/, '');

      this.logger.debug(
        `Extracted ${cleanText.length} characters from text file`,
      );

      return {
        text: cleanText,
        metadata: {},
      };
    } catch (error) {
      this.logger.error(
        `Text extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract text as string
   */
  extractText(buffer: Buffer): string {
    const result = this.extract(buffer);
    return result.text;
  }
}
