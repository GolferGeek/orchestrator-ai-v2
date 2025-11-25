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
var LLMUsageReporterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMUsageReporterService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let LLMUsageReporterService = LLMUsageReporterService_1 = class LLMUsageReporterService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(LLMUsageReporterService_1.name);
        const apiPort = this.configService.get('API_PORT');
        if (!apiPort) {
            throw new Error('API_PORT environment variable is required. ' +
                'Please set API_PORT in your .env file (e.g., API_PORT=6100).');
        }
        const apiHost = this.configService.get('API_HOST') || 'localhost';
        this.apiBaseUrl = `http://${apiHost}:${apiPort}`;
    }
    async reportUsage(usage) {
        try {
            const url = `${this.apiBaseUrl}/llm/usage`;
            const payload = {
                provider: usage.provider,
                model: usage.model,
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                userId: usage.userId,
                callerType: usage.callerType,
                callerName: usage.callerName,
                taskId: usage.taskId,
                threadId: usage.threadId,
                conversationId: usage.conversationId,
                latencyMs: usage.latencyMs,
                timestamp: new Date().toISOString(),
                metadata: usage.metadata,
            };
            this.logger.debug(`Reporting LLM usage: ${usage.provider}/${usage.model}`, {
                totalTokens: usage.totalTokens,
                callerName: usage.callerName,
            });
            await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                timeout: 2000,
                validateStatus: () => true,
            }));
        }
        catch (error) {
            this.logger.warn(`Failed to report LLM usage (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async reportOllamaUsage(params) {
        await this.reportUsage({
            provider: 'ollama',
            model: params.model,
            promptTokens: params.promptTokens,
            completionTokens: params.completionTokens,
            totalTokens: params.promptTokens + params.completionTokens,
            userId: params.userId,
            callerType: 'langgraph-tool',
            callerName: params.callerName,
            taskId: params.taskId,
            threadId: params.threadId,
            conversationId: params.conversationId,
            latencyMs: params.latencyMs,
        });
    }
    async reportSQLCoderUsage(params) {
        await this.reportOllamaUsage({
            model: 'sqlcoder',
            callerName: 'sql-query-tool',
            ...params,
        });
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
};
exports.LLMUsageReporterService = LLMUsageReporterService;
exports.LLMUsageReporterService = LLMUsageReporterService = LLMUsageReporterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], LLMUsageReporterService);
//# sourceMappingURL=llm-usage-reporter.service.js.map