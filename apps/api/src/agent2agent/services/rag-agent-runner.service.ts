import { Injectable, Logger, Inject } from '@nestjs/common';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { LLMService } from '@llm/llm.service';
import { BaseAgentRunner } from './base-agent-runner.service';
import {
  buildResponseMetadata,
  callLLM,
  fetchConversationHistory,
  optimizeContext,
} from './base-agent-runner/shared.helpers';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import {
  ContextOptimizationService,
  ConversationMessage,
} from '../context-optimization/context-optimization.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { PlansService } from '../plans/services/plans.service';
import { StreamingService } from './streaming.service';
import { CollectionsService, RagCollection } from '@/rag/collections.service';
import { QueryService, SearchResult } from '@/rag/query.service';

/**
 * RAG Agent Configuration stored in agent metadata
 */
interface RagConfig {
  collection_slug: string;
  top_k?: number;
  similarity_threshold?: number;
  no_results_message?: string;
  no_access_message?: string;
}

/**
 * RAG Agent Runner
 *
 * Handles execution of RAG agents - agents that query a dedicated RAG collection
 * and use retrieved documents to augment LLM responses.
 *
 * Use cases:
 * - HR Agent → queries hr-policy collection
 * - Legal Agent → queries legal-docs collection
 * - Engineering Docs Agent → queries eng-wiki collection
 *
 * Configuration (in agent metadata.rag_config):
 * - collection_slug: The collection to query (required)
 * - top_k: Number of results to retrieve (default: 5)
 * - similarity_threshold: Minimum similarity score (default: 0.5)
 * - no_results_message: Custom message when no results found
 * - no_access_message: Custom message when user lacks collection access
 *
 * Access Control:
 * - Agent visibility: Standard org-based visibility
 * - Collection access: Handled by existing RAG access control
 *   (required_role, allowed_users, created_by)
 *
 * @example
 * ```typescript
 * // Agent definition in database
 * {
 *   slug: 'hr-agent',
 *   name: 'HR Policy Assistant',
 *   agent_type: 'rag-runner',
 *   metadata: {
 *     rag_config: {
 *       collection_slug: 'hr-policy',
 *       top_k: 5,
 *       similarity_threshold: 0.6
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class RagAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(RagAgentRunnerService.name);

  constructor(
    contextOptimization: ContextOptimizationService,
    llmService: LLMService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
    @Inject(CollectionsService)
    private readonly collectionsService: CollectionsService,
    @Inject(QueryService)
    private readonly queryService: QueryService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
    );
  }

  /**
   * BUILD mode - Query RAG collection and generate response with LLM
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const userId = this.resolveUserId(request);
      if (!userId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'User identity is required for RAG agent execution',
        );
      }

      // Use ExecutionContext from request - it flows through unchanged
      const context = request.context;
      if (!context.conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Conversation context is required for RAG agent execution',
        );
      }

      // Get RAG configuration from agent metadata
      const ragConfig = this.extractRagConfig(definition);
      if (!ragConfig) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'RAG agent missing rag_config in metadata',
        );
      }

      // Emit progress: Starting using ExecutionContext
      this.streamingService.emitProgress(
        context,
        'Starting RAG query...',
        request.userMessage || '',
        {
          step: 'Initializing',
          progress: 5,
          status: 'running',
          sequence: 1,
          totalSteps: 5,
        },
      );

      // Resolve organization slug
      const resolvedOrgSlug = this.resolveOrganizationSlug(
        definition,
        organizationSlug,
      );

      // Get collection by slug
      const collection = await this.getCollectionBySlug(
        ragConfig.collection_slug,
        resolvedOrgSlug,
        userId,
      );

      if (!collection) {
        const noAccessMessage =
          ragConfig.no_access_message ||
          "I don't have access to the information needed to answer that question.";
        // Return conversational response - base runner will add humanResponse
        return TaskResponseDto.success(AgentTaskMode.BUILD, {
          content: {
            message: noAccessMessage,
            hasAccess: false,
            isConversational: true,
          },
          metadata: {
            agentSlug: definition.slug,
            collectionSlug: ragConfig.collection_slug,
            accessDenied: true,
          },
        });
      }

      // Emit progress: Querying collection
      this.streamingService.emitProgress(
        context,
        `Searching ${collection.name}...`,
        request.userMessage || '',
        {
          step: 'Querying RAG collection',
          progress: 20,
          status: 'running',
          sequence: 2,
          totalSteps: 5,
        },
      );

      // Get user message for query
      const userMessage = this.resolveUserMessage(request);
      if (!userMessage || userMessage.trim().length === 0) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'User message is required for RAG query',
        );
      }

      // Query the collection
      const queryResponse = await this.queryService.queryCollection(
        collection.id,
        resolvedOrgSlug,
        {
          query: userMessage,
          topK: ragConfig.top_k ?? 5,
          similarityThreshold: ragConfig.similarity_threshold ?? 0.5,
          strategy: 'basic',
          includeMetadata: true,
        },
      );

      // Handle no results
      if (queryResponse.results.length === 0) {
        const noResultsMessage =
          ragConfig.no_results_message ||
          "I don't have enough information in my knowledge base to answer that question.";
        // Return conversational response - base runner will add humanResponse
        return TaskResponseDto.success(AgentTaskMode.BUILD, {
          content: {
            message: noResultsMessage,
            hasResults: false,
            searchDurationMs: queryResponse.searchDurationMs,
            isConversational: true,
          },
          metadata: {
            agentSlug: definition.slug,
            collectionSlug: ragConfig.collection_slug,
            collectionName: collection.name,
            noResults: true,
          },
        });
      }

      // Emit progress: Building context
      this.streamingService.emitProgress(
        context,
        `Found ${queryResponse.results.length} relevant documents...`,
        request.userMessage || '',
        {
          step: 'Building context',
          progress: 40,
          status: 'running',
          sequence: 3,
          totalSteps: 5,
        },
      );

      // Build augmented prompt with RAG results
      const conversationHistory = await fetchConversationHistory(
        this.conversationsService,
        request,
      );
      const optimizedHistory = await optimizeContext(
        this.contextOptimization,
        conversationHistory,
        definition,
      );

      const systemPrompt = this.buildRagPrompt(
        definition,
        collection,
        queryResponse.results,
        optimizedHistory,
      );

      // Emit progress: Calling LLM
      this.streamingService.emitProgress(
        context,
        'Generating response...',
        request.userMessage || '',
        {
          step: 'Calling LLM',
          progress: 60,
          status: 'running',
          sequence: 4,
          totalSteps: 5,
        },
      );

      // Call LLM with augmented context
      const llmConfig = this.buildLlmConfig(
        definition,
        context.conversationId,
        userId,
        resolvedOrgSlug,
        request,
      );

      const llmResponse = await callLLM(
        this.llmService,
        llmConfig,
        systemPrompt,
        userMessage,
        optimizedHistory,
      );

      const content = this.normalizeContent(llmResponse.content);
      const llmMetadata =
        (llmResponse.metadata as unknown as Record<string, unknown>) ?? null;

      // Emit progress: Complete
      this.streamingService.emitProgress(
        context,
        'Response generated',
        request.userMessage || '',
        {
          step: 'Complete',
          progress: 100,
          status: 'completed',
          sequence: 5,
          totalSteps: 5,
        },
      );

      // Build response metadata
      const usage = this.normalizeUsage(llmMetadata?.usage);
      const provider = this.resolveProvider(llmMetadata, definition);
      const model = this.resolveModel(llmMetadata, definition);

      const metadata = buildResponseMetadata(
        {
          provider,
          model,
          usage,
          thinking: llmMetadata?.thinking,
        },
        {
          agentSlug: definition.slug,
          collectionSlug: ragConfig.collection_slug,
          collectionName: collection.name,
          resultsCount: queryResponse.results.length,
          searchDurationMs: queryResponse.searchDurationMs,
          topK: ragConfig.top_k ?? 5,
          similarityThreshold: ragConfig.similarity_threshold ?? 0.5,
        },
      );

      // Use request.context directly - full ExecutionContext from transport-types
      const executionContext = request.context;

      const deliverableResult = await this.deliverablesService.executeAction(
        'create',
        {
          title: this.resolveDeliverableTitle(userMessage, definition),
          content: content,
          format: 'markdown',
          type: 'rag-response',
          agentName: definition.name ?? definition.slug,
          taskId: context.taskId,
          metadata: {
            sources: this.formatSources(queryResponse.results),
            collectionSlug: ragConfig.collection_slug,
            collectionName: collection.name,
            resultsCount: queryResponse.results.length,
            searchDurationMs: queryResponse.searchDurationMs,
            topK: ragConfig.top_k ?? 5,
            similarityThreshold: ragConfig.similarity_threshold ?? 0.5,
            llm: {
              provider,
              model,
              usage,
            },
          },
        },
        executionContext,
      );

      if (!deliverableResult.success || !deliverableResult.data) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          deliverableResult.error?.message ?? 'Failed to create deliverable',
        );
      }

      const resultData = deliverableResult.data as {
        deliverable: unknown;
        version: unknown;
        isNew: boolean;
      };

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          deliverable: resultData.deliverable,
          version: resultData.version,
          isNew: resultData.isNew,
          sources: this.formatSources(queryResponse.results),
        },
        metadata,
      });
    } catch (error) {
      this.logger.error(
        `RAG agent ${definition.slug} BUILD failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Extract RAG configuration from agent metadata
   * RAG config is stored in metadata.raw.rag_config (raw is the original JSONB)
   */
  private extractRagConfig(
    definition: AgentRuntimeDefinition,
  ): RagConfig | null {
    // The raw metadata JSONB is in definition.metadata.raw
    const rawMetadata = definition.metadata?.raw as
      | Record<string, unknown>
      | undefined;
    const ragConfig = rawMetadata?.rag_config as RagConfig | undefined;

    if (!ragConfig?.collection_slug) {
      this.logger.error(
        `RAG agent ${definition.slug} missing rag_config.collection_slug in metadata.raw`,
      );
      return null;
    }

    return ragConfig;
  }

  /**
   * Get collection by slug, checking user access
   */
  private async getCollectionBySlug(
    collectionSlug: string,
    organizationSlug: string,
    userId: string,
  ): Promise<RagCollection | null> {
    try {
      // Get all collections user can access
      const collections = await this.collectionsService.getCollections(
        organizationSlug,
        userId,
      );

      // Find the one matching our slug
      const collection = collections.find((c) => c.slug === collectionSlug);

      if (!collection) {
        this.logger.warn(
          `Collection ${collectionSlug} not found or user ${userId} lacks access`,
        );
        return null;
      }

      return collection;
    } catch (error) {
      this.logger.error(
        `Failed to get collection ${collectionSlug}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Build RAG-augmented system prompt
   */
  private buildRagPrompt(
    definition: AgentRuntimeDefinition,
    collection: RagCollection,
    results: SearchResult[],
    conversationHistory: ConversationMessage[],
  ): string {
    const sections: string[] = [];

    // Base system prompt from agent definition
    const basePrompt =
      definition.prompts?.build ||
      definition.prompts?.system ||
      definition.llm?.systemPrompt ||
      `You are ${definition.name ?? definition.slug}, a knowledgeable assistant that answers questions using the provided knowledge base.`;

    sections.push(basePrompt.trim());

    // Knowledge base context
    sections.push(`## Knowledge Base: ${collection.name}`);
    if (collection.description) {
      sections.push(collection.description);
    }

    // Retrieved documents
    sections.push('## Retrieved Context');
    sections.push(
      "The following excerpts from the knowledge base are relevant to the user's question:",
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;

      const source = result.documentFilename || 'Unknown source';
      const score = (result.score * 100).toFixed(1);

      sections.push(`### Source ${i + 1}: ${source} (${score}% relevant)`);
      sections.push(result.content);
    }

    // Recent conversation context
    if (conversationHistory.length > 0) {
      const recentMessages = conversationHistory
        .slice(-5)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');
      sections.push(`## Recent Conversation\n${recentMessages}`);
    }

    // Instructions
    sections.push(`## Instructions
- Answer the user's question using ONLY the information from the Retrieved Context above
- If the context doesn't contain enough information, say so clearly
- Cite your sources when possible (e.g., "According to [document name]...")
- Be concise and direct
- Do not make up information not found in the context`);

    return sections.join('\n\n');
  }

  /**
   * Format search results as sources for response
   */
  private formatSources(
    results: SearchResult[],
  ): Array<{ document: string; score: number; excerpt: string }> {
    return results.map((result) => ({
      document: result.documentFilename,
      score: parseFloat((result.score * 100).toFixed(1)),
      excerpt:
        result.content.length > 200
          ? result.content.substring(0, 200) + '...'
          : result.content,
    }));
  }

  /**
   * Resolve organization slug from definition
   */
  private resolveOrganizationSlug(
    definition: AgentRuntimeDefinition,
    organizationSlug: string | null,
  ): string {
    const orgSlugs = definition.organizationSlug;
    const firstOrgSlug =
      Array.isArray(orgSlugs) && orgSlugs.length > 0 ? orgSlugs[0] : null;
    return organizationSlug ?? firstOrgSlug ?? 'demo-org';
  }

  /**
   * Resolve user message from request
   */
  private resolveUserMessage(request: TaskRequestDto): string {
    if (
      typeof request.userMessage === 'string' &&
      request.userMessage.trim().length > 0
    ) {
      return request.userMessage.trim();
    }

    const payload = request.payload;
    const payloadMessage =
      payload?.userMessage ?? payload?.message ?? payload?.query;
    if (
      typeof payloadMessage === 'string' &&
      payloadMessage.trim().length > 0
    ) {
      return payloadMessage.trim();
    }

    return '';
  }

  /**
   * Build LLM configuration
   */
  private buildLlmConfig(
    definition: AgentRuntimeDefinition,
    conversationId: string,
    userId: string,
    orgSlug: string,
    request: TaskRequestDto,
  ): Record<string, unknown> {
    // Get provider/model from agent's llm config
    // Default to local Ollama gpt-oss:20b for sovereign/internal use
    const llmDef = definition.llm;
    const provider = llmDef?.provider ?? 'ollama';
    const model = llmDef?.model ?? 'gpt-oss:20b';

    return {
      provider,
      model,
      temperature: llmDef?.temperature ?? 0.3,
      maxTokens: llmDef?.maxTokens ?? 2000,
      conversationId,
      sessionId: request.context.taskId, // Use taskId for session correlation
      userId,
      organizationSlug: orgSlug,
      agentSlug: definition.slug,
      callerType: 'agent',
      callerName: `${definition.slug}-rag-build`,
      stream: false,
    };
  }

  /**
   * Normalize LLM response content
   */
  private normalizeContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (content === null || content === undefined) {
      return '';
    }
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return '[unserializable content]';
    }
  }

  /**
   * Normalize usage metadata
   */
  private normalizeUsage(raw: unknown): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  } {
    if (!raw || typeof raw !== 'object') {
      return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };
    }

    const value = raw as Record<string, unknown>;
    const inputTokens = this.numberOrZero(
      value.inputTokens ?? value.promptTokens ?? value.total_input_tokens,
    );
    const outputTokens = this.numberOrZero(
      value.outputTokens ?? value.completionTokens ?? value.total_output_tokens,
    );
    const totalTokens = this.numberOrZero(
      value.totalTokens ?? value.total_tokens,
      inputTokens + outputTokens,
    );
    const cost = this.numberOrZero(value.cost ?? value.price);

    return { inputTokens, outputTokens, totalTokens, cost };
  }

  /**
   * Resolve provider from metadata or definition
   */
  private resolveProvider(
    metadata: Record<string, unknown> | null,
    definition: AgentRuntimeDefinition,
  ): string {
    const fromMetadata = metadata?.provider;
    if (typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
      return fromMetadata;
    }
    const fromDefinition = definition.llm?.provider;
    if (
      typeof fromDefinition === 'string' &&
      fromDefinition.trim().length > 0
    ) {
      return fromDefinition;
    }
    return '';
  }

  /**
   * Resolve model from metadata or definition
   */
  private resolveModel(
    metadata: Record<string, unknown> | null,
    definition: AgentRuntimeDefinition,
  ): string {
    const fromMetadata = metadata?.model;
    if (typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
      return fromMetadata;
    }
    const fromDefinition = definition.llm?.model;
    if (
      typeof fromDefinition === 'string' &&
      fromDefinition.trim().length > 0
    ) {
      return fromDefinition;
    }
    return '';
  }

  /**
   * Convert value to number or return fallback
   */
  private numberOrZero(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  /**
   * Generate a title for the deliverable based on the user's query
   */
  private resolveDeliverableTitle(
    userMessage: string,
    definition: AgentRuntimeDefinition,
  ): string {
    // Truncate long queries and create a reasonable title
    const maxLength = 60;
    const truncated =
      userMessage.length > maxLength
        ? userMessage.substring(0, maxLength) + '...'
        : userMessage;

    const agentName = definition.name ?? definition.slug;
    return `${agentName}: ${truncated}`;
  }
}
