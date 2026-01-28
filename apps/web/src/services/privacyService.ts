/**
 * Privacy Service - Unified Business Logic for All Privacy/PII Features
 *
 * Phase 4.3 Consolidation: Orchestrates all privacy-related services
 * and manages state updates in the unified privacyStore
 *
 * Architecture: Async operations + business logic only
 * State management done via privacyStore mutations
 */

import { usePrivacyStore } from '@/stores/privacyStore';
import { pseudonymService } from './pseudonymService';
import { piiService } from './piiService';
import { sanitizationAnalyticsService } from './sanitizationAnalyticsService';
import { sovereignPolicyService } from './sovereignPolicyService';
import type {
  PseudonymMapping,
  PseudonymDictionaryEntry,
  PIIPattern,
  PIIDataType,
  PseudonymGenerateRequest,
  PseudonymGenerateResponse,
  PseudonymLookupRequest,
  PseudonymLookupResponse,
  PseudonymDictionaryBulkOperation,
  PseudonymDictionaryImportData,
  PseudonymDictionaryExportData,
  PIIPatternBulkOperation,
  PIIPatternBulkResult,
  PIITestRequest,
  PIITestResponse,
  PIIDashboardFilters,
  PseudonymDictionaryBulkResult,
} from '@/types/pii';
import type { ActivityLog, SystemHealth } from './sanitizationAnalyticsService';

// interface ServiceError extends Error {
//   response?: {
//     status?: number;
//     data?: unknown;
//   };
// }

// ============================================================================
// PSEUDONYM MAPPINGS
// ============================================================================

export async function fetchMappings(force = false): Promise<PseudonymMapping[]> {
  const store = usePrivacyStore();

  // Skip if already loading or recently fetched (unless forced)
  if (store.mappingsLoading) return [...store.mappings];

  if (!force && store.mappingsLastFetched) {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    if (store.mappingsLastFetched > fiveMinutesAgo) {
      return [...store.mappings];
    }
  }

  store.setMappingsLoading(true);
  store.setMappingsError(null);

  try {
    const fetchedMappings = await pseudonymService.getPseudonymMappings();
    store.setMappings(fetchedMappings);
    return fetchedMappings;
  } catch (err: unknown) {
    const error = err as Error & { response?: { status?: number; data?: unknown } };
    const errorMessage = error.message || 'Failed to fetch pseudonym mappings';
    store.setMappingsError(errorMessage);
    console.error('Error fetching pseudonym mappings:', err);

    // If API endpoint doesn't exist yet, return empty array
    if (error.response?.status === 404) {
      store.setMappings([]);
      store.setMappingsError('Pseudonym mappings API endpoint not yet implemented');
    }

    throw err;
  } finally {
    store.setMappingsLoading(false);
  }
}

export async function fetchMappingsFiltered(filterOptions: {
  dataType?: PIIDataType | 'all';
  context?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ mappings: PseudonymMapping[]; total: number }> {
  const store = usePrivacyStore();

  store.setMappingsLoading(true);
  store.setMappingsError(null);

  try {
    const result = await pseudonymService.getPseudonymMappingsFiltered(filterOptions);
    store.setMappings(result.mappings);
    return result;
  } catch (err: unknown) {
    const error = err as Error;
    const errorMessage = error.message || 'Failed to fetch filtered pseudonym mappings';
    store.setMappingsError(errorMessage);
    console.error('Error fetching filtered pseudonym mappings:', err);
    throw err;
  } finally {
    store.setMappingsLoading(false);
  }
}

export async function fetchMapping(id: string): Promise<PseudonymMapping | null> {
  try {
    const mapping = await pseudonymService.getPseudonymMapping(id);

    // Update the mapping in store
    const store = usePrivacyStore();
    const existingMappings = [...store.mappings];
    const index = existingMappings.findIndex(m => m.id === id);
    if (index !== -1) {
      existingMappings[index] = mapping;
    } else {
      existingMappings.push(mapping);
    }
    store.setMappings(existingMappings);

    return mapping;
  } catch (err: unknown) {
    console.error(`Error fetching pseudonym mapping ${id}:`, err);
    return null;
  }
}

export async function fetchMappingStats(_force = false): Promise<void> {
  const store = usePrivacyStore();

  if (store.mappingStatsLoading) return;

  store.setMappingStatsLoading(true);

  try {
    const response = await pseudonymService.getPseudonymStats();
    store.setMappingStats(response.stats);
  } catch (err: unknown) {
    console.error('Error fetching pseudonym stats:', err);
  } finally {
    store.setMappingStatsLoading(false);
  }
}

export async function getMappingsByRunId(runId: string): Promise<PseudonymMapping[]> {
  const store = usePrivacyStore();

  try {
    store.setMappingsLoading(true);
    store.setMappingsError(null);

    const response = await pseudonymService.getMappingsByRunId(runId);
    return response || [];
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch mappings by run ID';
    store.setMappingsError(errorMessage);
    console.error('Error fetching mappings by run ID:', err);
    return [];
  } finally {
    store.setMappingsLoading(false);
  }
}

// ============================================================================
// PSEUDONYM DICTIONARIES
// ============================================================================

export async function loadDictionaries(force = false): Promise<PseudonymDictionaryEntry[]> {
  const store = usePrivacyStore();

  if (store.dictionariesLoading && !force) return store.dictionaries as unknown as PseudonymDictionaryEntry[];
  if (store.dictionaries.length > 0 && !force) return store.dictionaries as unknown as PseudonymDictionaryEntry[];

  store.setDictionariesLoading(true);
  store.setDictionariesError(null);

  try {
    const loadedDictionaries = await pseudonymService.getPseudonymDictionaries();
    store.setDictionaries(loadedDictionaries);
    return loadedDictionaries;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load pseudonym dictionaries';
    store.setDictionariesError(errorMessage);
    console.error('Error loading pseudonym dictionaries:', err);
    throw err;
  } finally {
    store.setDictionariesLoading(false);
  }
}

export async function createDictionary(
  dictionaryData: Omit<PseudonymDictionaryEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PseudonymDictionaryEntry> {
  const store = usePrivacyStore();

  store.setDictionariesLoading(true);
  store.setDictionariesError(null);

  try {
    const newDictionary = await pseudonymService.createPseudonymDictionary(dictionaryData);
    store.addDictionary(newDictionary);
    return newDictionary;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create pseudonym dictionary';
    store.setDictionariesError(errorMessage);
    console.error('Error creating pseudonym dictionary:', err);
    throw err;
  } finally {
    store.setDictionariesLoading(false);
  }
}

export async function updateDictionaryEntry(
  id: string,
  dictionaryData: Partial<PseudonymDictionaryEntry>
): Promise<PseudonymDictionaryEntry> {
  const store = usePrivacyStore();

  store.setDictionariesLoading(true);
  store.setDictionariesError(null);

  try {
    const updatedDictionary = await pseudonymService.updatePseudonymDictionary(id, dictionaryData);
    store.updateDictionary(id, updatedDictionary);
    return updatedDictionary;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update pseudonym dictionary';
    store.setDictionariesError(errorMessage);
    console.error('Error updating pseudonym dictionary:', err);
    throw err;
  } finally {
    store.setDictionariesLoading(false);
  }
}

export async function deleteDictionary(id: string): Promise<void> {
  const store = usePrivacyStore();

  store.setDictionariesLoading(true);
  store.setDictionariesError(null);

  try {
    await pseudonymService.deletePseudonymDictionary(id);
    store.removeDictionary(id);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete pseudonym dictionary';
    store.setDictionariesError(errorMessage);
    console.error('Error deleting pseudonym dictionary:', err);
    throw err;
  } finally {
    store.setDictionariesLoading(false);
  }
}

export async function bulkOperationDictionaries(
  operation: PseudonymDictionaryBulkOperation['operation']
): Promise<PseudonymDictionaryBulkResult> {
  const store = usePrivacyStore();

  if (store.selectedDictionaryIds.length === 0) {
    throw new Error('No dictionaries selected for bulk operation');
  }

  store.setDictionariesLoading(true);
  store.setDictionariesError(null);

  try {
    const bulkOp: PseudonymDictionaryBulkOperation = {
      operation,
      dictionaryIds: store.selectedDictionaryIds
    };

    const result = await pseudonymService.bulkOperationPseudonymDictionaries(bulkOp);

    if (result.success) {
      // Refresh dictionaries to reflect changes
      await loadDictionaries(true);
      store.clearDictionarySelection();
    }

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : `Failed to perform bulk ${operation}`;
    store.setDictionariesError(errorMessage);
    console.error(`Error performing bulk ${operation}:`, err);
    throw err;
  } finally {
    store.setDictionariesLoading(false);
  }
}

export async function generatePseudonym(
  request: PseudonymGenerateRequest
): Promise<PseudonymGenerateResponse> {
  const store = usePrivacyStore();

  store.setIsGenerating(true);
  store.setDictionariesError(null);

  try {
    const result = await pseudonymService.generatePseudonym(request);
    store.setGenerationResult(result);
    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate pseudonym';
    store.setDictionariesError(errorMessage);
    console.error('Error generating pseudonym:', err);
    throw err;
  } finally {
    store.setIsGenerating(false);
  }
}

export async function lookupPseudonym(
  request: PseudonymLookupRequest
): Promise<PseudonymLookupResponse> {
  const store = usePrivacyStore();

  store.setIsGenerating(true);
  store.setDictionariesError(null);

  try {
    const result = await pseudonymService.lookupPseudonym(request);
    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to lookup pseudonym';
    store.setDictionariesError(errorMessage);
    console.error('Error looking up pseudonym:', err);
    throw err;
  } finally {
    store.setIsGenerating(false);
  }
}

export async function importFromJSON(
  data: PseudonymDictionaryImportData[]
): Promise<{ success: boolean; imported: number; errors?: string[] }> {
  const store = usePrivacyStore();

  store.setIsImporting(true);
  store.setDictionariesError(null);
  store.setImportProgress({ imported: 0, total: data.length, errors: [] });

  try {
    const result = await pseudonymService.importPseudonymDictionaries(data);

    if (result.success) {
      store.setImportProgress({
        imported: result.imported,
        total: data.length,
        errors: result.errors || []
      });

      // Refresh dictionaries to show imported ones
      await loadDictionaries(true);
    }

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to import dictionaries';
    store.setDictionariesError(errorMessage);
    console.error('Error importing dictionaries:', err);
    throw err;
  } finally {
    store.setIsImporting(false);
  }
}

export async function importFromCSV(
  file: File
): Promise<{ success: boolean; imported: number; errors?: string[] }> {
  const store = usePrivacyStore();

  store.setIsImporting(true);
  store.setDictionariesError(null);

  try {
    const result = await pseudonymService.importFromCSV(file);

    if (result.success) {
      // Refresh dictionaries to show imported ones
      await loadDictionaries(true);
    }

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to import from CSV';
    store.setDictionariesError(errorMessage);
    console.error('Error importing from CSV:', err);
    throw err;
  } finally {
    store.setIsImporting(false);
  }
}

export async function exportToJSON(): Promise<PseudonymDictionaryExportData> {
  const store = usePrivacyStore();

  store.setIsExporting(true);
  store.setDictionariesError(null);

  try {
    const exportData = await pseudonymService.exportPseudonymDictionaries();
    return exportData;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to export dictionaries';
    store.setDictionariesError(errorMessage);
    console.error('Error exporting dictionaries:', err);
    throw err;
  } finally {
    store.setIsExporting(false);
  }
}

export async function exportToCSV(): Promise<Blob> {
  const store = usePrivacyStore();

  store.setIsExporting(true);
  store.setDictionariesError(null);

  try {
    const csvBlob = await pseudonymService.exportToCSV();
    return csvBlob;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to export to CSV';
    store.setDictionariesError(errorMessage);
    console.error('Error exporting to CSV:', err);
    throw err;
  } finally {
    store.setIsExporting(false);
  }
}

// ============================================================================
// PII PATTERNS
// ============================================================================

export async function loadPatterns(force = false): Promise<PIIPattern[]> {
  const store = usePrivacyStore();

  if (store.patternsLoading && !force) return Array.from(store.patterns);
  if (store.patterns.length > 0 && !force) return Array.from(store.patterns);

  store.setPatternsLoading(true);
  store.setPatternsError(null);

  try {
    const loadedPatterns = await piiService.getPIIPatterns();
    store.setPatterns(loadedPatterns);
    return loadedPatterns;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load PII patterns';
    store.setPatternsError(errorMessage);
    console.error('Error loading PII patterns:', err);
    throw err;
  } finally {
    store.setPatternsLoading(false);
  }
}

export async function createPattern(
  patternData: Omit<PIIPattern, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PIIPattern> {
  const store = usePrivacyStore();

  store.setPatternsLoading(true);
  store.setPatternsError(null);

  try {
    const newPattern = await piiService.createPIIPattern(patternData);
    store.addPattern(newPattern);
    return newPattern;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create PII pattern';
    store.setPatternsError(errorMessage);
    console.error('Error creating PII pattern:', err);
    throw err;
  } finally {
    store.setPatternsLoading(false);
  }
}

export async function updatePatternEntry(
  id: string,
  patternData: Partial<PIIPattern>
): Promise<PIIPattern> {
  const store = usePrivacyStore();

  store.setPatternsLoading(true);
  store.setPatternsError(null);

  try {
    const updatedPattern = await piiService.updatePIIPattern(id, patternData);
    store.updatePattern(id, updatedPattern);
    return updatedPattern;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update PII pattern';
    store.setPatternsError(errorMessage);
    console.error('Error updating PII pattern:', err);
    throw err;
  } finally {
    store.setPatternsLoading(false);
  }
}

export async function deletePattern(id: string): Promise<void> {
  const store = usePrivacyStore();

  store.setPatternsLoading(true);
  store.setPatternsError(null);

  try {
    await piiService.deletePIIPattern(id);
    store.removePattern(id);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete PII pattern';
    store.setPatternsError(errorMessage);
    console.error('Error deleting PII pattern:', err);
    throw err;
  } finally {
    store.setPatternsLoading(false);
  }
}

export async function bulkOperationPatterns(
  operation: PIIPatternBulkOperation['operation']
): Promise<PIIPatternBulkResult> {
  const store = usePrivacyStore();

  if (store.selectedPatternIds.length === 0) {
    throw new Error('No patterns selected for bulk operation');
  }

  store.setPatternsLoading(true);
  store.setPatternsError(null);

  try {
    const bulkOp: PIIPatternBulkOperation = {
      operation,
      patternIds: store.selectedPatternIds
    };

    const result = await piiService.bulkOperationPIIPatterns(bulkOp);

    if (result.success) {
      // Refresh patterns to reflect changes
      await loadPatterns(true);
      store.clearPatternSelection();
    }

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : `Failed to perform bulk ${operation}`;
    store.setPatternsError(errorMessage);
    console.error(`Error performing bulk ${operation}:`, err);
    throw err;
  } finally {
    store.setPatternsLoading(false);
  }
}

export async function testPIIDetection(request: PIITestRequest): Promise<PIITestResponse> {
  const store = usePrivacyStore();

  store.setIsTestingPII(true);
  store.setPatternsError(null);

  try {
    const result = await piiService.testPIIDetection(request);
    store.setTestResult(result);
    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to test PII detection';
    store.setPatternsError(errorMessage);
    console.error('Error testing PII detection:', err);
    throw err;
  } finally {
    store.setIsTestingPII(false);
  }
}

export async function loadPIIStats(): Promise<void> {
  const store = usePrivacyStore();

  try {
    const loadedStats = await piiService.getPIIStats();
    store.setPatternStats(loadedStats);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load PII stats';
    store.setPatternsError(errorMessage);
    console.error('Error loading PII stats:', err);
    throw err;
  }
}

// ============================================================================
// PRIVACY INDICATORS
// ============================================================================

export async function initializePrivacyIndicators(): Promise<void> {
  const store = usePrivacyStore();

  if (store.indicatorsInitialized) return;

  // Start global cleanup timer
  setInterval(cleanupOldStates, 300000); // Clean every 5 minutes

  store.setIndicatorsInitialized(true);
}

export function cleanupOldStates(): void {
  const store = usePrivacyStore();
  const now = Date.now();
  const maxAge = store.globalSettings.autoCleanupAge;
  const messagesToRemove: string[] = [];

  for (const [messageId, state] of store.messageStates.entries()) {
    if (now - state.lastUpdated.getTime() > maxAge) {
      messagesToRemove.push(messageId);
    }
  }

  messagesToRemove.forEach(messageId => {
    store.removeMessagePrivacyState(messageId);
  });

  // Enforce max stored states limit
  if (store.messageStates.size > store.globalSettings.maxStoredStates) {
    const sortedStates = Array.from(store.messageStates.entries())
      .sort((entryA, entryB) => entryA[1].lastUpdated.getTime() - entryB[1].lastUpdated.getTime());

    const toRemove = sortedStates.slice(0, store.messageStates.size - store.globalSettings.maxStoredStates);
    toRemove.forEach((entry) => {
      store.removeMessagePrivacyState(entry[0]);
    });
  }

}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function fetchDashboardData(forceRefresh = false): Promise<void> {
  const store = usePrivacyStore();

  if (store.dashboardLoading && !forceRefresh) return;

  store.setDashboardLoading(true);
  store.setDashboardError(null);

  try {
    // Convert PIIDashboardFilters to sanitizationAnalyticsService DashboardFilters
    const convertedFilters: import('./sanitizationAnalyticsService').DashboardFilters = {
      timeRange: store.dashboardFilters.timeRange === 'hour' ? '24h' :
                 store.dashboardFilters.timeRange === 'day' ? '24h' :
                 store.dashboardFilters.timeRange === 'week' ? '7d' :
                 store.dashboardFilters.timeRange === 'month' ? '30d' :
                 store.dashboardFilters.timeRange === 'year' ? '90d' :
                 store.dashboardFilters.timeRange === 'custom' ? '7d' : '7d',
      dataType: store.dashboardFilters.dataType === 'all' ? ['all' as const] :
                Array.isArray(store.dashboardFilters.dataType) ? store.dashboardFilters.dataType.map(dt => dt as PIIDataType | 'all') :
                ['all' as const],
      includeSystemEvents: store.dashboardFilters.includeSystemEvents
    };
    const data = await sanitizationAnalyticsService.getPrivacyDashboardData(convertedFilters);

    // Convert sanitizationAnalyticsService.PrivacyDashboardData to pii.PrivacyDashboardData
    const convertedData: import('@/types/pii').PrivacyDashboardData = {
      metrics: {
        totalDetections: data.metrics.totalPIIDetections,
        totalSanitizations: data.metrics.itemsSanitized,
        piiTypesDetected: {} as Record<PIIDataType, number>,
        averageProcessingTime: data.metrics.avgProcessingTimeMs,
        detectionRate: data.metrics.totalPIIDetections > 0 ?
          (data.metrics.totalPIIDetections / (data.metrics.totalPIIDetections + data.metrics.itemsSanitized)) : 0,
        sanitizationRate: data.metrics.itemsSanitized > 0 ?
          (data.metrics.itemsSanitized / (data.metrics.totalPIIDetections + data.metrics.itemsSanitized)) : 0,
        totalDataProcessed: data.metrics.itemsSanitized,
        activePatterns: 0,
        activeDictionaries: 0
      },
      detectionStats: data.detectionStats.map(stat => ({
        dataType: stat.type as PIIDataType,
        count: stat.count,
        percentage: stat.percentage,
        trend: stat.trend,
        avgConfidence: 0.85
      })),
      patternUsage: data.patternUsage.map(pattern => ({
        patternId: '',
        patternName: pattern.name,
        dataType: pattern.type as PIIDataType,
        matchCount: pattern.count,
        lastUsed: pattern.lastUsed,
        accuracy: 0.9,
        avgProcessingTime: data.metrics.avgProcessingTimeMs
      })),
      sanitizationMethods: data.sanitizationMethods.map(method => ({
        method: method.name.toLowerCase() as 'redaction' | 'pseudonymization' | 'masking' | 'encryption',
        usageCount: method.count,
        successRate: 0.95,
        avgProcessingTime: data.metrics.avgProcessingTimeMs,
        dataTypesUsed: [] as PIIDataType[]
      })),
      performanceData: data.performanceData.map(perf => ({
        timestamp: perf.timestamp,
        processingTime: perf.processingTimeMs,
        detectionCount: Math.floor(perf.throughputPerMin / 60),
        dataSize: perf.throughputPerMin,
        operation: 'detection' as const
      })),
      systemHealth: {
        status: data.systemHealth.apiStatus === 'operational' ? 'healthy' as const :
                data.systemHealth.apiStatus === 'degraded' ? 'degraded' as const : 'critical' as const,
        uptime: 99.9,
        memoryUsage: 0.5,
        cpuUsage: 0.3,
        errorRate: 0.01,
        lastHealthCheck: data.systemHealth.lastHealthCheck,
        issues: [] as Array<{
          severity: 'info' | 'warning' | 'error' | 'critical';
          message: string;
          timestamp: string;
        }>
      },
      recentActivity: data.recentActivity.map(activity => ({
        id: `${activity.timestamp.getTime()}`,
        timestamp: activity.timestamp.toISOString(),
        type: activity.type === 'sanitization' ? 'sanitization' as const :
              activity.type === 'alert' ? 'system_event' as const :
              activity.type === 'pseudonymization' ? 'dictionary_update' as const :
              activity.type === 'system' ? 'system_event' as const :
              'system_event' as const,
        description: activity.message,
        details: activity.metadata
      }))
    };
    store.setDashboardData(convertedData);
  } catch (err: unknown) {
    console.error('Failed to fetch dashboard data:', err);
    const error = err as Error;
    const errorMessage = error.message || 'Failed to fetch dashboard data';
    store.setDashboardError(errorMessage);
  } finally {
    store.setDashboardLoading(false);
  }
}

export async function updateDashboardFiltersAndRefresh(newFilters: Partial<PIIDashboardFilters>): Promise<void> {
  const store = usePrivacyStore();

  // Update filters
  store.updateDashboardFilters(newFilters);

  // Fetch new data with updated filters
  await fetchDashboardData(true);
}

export function startAutoRefreshDashboard(intervalMs = 30000): void {
  const store = usePrivacyStore();

  stopAutoRefreshDashboard(); // Clear any existing interval

  const interval = setInterval(async () => {
    if (!store.dashboardLoading) {
      await fetchDashboardData(true);
    }
  }, intervalMs);

  store.setAutoRefreshInterval(interval);
}

export function stopAutoRefreshDashboard(): void {
  const store = usePrivacyStore();

  if (store.autoRefreshInterval) {
    clearInterval(store.autoRefreshInterval);
    store.setAutoRefreshInterval(null);
  }
}

export async function getSystemHealth(): Promise<SystemHealth | null> {
  try {
    const health = await sanitizationAnalyticsService.getSystemHealth();

    // Convert SystemHealth to SystemHealthIndicators for store
    const store = usePrivacyStore();
    if (store.dashboardData) {
      const convertedHealth: import('@/types/pii').SystemHealthIndicators = {
        status: health.apiStatus === 'operational' ? 'healthy' as const :
                health.apiStatus === 'degraded' ? 'degraded' as const : 'critical' as const,
        uptime: 99.9,
        memoryUsage: 0.5,
        cpuUsage: 0.3,
        errorRate: 0.01,
        lastHealthCheck: health.lastHealthCheck,
        issues: []
      };
      const updatedData = {
        ...store.dashboardData,
        systemHealth: convertedHealth,
      } as import('@/types/pii').PrivacyDashboardData;
      store.setDashboardData(updatedData);
    }

    return health;
  } catch (err: unknown) {
    console.error('Failed to fetch system health:', err);
    return null;
  }
}

export async function getRecentActivity(limit = 10): Promise<ActivityLog[]> {
  try {
    const activity = await sanitizationAnalyticsService.getRecentActivity(limit);

    // Convert ActivityLog[] to RecentActivityEntry[] for store
    const store = usePrivacyStore();
    if (store.dashboardData) {
      const convertedActivity: import('@/types/pii').RecentActivityEntry[] = activity.map(log => ({
        id: `${log.timestamp.getTime()}`,
        timestamp: log.timestamp.toISOString(),
        type: log.type === 'sanitization' ? 'sanitization' as const :
              log.type === 'alert' ? 'system_event' as const :
              log.type === 'pseudonymization' ? 'dictionary_update' as const :
              log.type === 'system' ? 'system_event' as const :
              'system_event' as const,
        description: log.message,
        details: log.metadata
      }));
      const updatedData = {
        ...store.dashboardData,
        recentActivity: convertedActivity,
      } as import('@/types/pii').PrivacyDashboardData;
      store.setDashboardData(updatedData);
    }

    return activity;
  } catch (err: unknown) {
    console.error('Failed to fetch recent activity:', err);
    return [];
  }
}

// ============================================================================
// SOVEREIGN POLICY
// ============================================================================

export async function initializeSovereignPolicy(): Promise<void> {
  const store = usePrivacyStore();

  if (store.sovereignInitialized) return;

  store.setSovereignLoading(true);
  store.setSovereignError(null);

  try {
    // Fetch corporate policy from backend
    const policy = await sovereignPolicyService.getPolicy();

    // Convert sovereignPolicyService.SovereignPolicy to privacyStore.SovereignPolicy
    const convertedPolicy = {
      enforced: policy.enforced,
      allowedProviders: policy.enforced ? ['ollama'] : ['ollama', 'openai', 'anthropic'],
      requiresLocalProcessing: policy.enforced
    };
    store.setSovereignPolicy(convertedPolicy);

    // Load user preference from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedPreference = localStorage.getItem('userSovereignMode');
      if (savedPreference !== null) {
        store.setUserSovereignMode(JSON.parse(savedPreference));
      }
    }

    store.setSovereignInitialized(true);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load sovereign policy';
    store.setSovereignError(errorMessage);
    console.error('Failed to initialize sovereign policy:', error);
    throw error;
  } finally {
    store.setSovereignLoading(false);
  }
}

export async function updateUserSovereignPreference(enabled: boolean): Promise<void> {
  const store = usePrivacyStore();

  // If corporate enforces sovereign mode, user can't disable it
  if (store.sovereignPolicy?.enforced && !enabled) {
    throw new Error('Cannot disable sovereign mode - required by organization policy');
  }

  store.setSovereignLoading(true);
  store.setSovereignError(null);

  try {
    // Update backend (optional - could be just localStorage)
    // await sovereignPolicyService.updateUserPreference(enabled);

    // Update local state
    store.setUserSovereignMode(enabled);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update preference';
    store.setSovereignError(errorMessage);
    throw error;
  } finally {
    store.setSovereignLoading(false);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const privacyService = {
  // Mappings
  fetchMappings,
  fetchMappingsFiltered,
  fetchMapping,
  fetchMappingStats,
  getMappingsByRunId,

  // Dictionaries
  loadDictionaries,
  createDictionary,
  updateDictionaryEntry,
  deleteDictionary,
  bulkOperationDictionaries,
  generatePseudonym,
  lookupPseudonym,
  importFromJSON,
  importFromCSV,
  exportToJSON,
  exportToCSV,

  // Patterns
  loadPatterns,
  createPattern,
  updatePatternEntry,
  deletePattern,
  bulkOperationPatterns,
  testPIIDetection,
  loadPIIStats,

  // Indicators
  initializePrivacyIndicators,
  cleanupOldStates,

  // Dashboard
  fetchDashboardData,
  updateDashboardFiltersAndRefresh,
  startAutoRefreshDashboard,
  stopAutoRefreshDashboard,
  getSystemHealth,
  getRecentActivity,

  // Sovereign Policy
  initializeSovereignPolicy,
  updateUserSovereignPreference,
};
