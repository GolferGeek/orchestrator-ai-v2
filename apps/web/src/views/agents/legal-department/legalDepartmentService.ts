/**
 * Legal Department Service
 *
 * Handles all async operations for the Legal Department AI feature:
 * - Document upload and management
 * - Starting legal document analysis through the A2A framework
 * - Fetching analysis status and results
 *
 * IMPORTANT: All executions go through the A2A tasks endpoint to ensure
 * proper conversation/task creation and LLM usage tracking.
 */

import { useExecutionContextStore } from '@/stores/executionContextStore';
import type {
  DocumentType,
  UploadedDocument,
  CreateAnalysisRequest,
  AnalysisTaskResponse,
  AnalysisResults,
} from './legalDepartmentTypes';

// API Base URL for main API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6100';

class LegalDepartmentService {
  /**
   * Upload a document for analysis
   *
   * This is a non-A2A endpoint for file upload.
   * Returns the document ID which is then used in the A2A analysis request.
   *
   * @param file - The file to upload
   * @param orgSlug - Organization slug
   * @returns UploadedDocument with ID
   */
  async uploadDocument(file: File, orgSlug: string): Promise<UploadedDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orgSlug', orgSlug);

    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/legal/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to upload document');
      }

      const result = await response.json();
      return result.data as UploadedDocument;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  }

  /**
   * Start a legal document analysis through the A2A framework
   *
   * This uses the same flow as normal conversations:
   * 1. ExecutionContext must be initialized (via createAnalysisConversation)
   * 2. Makes direct fetch POST to /api/v1/tasks (A2A endpoint)
   * 3. Backend creates task record, then hands to API runner which processes the analysis
   *
   * This ensures proper conversation/task creation and LLM usage tracking.
   *
   * @param request - Analysis request parameters
   * @returns AnalysisTaskResponse with taskId and initial status
   */
  async startAnalysis(request: CreateAnalysisRequest): Promise<AnalysisTaskResponse> {
    try {
      // Verify ExecutionContext is initialized
      const executionContextStore = useExecutionContextStore();
      if (!executionContextStore.isInitialized) {
        throw new Error('ExecutionContext not initialized. Create conversation first.');
      }

      // Generate a new taskId for this execution
      const taskId = executionContextStore.newTaskId();
      const ctx = executionContextStore.current;

      console.log('[LegalDepartment] Starting analysis via A2A framework', {
        conversationId: ctx.conversationId,
        taskId,
        agentSlug: ctx.agentSlug,
        documentId: request.documentId,
      });

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Build A2A request payload
      // The Legal Department agent supports 'build' mode for document analysis
      const a2aPayload = {
        context: ctx, // Full ExecutionContext capsule
        mode: 'build',
        payload: {
          action: 'create',
          data: {
            analysisType: 'legal-document-analysis',
            documentId: request.documentId,
            documentName: request.documentName,
            documentType: request.documentType,
            options: request.options || {
              extractKeyTerms: true,
              identifyRisks: true,
              generateRecommendations: true,
            },
          },
        },
        userMessage: `Analyze legal document: ${request.documentName}`,
      };

      // POST to A2A endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(a2aPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Analysis request failed');
      }

      const result = await response.json();
      console.log('[LegalDepartment] A2A execution result:', result);

      // Handle A2A result
      if (result.error) {
        throw new Error(result.error.message || 'Analysis execution failed');
      }

      // Extract analysis response from A2A result
      const taskResponse: AnalysisTaskResponse = {
        taskId,
        status: 'running',
      };

      // Handle deliverable response (BUILD mode returns deliverable)
      if (result.result?.payload?.content) {
        try {
          const content = result.result.payload.content;
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;

          // Extract analysis results
          if (parsed.results) {
            taskResponse.results = parsed.results as AnalysisResults;
          }

          // Update status based on response
          if (parsed.status === 'completed') {
            taskResponse.status = 'completed';
          } else if (parsed.status === 'failed') {
            taskResponse.status = 'failed';
            taskResponse.error = parsed.error;
          }
        } catch (parseError) {
          console.error('[LegalDepartment] Failed to parse analysis response:', parseError);
        }
      }

      // Update ExecutionContext if backend returned updated context
      if (result.result?.context) {
        executionContextStore.update(result.result.context);
      }

      return taskResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis execution failed';
      console.error('[LegalDepartment] Analysis failed:', error);
      throw new Error(message);
    }
  }

  /**
   * Get analysis status
   *
   * Polls for the current status of a running analysis.
   * This is a non-A2A endpoint for status checking.
   *
   * @param taskId - The task ID
   * @returns AnalysisTaskResponse with current status
   */
  async getAnalysisStatus(taskId: string): Promise<AnalysisTaskResponse> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/legal/analysis/${taskId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get analysis status');
      }

      const result = await response.json();
      return result.data as AnalysisTaskResponse;
    } catch (error) {
      console.error('Failed to get analysis status:', error);
      throw error;
    }
  }

  /**
   * Get analysis results
   *
   * Fetches the complete analysis results for a completed task.
   * This is a non-A2A endpoint for result retrieval.
   *
   * @param taskId - The task ID
   * @returns AnalysisResults
   */
  async getAnalysisResults(taskId: string): Promise<AnalysisResults> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/legal/analysis/${taskId}/results`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get analysis results');
      }

      const result = await response.json();
      return result.data as AnalysisResults;
    } catch (error) {
      console.error('Failed to get analysis results:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   *
   * Fetches document metadata for display.
   * This is a non-A2A endpoint for document retrieval.
   *
   * @param documentId - The document ID
   * @returns UploadedDocument
   */
  async getDocument(documentId: string): Promise<UploadedDocument> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/legal/documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get document');
      }

      const result = await response.json();
      return result.data as UploadedDocument;
    } catch (error) {
      console.error('Failed to get document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   *
   * Removes a document from storage.
   * This is a non-A2A endpoint for document deletion.
   *
   * @param documentId - The document ID
   */
  async deleteDocument(documentId: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/legal/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const legalDepartmentService = new LegalDepartmentService();
