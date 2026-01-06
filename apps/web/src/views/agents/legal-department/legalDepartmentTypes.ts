/**
 * Legal Department AI Types
 *
 * Types for the legal document analysis system
 */

// =============================================================================
// Document Types
// =============================================================================

export type DocumentType = 'pdf' | 'docx' | 'image';

export interface UploadedDocument {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  uploadedAt: string;
  url?: string;
}

// =============================================================================
// Analysis Status Types
// =============================================================================

export type AnalysisPhase =
  | 'initializing'
  | 'uploading'
  | 'extracting'
  | 'analyzing'
  | 'identifying_risks'
  | 'generating_recommendations'
  | 'completed'
  | 'failed';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisProgress {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  currentStep?: string;
  error?: string;
}

// =============================================================================
// Analysis Results Types
// =============================================================================

export interface LegalFinding {
  id: string;
  type: 'clause' | 'obligation' | 'right' | 'term' | 'condition';
  category: string;
  summary: string;
  details: string;
  location: {
    page?: number;
    section?: string;
    paragraph?: string;
  };
  severity?: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface LegalRisk {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  impact: string;
  mitigation: string;
  relatedFindings: string[];
  confidence: number;
}

export interface LegalRecommendation {
  id: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  suggestedAction: string;
  relatedRisks: string[];
  estimatedEffort?: string;
}

export interface AnalysisResults {
  taskId: string;
  documentId: string;
  documentName: string;
  summary: string;
  findings: LegalFinding[];
  risks: LegalRisk[];
  recommendations: LegalRecommendation[];
  metadata: {
    analyzedAt: string;
    processingTime?: number;
    model?: string;
    confidence: number;
  };
}

// =============================================================================
// Request/Response DTOs
// =============================================================================

export interface CreateAnalysisRequest {
  documentId: string;
  documentName: string;
  documentType: DocumentType;
  analysisType?: 'contract' | 'compliance' | 'general';
  options?: {
    extractKeyTerms?: boolean;
    identifyRisks?: boolean;
    generateRecommendations?: boolean;
    compareWithTemplate?: boolean;
  };
}

export interface AnalysisTaskResponse {
  taskId: string;
  status: AnalysisStatus;
  phase?: AnalysisPhase;
  results?: AnalysisResults;
  error?: string;
  duration?: number;
}

// =============================================================================
// SSE Message Types
// =============================================================================

export type SSEMessageType =
  | 'phase_changed'
  | 'progress_updated'
  | 'finding_discovered'
  | 'risk_identified'
  | 'recommendation_generated'
  | 'error';

export interface SSEPhaseChangedMessage {
  type: 'phase_changed';
  taskId: string;
  phase: AnalysisPhase;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface SSEProgressUpdatedMessage {
  type: 'progress_updated';
  taskId: string;
  currentStep: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface SSEFindingDiscoveredMessage {
  type: 'finding_discovered';
  taskId: string;
  finding: LegalFinding;
}

export interface SSERiskIdentifiedMessage {
  type: 'risk_identified';
  taskId: string;
  risk: LegalRisk;
}

export interface SSERecommendationGeneratedMessage {
  type: 'recommendation_generated';
  taskId: string;
  recommendation: LegalRecommendation;
}

export interface SSEErrorMessage {
  type: 'error';
  taskId: string;
  message: string;
  recoverable: boolean;
}

export type SSEMessage =
  | SSEPhaseChangedMessage
  | SSEProgressUpdatedMessage
  | SSEFindingDiscoveredMessage
  | SSERiskIdentifiedMessage
  | SSERecommendationGeneratedMessage
  | SSEErrorMessage;

// =============================================================================
// UI State Types
// =============================================================================

export interface LegalDepartmentUIState {
  currentView: 'upload' | 'analysis' | 'results';
  selectedDocumentId?: string;
  showDetailedFindings: boolean;
  showRiskMatrix: boolean;
  filterSeverity?: 'low' | 'medium' | 'high' | 'critical';
}
