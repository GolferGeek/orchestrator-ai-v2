import { Injectable } from '@nestjs/common';
import type { LangGraphInterruptResponse } from '@orchestrator-ai/transport-types';

/**
 * Mock LangGraph Service for deterministic E2E tests
 * Simulates LangGraph responses without actual LLM calls
 */
@Injectable()
export class LangGraphMockService {
  private resumeCount = 0;

  /**
   * Mock initial task execution - returns HITL interrupt
   */
  mockInitialExecution(
    taskId: string,
    topic: string,
  ): LangGraphInterruptResponse {
    return {
      __interrupt__: [
        {
          value: {
            reason: 'human_review',
            nodeName: 'hitl_interrupt',
            topic,
            content: {
              blogPost: `# Mock Blog Post about ${topic}\n\nThis is generated content for testing.`,
              seoDescription: `Learn about ${topic} in this comprehensive guide.`,
              socialPosts: [`Check out our new post about ${topic}!`],
            },
            message: 'Please review the generated content',
          },
          resumable: true,
          ns: ['extended-post-writer'],
        },
      ],
      values: {
        taskId,
        topic,
        status: 'hitl_waiting',
      },
    };
  }

  /**
   * Mock resume with decision
   */
  mockResume(
    taskId: string,
    decision: string,
    feedback?: string,
  ): LangGraphInterruptResponse | { values: Record<string, unknown> } {
    this.resumeCount++;

    // For regenerate/reject, return another HITL interrupt
    if (decision === 'regenerate' || decision === 'reject') {
      return {
        __interrupt__: [
          {
            value: {
              reason: 'human_review',
              nodeName: 'hitl_interrupt',
              topic: 'Regenerated',
              content: {
                blogPost: `# Regenerated Blog Post (v${this.resumeCount})\n\nIncorporating feedback: ${feedback || 'N/A'}`,
                seoDescription: 'Regenerated SEO description.',
                socialPosts: ['Regenerated social post!'],
              },
              message: 'Please review the regenerated content',
            },
            resumable: true,
            ns: ['extended-post-writer'],
          },
        ],
        values: {
          taskId,
          status: 'hitl_waiting',
        },
      };
    }

    // For approve/skip/replace, return completion (no __interrupt__)
    return {
      values: {
        taskId,
        status: 'completed',
        completedAt: Date.now(),
      },
    };
  }

  /**
   * Reset mock state between tests
   */
  reset(): void {
    this.resumeCount = 0;
  }
}
