/**
 * Report Generator Service
 *
 * Manages PDF report generation, storage, and retrieval.
 * Actual PDF rendering is delegated to a separate process/worker.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

export interface ReportConfig {
  includeExecutiveSummary: boolean;
  includeHeatmap: boolean;
  includeSubjectDetails: boolean;
  includeCorrelations: boolean;
  includeTrends: boolean;
  includeDimensionAnalysis: boolean;
  dateRange?: { start: string; end: string };
  subjectFilter?: string[];
}

export interface Report {
  id: string;
  scope_id: string;
  title: string;
  report_type: string;
  config: ReportConfig;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  file_path: string | null;
  file_size: number | null;
  download_url: string | null;
  download_expires_at: string | null;
  error_message: string | null;
  generated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateReportInput {
  scopeId: string;
  title: string;
  reportType?: 'comprehensive' | 'executive' | 'detailed';
  config: Partial<ReportConfig>;
  createdBy?: string;
}

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly schema = 'risk';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Create a report request and start generation
   */
  async generateReport(input: GenerateReportInput): Promise<Report> {
    const {
      scopeId,
      title,
      reportType = 'comprehensive',
      config,
      createdBy,
    } = input;

    this.logger.log(`Creating report request: "${title}" for scope ${scopeId}`);

    // Merge with default config based on report type
    const fullConfig = this.buildConfig(reportType, config);

    // Create report record in pending state
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('reports')
      .insert({
        scope_id: scopeId,
        title,
        report_type: reportType,
        config: fullConfig,
        status: 'pending',
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create report: ${error.message}`);
      throw error;
    }

    const report = data as Report;

    // Start async report generation
    // In a production system, this would be dispatched to a worker queue
    this.startGeneration(report.id).catch((err) => {
      this.logger.error(`Report generation failed: ${err.message}`);
    });

    return report;
  }

  /**
   * Get report by ID
   */
  async getReport(id: string): Promise<Report | null> {
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to get report: ${error.message}`);
      throw error;
    }

    return data as Report | null;
  }

  /**
   * List reports for a scope
   */
  async listReports(
    scopeId: string,
    options?: { limit?: number; status?: string },
  ): Promise<Report[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from('reports')
      .select('*')
      .eq('scope_id', scopeId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list reports: ${error.message}`);
      throw error;
    }

    return (data || []) as Report[];
  }

  /**
   * Delete a report
   */
  async deleteReport(id: string): Promise<void> {
    // First get the report to check for file cleanup
    const report = await this.getReport(id);
    if (report?.file_path) {
      // TODO: Delete file from storage
      this.logger.debug(`Would delete file: ${report.file_path}`);
    }

    const { error } = await this.getClient()
      .schema(this.schema)
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh download URL for a report
   */
  async refreshDownloadUrl(id: string): Promise<string | null> {
    const report = await this.getReport(id);
    if (!report || report.status !== 'completed' || !report.file_path) {
      return null;
    }

    // Generate presigned URL
    // In production, this would use the actual storage service
    const downloadUrl = await this.generatePresignedUrl(report.file_path);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await this.getClient()
      .schema(this.schema)
      .from('reports')
      .update({
        download_url: downloadUrl,
        download_expires_at: expiresAt,
      })
      .eq('id', id);

    return downloadUrl;
  }

  /**
   * Build full config based on report type
   */
  private buildConfig(
    reportType: string,
    partialConfig: Partial<ReportConfig>,
  ): ReportConfig {
    const defaults: Record<string, ReportConfig> = {
      comprehensive: {
        includeExecutiveSummary: true,
        includeHeatmap: true,
        includeSubjectDetails: true,
        includeCorrelations: true,
        includeTrends: true,
        includeDimensionAnalysis: true,
      },
      executive: {
        includeExecutiveSummary: true,
        includeHeatmap: true,
        includeSubjectDetails: false,
        includeCorrelations: false,
        includeTrends: true,
        includeDimensionAnalysis: false,
      },
      detailed: {
        includeExecutiveSummary: false,
        includeHeatmap: true,
        includeSubjectDetails: true,
        includeCorrelations: true,
        includeTrends: true,
        includeDimensionAnalysis: true,
      },
    };

    const base: ReportConfig = (defaults[reportType] ?? defaults.comprehensive) as ReportConfig;

    // Create result with explicit type
    const result: ReportConfig = {
      includeExecutiveSummary: partialConfig.includeExecutiveSummary ?? base.includeExecutiveSummary,
      includeHeatmap: partialConfig.includeHeatmap ?? base.includeHeatmap,
      includeSubjectDetails: partialConfig.includeSubjectDetails ?? base.includeSubjectDetails,
      includeCorrelations: partialConfig.includeCorrelations ?? base.includeCorrelations,
      includeTrends: partialConfig.includeTrends ?? base.includeTrends,
      includeDimensionAnalysis: partialConfig.includeDimensionAnalysis ?? base.includeDimensionAnalysis,
      dateRange: partialConfig.dateRange ?? base.dateRange,
      subjectFilter: partialConfig.subjectFilter ?? base.subjectFilter,
    };

    return result;
  }

  /**
   * Start async report generation
   */
  private async startGeneration(reportId: string): Promise<void> {
    this.logger.log(`Starting report generation for ${reportId}`);

    try {
      // Update status to generating
      await this.updateStatus(reportId, 'generating');

      // Get report details
      const report = await this.getReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Gather data for the report
      const reportData = await this.gatherReportData(report);

      // Generate HTML content
      const htmlContent = this.generateHtmlContent(report, reportData);

      // In production, this would:
      // 1. Render HTML to PDF using Puppeteer
      // 2. Upload PDF to storage
      // 3. Generate presigned URL

      // For now, we'll simulate completion
      const filePath = `reports/${report.scope_id}/${reportId}.pdf`;
      const downloadUrl = await this.generatePresignedUrl(filePath);

      // Update report as completed
      await this.getClient()
        .schema(this.schema)
        .from('reports')
        .update({
          status: 'completed',
          file_path: filePath,
          file_size: htmlContent.length * 2, // Approximate
          download_url: downloadUrl,
          download_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          generated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      this.logger.log(`Report generation completed for ${reportId}`);
    } catch (error) {
      this.logger.error(
        `Report generation failed for ${reportId}: ${error instanceof Error ? error.message : String(error)}`,
      );

      await this.getClient()
        .schema(this.schema)
        .from('reports')
        .update({
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', reportId);
    }
  }

  /**
   * Update report status
   */
  private async updateStatus(
    reportId: string,
    status: Report['status'],
  ): Promise<void> {
    await this.getClient()
      .schema(this.schema)
      .from('reports')
      .update({ status })
      .eq('id', reportId);
  }

  /**
   * Gather all data needed for the report
   */
  private async gatherReportData(report: Report): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    // Get scope info
    const { data: scope } = await this.getClient()
      .schema(this.schema)
      .from('scopes')
      .select('*')
      .eq('id', report.scope_id)
      .single();
    data.scope = scope;

    // Get portfolio aggregate
    if (report.config.includeExecutiveSummary || report.config.includeTrends) {
      const { data: aggregate } = await this.getClient()
        .schema(this.schema)
        .from('portfolio_aggregate')
        .select('*')
        .eq('scope_id', report.scope_id)
        .single();
      data.portfolioAggregate = aggregate;
    }

    // Get heatmap data
    if (report.config.includeHeatmap) {
      const { data: heatmap } = await this.getClient()
        .schema(this.schema)
        .rpc('get_heatmap_data', {
          p_scope_id: report.scope_id,
          p_risk_level: null,
        });
      data.heatmap = heatmap;
    }

    // Get subject details
    if (report.config.includeSubjectDetails) {
      const { data: subjects } = await this.getClient()
        .schema(this.schema)
        .from('subjects')
        .select(`
          *,
          composite_scores(*)
        `)
        .eq('scope_id', report.scope_id)
        .eq('is_active', true);
      data.subjects = subjects;
    }

    // Get correlations
    if (report.config.includeCorrelations) {
      const { data: correlations } = await this.getClient()
        .schema(this.schema)
        .rpc('calculate_correlations', {
          p_scope_id: report.scope_id,
        });
      data.correlations = correlations;
    }

    // Get dimensions
    if (report.config.includeDimensionAnalysis) {
      const { data: dimensions } = await this.getClient()
        .schema(this.schema)
        .from('dimensions')
        .select('*')
        .eq('scope_id', report.scope_id)
        .order('display_order');
      data.dimensions = dimensions;

      const { data: contributions } = await this.getClient()
        .schema(this.schema)
        .from('dimension_contribution')
        .select('*')
        .eq('scope_id', report.scope_id);
      data.dimensionContributions = contributions;
    }

    return data;
  }

  /**
   * Generate HTML content for PDF rendering
   */
  private generateHtmlContent(
    report: Report,
    data: Record<string, unknown>,
  ): string {
    const scope = data.scope as any;
    const aggregate = data.portfolioAggregate as any;

    // Generate HTML report structure
    // In production, this would use a proper template engine
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${report.title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #1a1a2e; }
    h2 { color: #16213e; margin-top: 30px; }
    .header { border-bottom: 2px solid #0f3460; padding-bottom: 20px; margin-bottom: 30px; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #e94560; }
    .metric-label { font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .risk-critical { color: #dc2626; }
    .risk-high { color: #ea580c; }
    .risk-medium { color: #f59e0b; }
    .risk-low { color: #10b981; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <p>Scope: ${scope?.name || 'Unknown'} | Generated: ${new Date().toLocaleDateString()}</p>
  </div>

  ${report.config.includeExecutiveSummary ? `
  <h2>Executive Summary</h2>
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${((aggregate?.avg_score ?? 0) * 100).toFixed(1)}%</div>
      <div class="metric-label">Average Risk</div>
    </div>
    <div class="metric">
      <div class="metric-value">${aggregate?.subject_count ?? 0}</div>
      <div class="metric-label">Total Subjects</div>
    </div>
    <div class="metric">
      <div class="metric-value">${aggregate?.critical_count ?? 0}</div>
      <div class="metric-label">Critical Risk</div>
    </div>
    <div class="metric">
      <div class="metric-value">${aggregate?.high_count ?? 0}</div>
      <div class="metric-label">High Risk</div>
    </div>
  </div>
  ` : ''}

  ${report.config.includeHeatmap ? `
  <h2>Risk Heatmap</h2>
  <p>Visual risk matrix showing subjects × dimensions. (Chart would be rendered here)</p>
  ` : ''}

  ${report.config.includeSubjectDetails ? `
  <h2>Subject Details</h2>
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Overall Risk</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${(data.subjects as any[] || []).map((s: any) => `
        <tr>
          <td>${s.name}</td>
          <td>${((s.composite_scores?.[0]?.overall_score ?? 0) * 100).toFixed(1)}%</td>
          <td class="${this.getRiskClass(s.composite_scores?.[0]?.overall_score ?? 0)}">
            ${this.getRiskLevel(s.composite_scores?.[0]?.overall_score ?? 0)}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${report.config.includeCorrelations ? `
  <h2>Dimension Correlations</h2>
  <p>Correlation analysis would be displayed here.</p>
  ` : ''}

  ${report.config.includeDimensionAnalysis ? `
  <h2>Dimension Analysis</h2>
  <table>
    <thead>
      <tr>
        <th>Dimension</th>
        <th>Weight</th>
        <th>Avg Score</th>
        <th>Contribution</th>
      </tr>
    </thead>
    <tbody>
      ${(data.dimensionContributions as any[] || []).map((d: any) => `
        <tr>
          <td>${d.dimension_name}</td>
          <td>${((d.weight ?? 0) * 100).toFixed(0)}%</td>
          <td>${((d.avg_score ?? 0) * 100).toFixed(1)}%</td>
          <td>${((d.weighted_contribution ?? 0) * 100).toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    <p>Report generated by Risk Analysis Agent | ${new Date().toISOString()}</p>
    <p>Report ID: ${report.id}</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get risk level label
   */
  private getRiskLevel(score: number): string {
    if (score >= 0.7) return 'Critical';
    if (score >= 0.5) return 'High';
    if (score >= 0.3) return 'Medium';
    return 'Low';
  }

  /**
   * Get CSS class for risk level
   */
  private getRiskClass(score: number): string {
    if (score >= 0.7) return 'risk-critical';
    if (score >= 0.5) return 'risk-high';
    if (score >= 0.3) return 'risk-medium';
    return 'risk-low';
  }

  /**
   * Generate a presigned URL for file download
   */
  private async generatePresignedUrl(filePath: string): Promise<string> {
    // In production, this would use the actual storage service
    // For now, return a placeholder URL
    return `https://storage.example.com/${filePath}?token=presigned-${Date.now()}`;
  }
}
