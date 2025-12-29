import { Injectable, Logger } from '@nestjs/common';
import {
  IPagedDocumentExtractor,
  ExtractionResult,
  PagedExtractionResult,
  PageContent,
  ExtractionMetadata,
} from '../interfaces/document-extractor.interface';

export interface PdfPage {
  content: string;
  pageNumber: number;
}

export interface PdfExtractionResult {
  pages: PdfPage[];
  metadata: {
    title?: string;
    author?: string;
    pageCount: number;
    creationDate?: string;
  };
}

/**
 * PDF Text Extraction Service
 *
 * Uses pdf-parse library to extract text from PDF documents.
 * Returns text organized by page for better chunk metadata.
 */
type PdfParseFunction = (
  buffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{
  text: string;
  numpages: number;
  info?: {
    Title?: string;
    Author?: string;
    CreationDate?: string;
  };
}>;

@Injectable()
export class PdfExtractorService implements IPagedDocumentExtractor {
  private readonly logger = new Logger(PdfExtractorService.name);
  private pdfParse: PdfParseFunction | null = null;

  constructor() {
    void this.initPdfParse();
  }

  private async initPdfParse() {
    try {
      // Dynamic import to handle optional dependency
      const module = await import('pdf-parse');
      this.pdfParse = (module.default || module) as unknown as PdfParseFunction;
    } catch {
      this.logger.warn(
        'pdf-parse not installed. PDF extraction disabled. Run: npm install pdf-parse',
      );
    }
  }

  /**
   * Check if PDF extraction is available
   */
  isAvailable(): boolean {
    return this.pdfParse !== null;
  }

  /**
   * Extract text from a PDF buffer (internal method)
   */
  private async extractPdf(buffer: Buffer): Promise<PdfExtractionResult> {
    if (!this.pdfParse) {
      throw new Error(
        'PDF extraction not available. Install pdf-parse: npm install pdf-parse',
      );
    }

    try {
      // Track pages during parsing
      const pages: PdfPage[] = [];
      let currentPage = 1;

      // Custom page render function to capture per-page content
      const customRender = async (pageData: {
        getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
      }) => {
        const textContent = await pageData.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(' ');

        pages.push({
          content: pageText.trim(),
          pageNumber: currentPage,
        });
        currentPage++;

        return pageText;
      };

      const result = await this.pdfParse(buffer, {
        pagerender: customRender,
      });

      // If custom render didn't work, fall back to full text
      if (pages.length === 0) {
        // Split by common page break patterns or treat as single page
        const pageTexts = result.text.split(/\f/); // Form feed character
        pages.push(
          ...pageTexts.map((text, idx) => ({
            content: text.trim(),
            pageNumber: idx + 1,
          })),
        );
      }

      // Filter out empty pages
      const nonEmptyPages = pages.filter((p) => p.content.length > 0);

      this.logger.debug(`Extracted ${nonEmptyPages.length} pages from PDF`);

      return {
        pages: nonEmptyPages,
        metadata: {
          title: result.info?.Title,
          author: result.info?.Author,
          pageCount: result.numpages,
          creationDate: result.info?.CreationDate,
        },
      };
    } catch (error) {
      this.logger.error(
        `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract text and metadata (IDocumentExtractor interface)
   */
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const pdfResult = await this.extractPdf(buffer);

    const metadata: ExtractionMetadata = {
      title: pdfResult.metadata.title,
      author: pdfResult.metadata.author,
      pageCount: pdfResult.metadata.pageCount,
      creationDate: pdfResult.metadata.creationDate,
    };

    return {
      text: pdfResult.pages.map((p) => p.content).join('\n\n'),
      metadata,
    };
  }

  /**
   * Extract text from PDF as a single string
   */
  async extractText(buffer: Buffer): Promise<string> {
    const result = await this.extractPdf(buffer);
    return result.pages.map((p) => p.content).join('\n\n');
  }

  /**
   * Extract pages organized by page number (IPagedDocumentExtractor interface)
   */
  async extractPages(buffer: Buffer): Promise<PagedExtractionResult> {
    const pdfResult = await this.extractPdf(buffer);

    const pages: PageContent[] = pdfResult.pages.map((page) => ({
      content: page.content,
      pageNumber: page.pageNumber,
    }));

    const metadata: ExtractionMetadata = {
      title: pdfResult.metadata.title,
      author: pdfResult.metadata.author,
      pageCount: pdfResult.metadata.pageCount,
      creationDate: pdfResult.metadata.creationDate,
    };

    return {
      text: pages.map((p) => p.content).join('\n\n'),
      metadata,
      pages,
    };
  }
}
