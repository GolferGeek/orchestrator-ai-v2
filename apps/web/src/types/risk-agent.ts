/**
 * Risk Agent UI Types
 *
 * Frontend types for the Investment Risk Agent dashboard.
 * Corresponds to the backend risk runner types.
 */

// =============================================================================
// SCOPE TYPES
// =============================================================================

/**
 * LLM configuration for risk analysis
 */
export interface RiskLlmConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Threshold configuration for alerts and debates
 */
export interface RiskThresholdConfig {
  alertThreshold: number;
  debateThreshold: number;
  staleDays: number;
}

/**
 * Analysis features configuration
 */
export interface RiskAnalysisConfig {
  riskRadar?: {
    enabled: boolean;
    parallelDimensions?: boolean;
  };
  debate?: {
    enabled: boolean;
    autoTrigger?: boolean;
  };
  learning?: {
    enabled: boolean;
    autoApprove?: boolean;
  };
}

/**
 * A risk analysis scope (domain/configuration context)
 */
export interface RiskScope {
  id: string;
  organizationSlug: string;
  agentSlug: string;
  name: string;
  domain: string;
  description?: string;
  llmConfig?: RiskLlmConfig;
  thresholdConfig?: RiskThresholdConfig;
  analysisConfig?: RiskAnalysisConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SUBJECT TYPES
// =============================================================================

/**
 * Subject metadata
 */
export interface RiskSubjectMetadata {
  sector?: string;
  industry?: string;
  marketCap?: number;
  exchange?: string;
  currency?: string;
  [key: string]: unknown;
}

/**
 * A risk analysis subject (entity being analyzed)
 */
export interface RiskSubject {
  id: string;
  scopeId: string;
  identifier: string;
  name: string;
  subjectType: 'stock' | 'crypto' | 'portfolio' | 'fund' | 'bond' | 'custom';
  context?: string;
  metadata?: RiskSubjectMetadata;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// DIMENSION TYPES
// =============================================================================

/**
 * Output schema for dimension analysis
 */
export interface DimensionOutputSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * Example for dimension analysis prompt
 */
export interface DimensionExample {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * A risk dimension (factor to analyze)
 */
export interface RiskDimension {
  id: string;
  scopeId: string;
  slug: string;
  name: string;
  description?: string;
  weight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A dimension context (versioned analysis prompt)
 */
export interface RiskDimensionContext {
  id: string;
  dimensionId: string;
  version: number;
  analysisPrompt: string;
  outputSchema?: DimensionOutputSchema;
  examples?: DimensionExample[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// ASSESSMENT TYPES
// =============================================================================

/**
 * A signal detected during assessment
 */
export interface AssessmentSignal {
  type: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  source?: string;
}

/**
 * Raw LLM response from dimension analysis
 */
export interface AssessmentAnalystResponse {
  score: number;
  confidence: number;
  signals: AssessmentSignal[];
  reasoning: string;
  [key: string]: unknown;
}

/**
 * A single dimension assessment
 */
export interface RiskAssessment {
  id: string;
  subjectId: string;
  dimensionId: string;
  dimensionContextId: string;
  taskId: string;
  score: number;
  confidence: number;
  signals: AssessmentSignal[];
  analystResponse: AssessmentAnalystResponse;
  createdAt: string;
  // Joined fields for display
  dimensionSlug?: string;
  dimensionName?: string;
  dimensionWeight?: number;
}

// =============================================================================
// COMPOSITE SCORE TYPES
// =============================================================================

/**
 * Map of dimension scores
 */
export interface DimensionScoreMap {
  [dimensionSlug: string]: {
    score: number;
    confidence: number;
    weight: number;
    assessmentId: string;
  };
}

/**
 * A composite risk score (aggregated from dimensions)
 */
export interface RiskCompositeScore {
  id: string;
  subjectId: string;
  taskId: string;
  score: number;
  confidence: number;
  dimensionScores: DimensionScoreMap;
  debateAdjustment?: number;
  debateId?: string;
  isSuperseded: boolean;
  createdAt: string;
  // Joined fields for display
  subjectName?: string;
  subjectIdentifier?: string;
}

/**
 * Active composite score view (non-superseded)
 */
export interface ActiveCompositeScoreView extends RiskCompositeScore {
  subjectName: string;
  subjectIdentifier: string;
  subjectType: string;
  scopeName: string;
  ageHours: number;
}

// =============================================================================
// DEBATE TYPES
// =============================================================================

/**
 * Blue team (risk defense) assessment
 */
export interface BlueAssessment {
  arguments: string[];
  strengthScore: number;
  mitigatingFactors: string[];
}

/**
 * Red team (risk challenge) challenges
 */
export interface RedChallenges {
  challenges: string[];
  riskScore: number;
  hiddenRisks: string[];
}

/**
 * Arbiter synthesis of debate
 */
export interface ArbiterSynthesis {
  summary: string;
  scoreAdjustment: number;
  keyTakeaways: string[];
  recommendation: string;
}

/**
 * A risk debate (Red Team/Blue Team analysis)
 */
export interface RiskDebate {
  id: string;
  subjectId: string;
  compositeScoreId: string;
  taskId: string;
  blueAssessment: BlueAssessment;
  redChallenges: RedChallenges;
  arbiterSynthesis: ArbiterSynthesis;
  scoreAdjustment: number;
  createdAt: string;
}

/**
 * Debate context (role-specific prompts)
 */
export interface RiskDebateContext {
  id: string;
  scopeId: string;
  role: 'blue_team' | 'red_team' | 'arbiter';
  analysisPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// ALERT TYPES
// =============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert details
 */
export interface AlertDetails {
  triggerScore?: number;
  threshold?: number;
  previousScore?: number;
  changePercent?: number;
  dimensions?: string[];
  [key: string]: unknown;
}

/**
 * A risk alert
 */
export interface RiskAlert {
  id: string;
  subjectId: string;
  compositeScoreId: string;
  severity: AlertSeverity;
  message: string;
  details?: AlertDetails;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
  // Joined fields
  subjectName?: string;
  subjectIdentifier?: string;
}

/**
 * Unacknowledged alert view
 */
export interface UnacknowledgedAlertView extends RiskAlert {
  subjectName: string;
  subjectIdentifier: string;
  scopeName: string;
}

// =============================================================================
// LEARNING TYPES
// =============================================================================

/**
 * Learning configuration
 */
export interface LearningConfig {
  autoPromote?: boolean;
  minReviewCount?: number;
  minAccuracyImprovement?: number;
}

/**
 * A risk learning (improvement to dimension analysis)
 */
export interface RiskLearning {
  id: string;
  scopeId: string;
  dimensionId?: string;
  learningType: 'prompt_improvement' | 'weight_adjustment' | 'threshold_change' | 'new_signal';
  description: string;
  suggestedChange: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Learning queue item
 */
export interface RiskLearningQueueItem {
  id: string;
  learningId: string;
  priority: number;
  status: 'queued' | 'reviewing' | 'completed';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

/**
 * Pending learning view
 */
export interface PendingLearningView extends RiskLearning {
  dimensionSlug?: string;
  dimensionName?: string;
  scopeName: string;
  queuePriority?: number;
}

// =============================================================================
// EVALUATION TYPES
// =============================================================================

/**
 * Actual outcome data
 */
export interface ActualOutcome {
  timestamp: string;
  value: number | string;
  source?: string;
  notes?: string;
}

/**
 * Dimension accuracy metrics
 */
export interface DimensionAccuracy {
  dimensionSlug: string;
  predictedScore: number;
  actualImpact: number;
  accuracy: number;
}

/**
 * A risk evaluation (comparing prediction to outcome)
 */
export interface RiskEvaluation {
  id: string;
  subjectId: string;
  compositeScoreId: string;
  evaluationWindow: string;
  predictedScore: number;
  actualOutcome: ActualOutcome;
  accuracy: number;
  dimensionAccuracies: DimensionAccuracy[];
  notes?: string;
  createdAt: string;
}

// =============================================================================
// DASHBOARD STATE TYPES
// =============================================================================

/**
 * Dashboard view mode
 */
export type DashboardViewMode = 'radar' | 'list' | 'detail';

/**
 * Selected subject for detail view
 */
export interface SelectedSubjectState {
  subject: RiskSubject | null;
  compositeScore: RiskCompositeScore | null;
  assessments: RiskAssessment[];
  debate: RiskDebate | null;
  alerts: RiskAlert[];
  evaluations: RiskEvaluation[];
}

/**
 * Dashboard filter state
 */
export interface DashboardFilters {
  scopeId?: string;
  subjectType?: RiskSubject['subjectType'];
  minScore?: number;
  maxScore?: number;
  hasAlerts?: boolean;
  isStale?: boolean;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalSubjects: number;
  analyzedSubjects: number;
  averageScore: number;
  criticalAlerts: number;
  warningAlerts: number;
  pendingLearnings: number;
  staleAssessments: number;
}

/**
 * Complete dashboard state
 */
export interface RiskDashboardState {
  // Current scope
  currentScope: RiskScope | null;
  scopes: RiskScope[];

  // Subjects and scores
  subjects: RiskSubject[];
  compositeScores: ActiveCompositeScoreView[];

  // Selected item detail
  selectedSubject: SelectedSubjectState | null;

  // Dimensions for the current scope
  dimensions: RiskDimension[];

  // Alerts
  alerts: UnacknowledgedAlertView[];

  // Learnings
  pendingLearnings: PendingLearningView[];

  // UI state
  viewMode: DashboardViewMode;
  filters: DashboardFilters;
  stats: DashboardStats;

  // Loading states
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
}

// =============================================================================
// RADAR CHART TYPES
// =============================================================================

/**
 * Data point for radar chart
 */
export interface RadarChartDataPoint {
  dimension: string;
  score: number;
  confidence: number;
  weight: number;
}

/**
 * Radar chart configuration
 */
export interface RadarChartConfig {
  showLabels: boolean;
  showGrid: boolean;
  showConfidence: boolean;
  fillOpacity: number;
  strokeWidth: number;
  size: number;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Dashboard action request
 */
export interface DashboardActionRequest {
  action: string;
  params?: Record<string, unknown>;
  filters?: DashboardFilters;
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Dashboard action response
 */
export interface DashboardActionResponse<T = unknown> {
  success: boolean;
  content?: T;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp?: string;
  };
}

/**
 * Analyze subject request
 */
export interface AnalyzeSubjectRequest {
  subjectId: string;
  forceRefresh?: boolean;
  includeDebate?: boolean;
}

/**
 * Analyze subject response
 */
export interface AnalyzeSubjectResponse {
  compositeScore: RiskCompositeScore;
  assessments: RiskAssessment[];
  debate?: RiskDebate;
  alerts?: RiskAlert[];
}

/**
 * Create subject request
 */
export interface CreateSubjectRequest {
  scopeId: string;
  identifier: string;
  name: string;
  subjectType: RiskSubject['subjectType'];
  context?: string;
  metadata?: RiskSubjectMetadata;
}

/**
 * Update subject request
 */
export interface UpdateSubjectRequest {
  name?: string;
  context?: string;
  metadata?: RiskSubjectMetadata;
  isActive?: boolean;
}

/**
 * Acknowledge alert request
 */
export interface AcknowledgeAlertRequest {
  alertId: string;
  notes?: string;
}

/**
 * Review learning request
 */
export interface ReviewLearningRequest {
  learningId: string;
  action: 'approve' | 'reject';
  notes?: string;
}
