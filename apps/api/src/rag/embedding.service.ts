import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Embedding Service Interface
 *
 * Provides embedding generation for RAG documents and queries.
 * Default implementation uses Ollama for local, self-hosted embeddings.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(private configService: ConfigService) {
    this.ollamaUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434';
    this.model =
      this.configService.get<string>('EMBEDDING_MODEL') || 'nomic-embed-text';
    this.dimensions = parseInt(
      this.configService.get<string>('EMBEDDING_DIMENSIONS') || '768',
      10,
    );
  }

  /**
   * Get the embedding model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the embedding dimensions for the current model
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    const result = await this.embedWithTokenCount(text);
    return result.embedding;
  }

  /**
   * Generate embedding with token count
   */
  async embedWithTokenCount(text: string): Promise<EmbeddingResult> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as {
        embedding: number[];
        prompt_eval_count?: number;
      };

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      // Estimate token count (Ollama may provide this in some versions)
      const tokenCount =
        data.prompt_eval_count || this.estimateTokenCount(text);

      return {
        embedding: data.embedding,
        tokenCount,
      };
    } catch (error) {
      this.logger.error(
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Batch embed multiple texts
   * Note: Ollama processes one at a time, so we parallelize with Promise.all
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const batchSize = 10; // Process 10 at a time to avoid overwhelming Ollama
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.embedWithTokenCount(text)),
      );
      results.push(...batchResults);

      // Log progress for large batches
      if (texts.length > 20 && i > 0) {
        this.logger.debug(
          `Embedding progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`,
        );
      }
    }

    return results;
  }

  /**
   * Estimate token count (rough approximation)
   * This is used when Ollama doesn't return token counts
   */
  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async checkHealth(): Promise<{
    status: string;
    message: string;
    model: string;
  }> {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.ollamaUrl}/api/tags`);

      if (!response.ok) {
        return {
          status: 'error',
          message: `Ollama not available at ${this.ollamaUrl}`,
          model: this.model,
        };
      }

      const data = (await response.json()) as {
        models: Array<{ name: string }>;
      };

      // Check if the embedding model is available
      const modelAvailable = data.models?.some(
        (m) => m.name === this.model || m.name.startsWith(`${this.model}:`),
      );

      if (!modelAvailable) {
        return {
          status: 'warning',
          message: `Embedding model '${this.model}' not found. Run: ollama pull ${this.model}`,
          model: this.model,
        };
      }

      return {
        status: 'ok',
        message: 'Ollama and embedding model available',
        model: this.model,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Cannot connect to Ollama: ${error instanceof Error ? error.message : String(error)}`,
        model: this.model,
      };
    }
  }
}
