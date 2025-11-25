import { ObservabilityService } from './observability.service';
export type HitlDecision = 'approve' | 'edit' | 'reject';
export interface HitlRequest {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    pendingContent: unknown;
    contentType: string;
    message?: string;
}
export interface HitlResponse {
    decision: HitlDecision;
    editedContent?: unknown;
    feedback?: string;
}
export interface HitlState {
    hitlRequest?: HitlRequest;
    hitlResponse?: HitlResponse;
    hitlStatus?: 'none' | 'waiting' | 'resumed';
}
export declare class HITLHelperService {
    private readonly observability;
    private readonly logger;
    constructor(observability: ObservabilityService);
    prepareInterrupt<S extends HitlState>(currentState: S, request: HitlRequest): Promise<S>;
    processResume<S extends HitlState>(currentState: S, response: HitlResponse): Promise<S>;
    getResolvedContent<T>(state: HitlState): T | null;
    wasRejected(state: HitlState): boolean;
    isWaiting(state: HitlState): boolean;
    isResumed(state: HitlState): boolean;
    clearHitlState<S extends HitlState>(state: S): S;
    buildInterruptValue(request: HitlRequest): Record<string, unknown>;
}
