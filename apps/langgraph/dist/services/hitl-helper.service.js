"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var HITLHelperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HITLHelperService = void 0;
const common_1 = require("@nestjs/common");
const observability_service_1 = require("./observability.service");
let HITLHelperService = HITLHelperService_1 = class HITLHelperService {
    constructor(observability) {
        this.observability = observability;
        this.logger = new common_1.Logger(HITLHelperService_1.name);
    }
    async prepareInterrupt(currentState, request) {
        this.logger.log(`Preparing HITL interrupt for task ${request.taskId}, thread ${request.threadId}`);
        await this.observability.emitHitlWaiting({
            taskId: request.taskId,
            threadId: request.threadId,
            agentSlug: request.agentSlug,
            userId: request.userId,
            conversationId: request.conversationId,
            organizationSlug: request.organizationSlug,
            message: request.message || `Awaiting review for ${request.contentType}`,
            pendingContent: request.pendingContent,
        });
        return {
            ...currentState,
            hitlRequest: request,
            hitlStatus: 'waiting',
        };
    }
    async processResume(currentState, response) {
        const request = currentState.hitlRequest;
        if (!request) {
            throw new Error('Cannot process resume without prior HITL request');
        }
        this.logger.log(`Processing HITL resume for task ${request.taskId}: ${response.decision}`);
        await this.observability.emitHitlResumed({
            taskId: request.taskId,
            threadId: request.threadId,
            agentSlug: request.agentSlug,
            userId: request.userId,
            conversationId: request.conversationId,
            organizationSlug: request.organizationSlug,
            decision: response.decision,
            message: response.feedback || `Decision: ${response.decision}`,
        });
        return {
            ...currentState,
            hitlResponse: response,
            hitlStatus: 'resumed',
        };
    }
    getResolvedContent(state) {
        if (!state.hitlResponse || !state.hitlRequest) {
            return null;
        }
        switch (state.hitlResponse.decision) {
            case 'approve':
                return state.hitlRequest.pendingContent;
            case 'edit':
                return state.hitlResponse.editedContent || null;
            case 'reject':
                return null;
            default:
                return null;
        }
    }
    wasRejected(state) {
        return state.hitlResponse?.decision === 'reject';
    }
    isWaiting(state) {
        return state.hitlStatus === 'waiting';
    }
    isResumed(state) {
        return state.hitlStatus === 'resumed';
    }
    clearHitlState(state) {
        return {
            ...state,
            hitlRequest: undefined,
            hitlResponse: undefined,
            hitlStatus: 'none',
        };
    }
    buildInterruptValue(request) {
        return {
            reason: 'human_review',
            taskId: request.taskId,
            threadId: request.threadId,
            agentSlug: request.agentSlug,
            userId: request.userId,
            conversationId: request.conversationId,
            contentType: request.contentType,
            pendingContent: request.pendingContent,
            message: request.message,
        };
    }
};
exports.HITLHelperService = HITLHelperService;
exports.HITLHelperService = HITLHelperService = HITLHelperService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [observability_service_1.ObservabilityService])
], HITLHelperService);
//# sourceMappingURL=hitl-helper.service.js.map