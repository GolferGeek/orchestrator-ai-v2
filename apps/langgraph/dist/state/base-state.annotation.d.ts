import { z } from 'zod';
export declare const WorkflowInputSchema: z.ZodObject<{
    taskId: z.ZodString;
    userId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    organizationSlug: z.ZodOptional<z.ZodString>;
    userMessage: z.ZodString;
    agentSlug: z.ZodString;
    provider: z.ZodDefault<z.ZodString>;
    model: z.ZodDefault<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    provider?: string;
    model?: string;
    taskId?: string;
    conversationId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    agentSlug?: string;
    organizationSlug?: string;
    userMessage?: string;
}, {
    provider?: string;
    model?: string;
    taskId?: string;
    conversationId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    agentSlug?: string;
    organizationSlug?: string;
    userMessage?: string;
}>;
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export declare const HitlStateSchema: z.ZodObject<{
    hitlRequest: z.ZodOptional<z.ZodObject<{
        taskId: z.ZodString;
        threadId: z.ZodString;
        agentSlug: z.ZodString;
        userId: z.ZodString;
        conversationId: z.ZodOptional<z.ZodString>;
        organizationSlug: z.ZodOptional<z.ZodString>;
        pendingContent: z.ZodUnknown;
        contentType: z.ZodString;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    }, {
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    }>>;
    hitlResponse: z.ZodOptional<z.ZodObject<{
        decision: z.ZodEnum<["approve", "edit", "reject"]>;
        editedContent: z.ZodOptional<z.ZodUnknown>;
        feedback: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    }, {
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    }>>;
    hitlStatus: z.ZodDefault<z.ZodEnum<["none", "waiting", "resumed"]>>;
}, "strip", z.ZodTypeAny, {
    hitlRequest?: {
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    };
    hitlResponse?: {
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    };
    hitlStatus?: "none" | "waiting" | "resumed";
}, {
    hitlRequest?: {
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    };
    hitlResponse?: {
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    };
    hitlStatus?: "none" | "waiting" | "resumed";
}>;
export type HitlStateType = z.infer<typeof HitlStateSchema>;
export declare const WorkflowMetadataSchema: z.ZodObject<{
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
    currentStep: z.ZodOptional<z.ZodString>;
    stepCount: z.ZodDefault<z.ZodNumber>;
    errors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    startedAt?: number;
    completedAt?: number;
    currentStep?: string;
    stepCount?: number;
    errors?: string[];
}, {
    startedAt?: number;
    completedAt?: number;
    currentStep?: string;
    stepCount?: number;
    errors?: string[];
}>;
export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;
export declare const BaseStateAnnotation: import("@langchain/langgraph").AnnotationRoot<{
    taskId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    userId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    conversationId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    organizationSlug: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    agentSlug: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    provider: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    model: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    userMessage: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    result: import("@langchain/langgraph").BinaryOperatorAggregate<unknown, unknown>;
    error: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    hitlRequest: import("@langchain/langgraph").BinaryOperatorAggregate<{
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    }, {
        message?: string;
        taskId?: string;
        conversationId?: string;
        userId?: string;
        threadId?: string;
        agentSlug?: string;
        pendingContent?: unknown;
        contentType?: string;
        organizationSlug?: string;
    }>;
    hitlResponse: import("@langchain/langgraph").BinaryOperatorAggregate<{
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    }, {
        decision?: "approve" | "edit" | "reject";
        editedContent?: unknown;
        feedback?: string;
    }>;
    hitlStatus: import("@langchain/langgraph").BinaryOperatorAggregate<"none" | "waiting" | "resumed", "none" | "waiting" | "resumed">;
    metadata: import("@langchain/langgraph").BinaryOperatorAggregate<{
        startedAt?: number;
        completedAt?: number;
        currentStep?: string;
        stepCount?: number;
        errors?: string[];
    }, {
        startedAt?: number;
        completedAt?: number;
        currentStep?: string;
        stepCount?: number;
        errors?: string[];
    }>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage<import("@langchain/core/messages").MessageStructure, import("@langchain/core/messages").MessageType>[], import("@langchain/langgraph").Messages>;
}>;
export type BaseState = typeof BaseStateAnnotation.State;
export declare function validateWorkflowInput(input: unknown): WorkflowInput;
export declare function safeValidateWorkflowInput(input: unknown): {
    success: boolean;
    data?: WorkflowInput;
    error?: z.ZodError;
};
export declare function formatValidationErrors(error: z.ZodError): string;
