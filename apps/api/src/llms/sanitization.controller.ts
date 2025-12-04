import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { PseudonymizationService } from './pseudonymization.service';

@Controller('llm/sanitization')
export class SanitizationController {
  private readonly logger = new Logger(SanitizationController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly pseudonymizationService: PseudonymizationService,
  ) {}

  /**
   * Basic stats endpoint consumed by the web admin dashboard
   */
  @Get('stats')
  async getStats() {
    try {
      const patternStats = await this.pseudonymizationService.getStats();
      const stats = patternStats.patternServiceStats as {
        totalPatterns: number;
        enabledPatterns: number;
        showstopperPatterns: number;
        flaggerPatterns: number;
        patternsLoaded: boolean;
        builtInPatterns?: number;
        customPatterns?: number;
      };

      const client = this.supabaseService.getServiceClient();
      const { count: dictCount } = await client
        .from('pseudonym_dictionaries')
        .select('id', { count: 'exact', head: true });

      return {
        sanitizationStats: {
          productionMode: patternStats.productionMode,
          pseudonymizationStats: {
            patternServiceStats: {
              totalPatterns: stats.totalPatterns || 0,
              builtInPatterns: stats.builtInPatterns || 0,
              customPatterns: stats.customPatterns || 0,
              enabledPatterns: stats.enabledPatterns || 0,
              lastRefresh: new Date().toISOString(),
            },
          },
          redactionStats: {
            totalPatterns: stats.totalPatterns || 0,
            customPatterns: stats.customPatterns || 0,
          },
          verboseLogging: false,
        },
        databaseStats: {
          totalOperations: 0,
          dictionaries: dictCount || 0,
        },
        cacheStats: {
          size: 0,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to get sanitization stats',
        error instanceof Error ? error : String(error),
      );
      // Provide minimal safe structure
      return {
        sanitizationStats: {
          productionMode: false,
          pseudonymizationStats: {
            patternServiceStats: {
              totalPatterns: 0,
              builtInPatterns: 0,
              customPatterns: 0,
              enabledPatterns: 0,
              lastRefresh: new Date().toISOString(),
            },
          },
          redactionStats: { totalPatterns: 0, customPatterns: 0 },
          verboseLogging: false,
        },
        databaseStats: { totalOperations: 0, dictionaries: 0 },
        cacheStats: { size: 0 },
      };
    }
  }

  /**
   * Return effective PII patterns (built-in + any custom)
   */
  @Get('pii/patterns')
  async getPIIPatterns() {
    const patterns = await this.pseudonymizationService.getPIIPatternsAsync();
    // Convert RegExp patterns to strings for JSON serialization
    const serializedPatterns = patterns.map(p => ({
      id: p.id || p.name, // Use ID if available, fallback to name
      name: p.name,
      pattern: p.pattern.source, // Convert RegExp to string
      dataType: p.dataType,
      description: p.description,
      priority: p.priority,
      enabled: p.enabled,
      severity: p.severity,
      category: p.category,
      isBuiltIn: p.category === 'pii_builtin',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    return { patterns: serializedPatterns };
  }

  /**
   * Create a new custom PII pattern
   */
  @Post('pii/patterns')
  async createPIIPattern(@Body() body: {
    name: string;
    pattern: string;
    regex?: string;
    dataType: string;
    description: string;
    priority?: number | string;
    category?: string;
    severity?: 'showstopper' | 'flagger';
    enabled?: boolean;
  }) {
    try {
      // Handle both 'pattern' and 'regex' field names from frontend
      const patternString = body.pattern || body.regex;
      if (!patternString) {
        return {
          success: false,
          error: 'Pattern or regex field is required',
        };
      }

      // Convert priority string to number if needed
      let priority: number | undefined;
      if (body.priority) {
        if (typeof body.priority === 'string') {
          const priorityMap: Record<string, number> = {
            'high': 10,
            'medium': 50,
            'low': 90,
          };
          priority = priorityMap[body.priority] || 50;
        } else {
          priority = body.priority;
        }
      }

      const pattern = {
        name: body.name,
        pattern: new RegExp(patternString, 'g'),
        dataType: body.dataType as any,
        description: body.description,
        priority,
        severity: body.severity,
      };

      await this.pseudonymizationService.addPIIPattern(pattern);

      // Return the created pattern
      const updatedPatterns = this.pseudonymizationService.getPIIPatterns();
      const createdPattern = updatedPatterns.find(p => p.name === body.name);

      return {
        success: true,
        pattern: createdPattern ? {
          id: body.name, // Use name as ID for now
          name: createdPattern.name,
          pattern: patternString,
          dataType: createdPattern.dataType,
          description: createdPattern.description,
          priority: createdPattern.priority,
          enabled: createdPattern.enabled,
          category: body.category,
          severity: createdPattern.severity,
        } : null,
      };
    } catch (error) {
      this.logger.error('Failed to create PII pattern', error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pattern',
      };
    }
  }

  /**
   * Update an existing PII pattern
   */
  @Put('pii/patterns/:id')
  async updatePIIPattern(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      pattern?: string;
      regex?: string;
      dataType?: string;
      description?: string;
      priority?: number | string;
      category?: string;
      severity?: 'showstopper' | 'flagger';
      enabled?: boolean;
    }
  ) {
    try {
      const updates: Record<string, unknown> = {};

      if (body.name !== undefined) {
        updates.name = body.name;
      }
      if (body.pattern || body.regex) {
        const patternString = body.pattern || body.regex;
        updates.pattern = new RegExp(patternString!, 'g');
      }
      if (body.dataType !== undefined) {
        updates.dataType = body.dataType;
      }
      if (body.description !== undefined) {
        updates.description = body.description;
      }
      if (body.priority !== undefined) {
        if (typeof body.priority === 'string') {
          const priorityMap: Record<string, number> = {
            'high': 10,
            'medium': 50,
            'low': 90,
          };
          updates.priority = priorityMap[body.priority] || 50;
        } else {
          updates.priority = body.priority;
        }
      }
      if (body.severity !== undefined) {
        updates.severity = body.severity;
      }
      if (body.category !== undefined) {
        updates.category = body.category;
      }

      await this.pseudonymizationService.updatePIIPattern(id, updates as any);

      // Return the updated pattern (reload from DB to ensure freshness)
      const updatedPatterns = await this.pseudonymizationService.getPIIPatternsAsync();
      const updatedPattern = updatedPatterns.find(p => p.id === id || p.name === id || p.name === body.name);

      return {
        success: true,
        pattern: updatedPattern ? {
          id: updatedPattern.id || updatedPattern.name,
          name: updatedPattern.name,
          pattern: updatedPattern.pattern.source,
          dataType: updatedPattern.dataType,
          description: updatedPattern.description,
          priority: updatedPattern.priority,
          enabled: updatedPattern.enabled,
          category: updatedPattern.category,
          severity: updatedPattern.severity,
          createdAt: updatedPattern.createdAt,
          updatedAt: updatedPattern.updatedAt,
        } : null,
      };
    } catch (error) {
      this.logger.error('Failed to update PII pattern', error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pattern',
      };
    }
  }

  /**
   * Delete a PII pattern
   */
  @Delete('pii/patterns/:id')
  async deletePIIPattern(@Param('id') id: string) {
    try {
      await this.pseudonymizationService.deletePIIPattern(id);

      return {
        success: true,
        message: `Pattern ${id} deleted successfully`,
      };
    } catch (error) {
      this.logger.error('Failed to delete PII pattern', error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pattern',
      };
    }
  }

  /**
   * Sanitize text (full sanitization with detection, redaction, and/or pseudonymization)
   */
  @Post('sanitize')
  async sanitizeText(@Body() body: {
    text: string;
    enableRedaction?: boolean;
    enablePseudonymization?: boolean;
    context?: string;
  }) {
    try {
      const startTime = Date.now();

      // Get PII pattern service to detect PII
      const piiPatternService = (this.pseudonymizationService as any).piiPatternService;
      const detectionResult = await piiPatternService.detectPII(body.text, {
        minConfidence: 0.8,
        maxMatches: 100,
      });

      // Also check dictionary for known values (names, usernames, etc.)
      const client = this.supabaseService.getServiceClient();
      const { data: dictionaryEntries } = await client
        .from('pseudonym_dictionaries')
        .select('original_value, pseudonym, data_type, category')
        .eq('is_active', true);

      if (dictionaryEntries && dictionaryEntries.length > 0) {
        for (const entry of dictionaryEntries) {
          if (entry.original_value && body.text.includes(entry.original_value)) {
            const startIndex = body.text.indexOf(entry.original_value);
            // Add dictionary match to detection results
            detectionResult.matches.push({
              value: entry.original_value,
              dataType: entry.data_type || 'custom',
              patternName: `${entry.category || 'Dictionary'} - ${entry.data_type || 'Custom'}`,
              startIndex,
              endIndex: startIndex + entry.original_value.length,
              confidence: 1.0,
              severity: 'flagger', // Dictionary items are flaggers, not showstoppers
            });
          }
        }
      }

      // Apply redaction if requested (simple replacement with [REDACTED])
      let sanitizedText = body.text;
      let redactionApplied = false;

      if (body.enableRedaction && detectionResult.matches.length > 0) {
        sanitizedText = body.text;
        // Sort matches by position in reverse to avoid index issues
        const sortedMatches = [...detectionResult.matches].sort((a, b) => b.startIndex - a.startIndex);

        for (const match of sortedMatches) {
          const replacement = `[${match.dataType.toUpperCase()}_REDACTED]`;
          sanitizedText =
            sanitizedText.substring(0, match.startIndex) +
            replacement +
            sanitizedText.substring(match.endIndex);
        }
        redactionApplied = true;
      }

      // Apply pseudonymization if requested (only if redaction wasn't applied - they're mutually exclusive)
      let pseudonymizationApplied = false;
      if (body.enablePseudonymization && !redactionApplied && detectionResult.matches.length > 0) {
        const pseudonymResult = await this.pseudonymizationService.pseudonymizeText(
          body.text,
          { context: body.context }
        );
        sanitizedText = pseudonymResult.pseudonymizedText;
        pseudonymizationApplied = true;
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        sanitizedText,
        originalLength: body.text.length,
        sanitizedLength: sanitizedText.length,
        processingTime,
        redactionApplied,
        pseudonymizationApplied,
        detectionResult: {
          matches: detectionResult.matches,
          processingTime: detectionResult.processingTime,
          patternsChecked: detectionResult.patternsChecked,
          sanitizedText,
          originalText: body.text,
        },
      };
    } catch (error) {
      this.logger.error('Failed to sanitize text', error instanceof Error ? error : String(error));
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sanitize text',
      };
    }
  }

  /**
   * Test PII detection on provided text
   */
  @Post('pii/test')
  async testPIIDetection(@Body() body: {
    text: string;
    enableRedaction?: boolean;
    enablePseudonymization?: boolean;
    context?: string;
  }) {
    try {
      const startTime = Date.now();

      // Get PII pattern service to detect PII
      const piiPatternService = (this.pseudonymizationService as any).piiPatternService;
      const detectionResult = await piiPatternService.detectPII(body.text, {
        minConfidence: 0.8,
        maxMatches: 100,
      });

      // Also check dictionary for known values (names, usernames, etc.)
      const client = this.supabaseService.getServiceClient();
      const { data: dictionaryEntries } = await client
        .from('pseudonym_dictionaries')
        .select('original_value, pseudonym, data_type, category')
        .eq('is_active', true);

      if (dictionaryEntries && dictionaryEntries.length > 0) {
        for (const entry of dictionaryEntries) {
          if (entry.original_value && body.text.includes(entry.original_value)) {
            const startIndex = body.text.indexOf(entry.original_value);
            // Add dictionary match to detection results
            detectionResult.matches.push({
              value: entry.original_value,
              dataType: entry.data_type || 'custom',
              patternName: `${entry.category || 'Dictionary'} - ${entry.data_type || 'Custom'}`,
              startIndex,
              endIndex: startIndex + entry.original_value.length,
              confidence: 1.0,
              severity: 'flagger', // Dictionary items are flaggers, not showstoppers
            });
          }
        }
      }

      // Apply redaction if requested (simple replacement with [REDACTED])
      let sanitizedText = body.text;
      let redactionApplied = false;

      if (body.enableRedaction && detectionResult.matches.length > 0) {
        sanitizedText = body.text;
        // Sort matches by position in reverse to avoid index issues
        const sortedMatches = [...detectionResult.matches].sort((a, b) => b.startIndex - a.startIndex);

        for (const match of sortedMatches) {
          const replacement = `[${match.dataType.toUpperCase()}_REDACTED]`;
          sanitizedText =
            sanitizedText.substring(0, match.startIndex) +
            replacement +
            sanitizedText.substring(match.endIndex);
        }
        redactionApplied = true;
      }

      // Apply pseudonymization if requested (only if redaction wasn't applied - they're mutually exclusive)
      let pseudonymizationApplied = false;
      if (body.enablePseudonymization && !redactionApplied && detectionResult.matches.length > 0) {
        const pseudonymResult = await this.pseudonymizationService.pseudonymizeText(
          body.text,
          { context: body.context }
        );
        sanitizedText = pseudonymResult.pseudonymizedText;
        pseudonymizationApplied = true;
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        sanitizedText,
        originalLength: body.text.length,
        sanitizedLength: sanitizedText.length,
        processingTime,
        redactionApplied,
        pseudonymizationApplied,
        detectionResult: {
          matches: detectionResult.matches,
          processingTime: detectionResult.processingTime,
          patternsChecked: detectionResult.patternsChecked,
          sanitizedText,
          originalText: body.text,
        },
      };
    } catch (error) {
      this.logger.error('Failed to test PII detection', error instanceof Error ? error : String(error));
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test PII detection',
      };
    }
  }

  /**
   * Return pseudonym dictionaries grouped for the UI
   */
  @Get('pseudonym/dictionaries')
  async getPseudonymDictionaries() {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('pseudonym_dictionaries')
      .select('id, category, data_type, pseudonym, is_active, created_at');

    if (error) {
      this.logger.error('Failed to load pseudonym dictionaries', error);
      return { dictionaries: [] };
    }

    // Group rows by category + data_type to fit frontend PseudonymDictionaryEntry shape
    const groups: Record<
      string,
      {
        id: string;
        category: string;
        dataType: string;
        isActive: boolean;
        words: string[];
        createdAt?: string;
      }
    > = {};
    for (const row of data || []) {
      const typedRow = row as {
        id: string;
        category: string | null;
        data_type: string | null;
        pseudonym: string | null;
        is_active: boolean | null;
        created_at: string | null;
      };
      const key = `${typedRow.category || 'uncategorized'}::${typedRow.data_type || 'custom'}::${typedRow.is_active ? '1' : '0'}`;
      if (!groups[key]) {
        groups[key] = {
          id: typedRow.id,
          category: typedRow.category || 'uncategorized',
          dataType: typedRow.data_type || 'custom',
          isActive: !!typedRow.is_active,
          words: [],
          createdAt: typedRow.created_at || undefined,
        };
      }
      if (typedRow.pseudonym && groups[key]) {
        groups[key].words.push(typedRow.pseudonym);
      }
    }

    const dictionaries = Object.values(groups);
    return { dictionaries };
  }
}
