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
var ObservabilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let ObservabilityService = ObservabilityService_1 = class ObservabilityService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(ObservabilityService_1.name);
        const apiPort = this.configService.get('API_PORT');
        if (!apiPort) {
            throw new Error('API_PORT environment variable is required. ' +
                'Please set API_PORT in your .env file (e.g., API_PORT=6100).');
        }
        const apiHost = this.configService.get('API_HOST') || 'localhost';
        this.apiBaseUrl = `http://${apiHost}:${apiPort}`;
    }
    async emit(event) {
        try {
            const url = `${this.apiBaseUrl}/webhooks/status`;
            const payload = {
                taskId: event.taskId,
                status: this.mapStatusToEventType(event.status),
                timestamp: new Date().toISOString(),
                conversationId: event.conversationId,
                userId: event.userId,
                agentSlug: event.agentSlug,
                organizationSlug: event.organizationSlug,
                message: event.message,
                step: event.step,
                percent: event.progress,
                data: {
                    hook_event_type: this.mapStatusToEventType(event.status),
                    source_app: 'langgraph',
                    session_id: event.conversationId || event.taskId,
                    threadId: event.threadId,
                    ...event.metadata,
                },
            };
            this.logger.debug(`Emitting observability event: ${event.status}`, {
                taskId: event.taskId,
                threadId: event.threadId,
                agentSlug: event.agentSlug,
            });
            await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                timeout: 2000,
                validateStatus: () => true,
            }));
        }
        catch (error) {
            this.logger.warn(`Failed to send observability event (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    mapStatusToEventType(status) {
        const statusMap = {
            started: 'langgraph.started',
            processing: 'langgraph.processing',
            hitl_waiting: 'langgraph.hitl_waiting',
            hitl_resumed: 'langgraph.hitl_resumed',
            completed: 'langgraph.completed',
            failed: 'langgraph.failed',
            tool_calling: 'langgraph.tool_calling',
            tool_completed: 'langgraph.tool_completed',
        };
        return statusMap[status] || `langgraph.${status}`;
    }
    async emitStarted(params) {
        await this.emit({
            ...params,
            status: 'started',
            message: params.message || 'Workflow started',
        });
    }
    async emitProgress(params) {
        await this.emit({
            ...params,
            status: 'processing',
        });
    }
    async emitHitlWaiting(params) {
        await this.emit({
            ...params,
            status: 'hitl_waiting',
            message: params.message || 'Awaiting human review',
            metadata: { pendingContent: params.pendingContent },
        });
    }
    async emitHitlResumed(params) {
        await this.emit({
            ...params,
            status: 'hitl_resumed',
            message: params.message || `Human review decision: ${params.decision}`,
            metadata: { decision: params.decision },
        });
    }
    async emitToolCalling(params) {
        await this.emit({
            ...params,
            status: 'tool_calling',
            message: `Calling tool: ${params.toolName}`,
            step: params.toolName,
            metadata: { toolName: params.toolName, toolInput: params.toolInput },
        });
    }
    async emitToolCompleted(params) {
        await this.emit({
            ...params,
            status: 'tool_completed',
            message: params.success
                ? `Tool completed: ${params.toolName}`
                : `Tool failed: ${params.toolName}`,
            step: params.toolName,
            metadata: {
                toolName: params.toolName,
                toolResult: params.toolResult,
                success: params.success,
                error: params.error,
            },
        });
    }
    async emitCompleted(params) {
        await this.emit({
            ...params,
            status: 'completed',
            message: 'Workflow completed successfully',
            metadata: { result: params.result, duration: params.duration },
        });
    }
    async emitFailed(params) {
        await this.emit({
            ...params,
            status: 'failed',
            message: `Workflow failed: ${params.error}`,
            metadata: { error: params.error, duration: params.duration },
        });
    }
};
exports.ObservabilityService = ObservabilityService;
exports.ObservabilityService = ObservabilityService = ObservabilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], ObservabilityService);
//# sourceMappingURL=observability.service.js.map