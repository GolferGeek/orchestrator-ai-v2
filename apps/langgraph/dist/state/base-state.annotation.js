"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStateAnnotation = exports.WorkflowMetadataSchema = exports.HitlStateSchema = exports.WorkflowInputSchema = void 0;
exports.validateWorkflowInput = validateWorkflowInput;
exports.safeValidateWorkflowInput = safeValidateWorkflowInput;
exports.formatValidationErrors = formatValidationErrors;
const langgraph_1 = require("@langchain/langgraph");
const zod_1 = require("zod");
exports.WorkflowInputSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1, 'taskId is required'),
    userId: zod_1.z.string().min(1, 'userId is required'),
    conversationId: zod_1.z.string().optional(),
    organizationSlug: zod_1.z.string().optional(),
    userMessage: zod_1.z.string().min(1, 'userMessage is required'),
    agentSlug: zod_1.z.string().min(1, 'agentSlug is required'),
    provider: zod_1.z.string().default('anthropic'),
    model: zod_1.z.string().default('claude-sonnet-4-20250514'),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.HitlStateSchema = zod_1.z.object({
    hitlRequest: zod_1.z.object({
        taskId: zod_1.z.string(),
        threadId: zod_1.z.string(),
        agentSlug: zod_1.z.string(),
        userId: zod_1.z.string(),
        conversationId: zod_1.z.string().optional(),
        organizationSlug: zod_1.z.string().optional(),
        pendingContent: zod_1.z.unknown(),
        contentType: zod_1.z.string(),
        message: zod_1.z.string().optional(),
    }).optional(),
    hitlResponse: zod_1.z.object({
        decision: zod_1.z.enum(['approve', 'edit', 'reject']),
        editedContent: zod_1.z.unknown().optional(),
        feedback: zod_1.z.string().optional(),
    }).optional(),
    hitlStatus: zod_1.z.enum(['none', 'waiting', 'resumed']).default('none'),
});
exports.WorkflowMetadataSchema = zod_1.z.object({
    startedAt: zod_1.z.number().optional(),
    completedAt: zod_1.z.number().optional(),
    currentStep: zod_1.z.string().optional(),
    stepCount: zod_1.z.number().default(0),
    errors: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.BaseStateAnnotation = langgraph_1.Annotation.Root({
    ...langgraph_1.MessagesAnnotation.spec,
    taskId: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => '',
    }),
    threadId: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => '',
    }),
    userId: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => '',
    }),
    conversationId: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    organizationSlug: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    agentSlug: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => '',
    }),
    provider: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => 'anthropic',
    }),
    model: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => 'claude-sonnet-4-20250514',
    }),
    userMessage: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => '',
    }),
    result: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    error: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    hitlRequest: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    hitlResponse: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    hitlStatus: (0, langgraph_1.Annotation)({
        reducer: (_, next) => next,
        default: () => 'none',
    }),
    metadata: (0, langgraph_1.Annotation)({
        reducer: (prev, next) => ({ ...prev, ...next }),
        default: () => ({
            stepCount: 0,
            errors: [],
        }),
    }),
});
function validateWorkflowInput(input) {
    return exports.WorkflowInputSchema.parse(input);
}
function safeValidateWorkflowInput(input) {
    const result = exports.WorkflowInputSchema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
function formatValidationErrors(error) {
    return error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
}
//# sourceMappingURL=base-state.annotation.js.map