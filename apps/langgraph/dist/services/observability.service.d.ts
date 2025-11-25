import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export type LangGraphStatus = 'started' | 'processing' | 'hitl_waiting' | 'hitl_resumed' | 'completed' | 'failed' | 'tool_calling' | 'tool_completed';
export interface LangGraphObservabilityEvent {
    taskId: string;
    threadId: string;
    status: LangGraphStatus;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    message?: string;
    step?: string;
    progress?: number;
    metadata?: Record<string, unknown>;
}
export declare class ObservabilityService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly apiBaseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    emit(event: LangGraphObservabilityEvent): Promise<void>;
    private mapStatusToEventType;
    emitStarted(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        message?: string;
    }): Promise<void>;
    emitProgress(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        message: string;
        step?: string;
        progress?: number;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    emitHitlWaiting(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        message?: string;
        pendingContent?: unknown;
    }): Promise<void>;
    emitHitlResumed(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        decision: 'approve' | 'edit' | 'reject';
        message?: string;
    }): Promise<void>;
    emitToolCalling(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        toolName: string;
        toolInput?: unknown;
    }): Promise<void>;
    emitToolCompleted(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        toolName: string;
        toolResult?: unknown;
        success: boolean;
        error?: string;
    }): Promise<void>;
    emitCompleted(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        result?: unknown;
        duration?: number;
    }): Promise<void>;
    emitFailed(params: {
        taskId: string;
        threadId: string;
        agentSlug: string;
        userId: string;
        conversationId?: string;
        organizationSlug?: string;
        error: string;
        duration?: number;
    }): Promise<void>;
}
