import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export interface LLMUsageData {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    userId: string;
    callerType: 'langgraph-tool' | 'langgraph-workflow';
    callerName: string;
    taskId?: string;
    threadId?: string;
    conversationId?: string;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
}
export declare class LLMUsageReporterService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly apiBaseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    reportUsage(usage: LLMUsageData): Promise<void>;
    reportOllamaUsage(params: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        userId: string;
        callerName: string;
        taskId?: string;
        threadId?: string;
        conversationId?: string;
        latencyMs?: number;
    }): Promise<void>;
    reportSQLCoderUsage(params: {
        promptTokens: number;
        completionTokens: number;
        userId: string;
        taskId?: string;
        threadId?: string;
        conversationId?: string;
        latencyMs?: number;
    }): Promise<void>;
    estimateTokens(text: string): number;
}
