import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlertRepository, AlertFilter } from '../alert.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskAlert, UnacknowledgedAlertView } from '../../interfaces/alert.interface';

describe('AlertRepository', () => {
  let repository: AlertRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockAlert: RiskAlert = {
    id: 'alert-123',
    subject_id: 'subject-123',
    composite_score_id: 'score-123',
    alert_type: 'threshold_breach',
    severity: 'warning',
    title: 'Risk threshold exceeded',
    message: 'Market risk has exceeded the warning threshold',
    details: {
      threshold: 70,
      actual_score: 75,
    },
    acknowledged_at: null,
    acknowledged_by: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockUnacknowledgedAlert: UnacknowledgedAlertView = {
    ...mockAlert,
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'Tech Portfolio',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockAlert, error: null };
    const listResult = overrides?.list ?? { data: [mockAlert], error: null };
    const insertResult = overrides?.insert ?? { data: mockAlert, error: null };
    const updateResult = overrides?.update ?? { data: mockAlert, error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        is: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.is as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<AlertRepository>(AlertRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findBySubject', () => {
    it('should return alerts for subject', async () => {
      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([mockAlert]);
    });

    it('should return empty array when no alerts found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch alerts: Query failed',
      );
    });

    it('should apply includeTest filter', async () => {
      const filter: AlertFilter = { includeTest: true };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockAlert]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: AlertFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockAlert]);
    });
  });

  describe('findByScope', () => {
    it('should return alerts for scope', async () => {
      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([mockAlert]);
    });

    it('should return empty array when no alerts found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByScope('scope-123')).rejects.toThrow(
        'Failed to fetch alerts by scope: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: AlertFilter = { includeTest: true };
      const result = await repository.findByScope('scope-123', filter);

      expect(result).toEqual([mockAlert]);
    });
  });

  describe('findUnacknowledged', () => {
    it('should return unacknowledged alerts from view', async () => {
      const mockClient = createMockClient({
        list: { data: [mockUnacknowledgedAlert], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findUnacknowledged();

      expect(result).toEqual([mockUnacknowledgedAlert]);
    });

    it('should return empty array when no unacknowledged alerts', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findUnacknowledged();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findUnacknowledged()).rejects.toThrow(
        'Failed to fetch unacknowledged alerts: Query failed',
      );
    });
  });

  describe('findUnacknowledgedBySubject', () => {
    it('should return unacknowledged alerts for subject', async () => {
      const result = await repository.findUnacknowledgedBySubject('subject-123');

      expect(result).toEqual([mockAlert]);
    });

    it('should return empty array when no unacknowledged alerts', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findUnacknowledgedBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findUnacknowledgedBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch unacknowledged alerts: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: AlertFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findUnacknowledgedBySubject('subject-123', filter);

      expect(result).toEqual([mockAlert]);
    });
  });

  describe('findById', () => {
    it('should return alert when found', async () => {
      const result = await repository.findById('alert-123');

      expect(result).toEqual(mockAlert);
    });

    it('should return null when alert not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('alert-123')).rejects.toThrow(
        'Failed to fetch alert: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return alert when found', async () => {
      const result = await repository.findByIdOrThrow('alert-123');

      expect(result).toEqual(mockAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create alert successfully', async () => {
      const createData = {
        subject_id: 'subject-123',
        alert_type: 'threshold_breach' as const,
        severity: 'warning' as const,
        title: 'New Alert',
        details: { threshold: 70, actual_score: 75 },
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockAlert);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          alert_type: 'threshold_breach',
          severity: 'warning',
          title: 'New Alert',
        }),
      ).rejects.toThrow('Create succeeded but no alert returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          alert_type: 'threshold_breach',
          severity: 'warning',
          title: 'New Alert',
        }),
      ).rejects.toThrow('Failed to create alert: Insert failed');
    });
  });

  describe('update', () => {
    it('should update alert successfully', async () => {
      const acknowledgedAlert = { ...mockAlert, acknowledged_at: '2024-01-02T00:00:00Z' };
      const mockClient = createMockClient({
        update: { data: acknowledgedAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('alert-123', {
        acknowledged_at: '2024-01-02T00:00:00Z',
      });

      expect(result).toEqual(acknowledgedAlert);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.update('alert-123', { acknowledged_at: '2024-01-02T00:00:00Z' }),
      ).rejects.toThrow('Update succeeded but no alert returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.update('alert-123', { acknowledged_at: '2024-01-02T00:00:00Z' }),
      ).rejects.toThrow('Failed to update alert: Update failed');
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge alert successfully', async () => {
      const acknowledgedAlert = {
        ...mockAlert,
        acknowledged_at: '2024-01-02T00:00:00Z',
        acknowledged_by: 'user-123',
      };
      const mockClient = createMockClient({
        update: { data: acknowledgedAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.acknowledge('alert-123', 'user-123');

      expect(result.acknowledged_by).toBe('user-123');
      expect(result.acknowledged_at).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete alert successfully', async () => {
      await expect(repository.delete('alert-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('alert-123')).rejects.toThrow(
        'Failed to delete alert: Delete failed',
      );
    });
  });

  describe('countUnacknowledgedBySeverity', () => {
    it('should count alerts by severity', async () => {
      const alerts: UnacknowledgedAlertView[] = [
        { ...mockUnacknowledgedAlert, severity: 'critical' },
        { ...mockUnacknowledgedAlert, id: 'alert-456', severity: 'warning' },
        { ...mockUnacknowledgedAlert, id: 'alert-789', severity: 'warning' },
        { ...mockUnacknowledgedAlert, id: 'alert-012', severity: 'info' },
      ];
      const mockClient = createMockClient({
        list: { data: alerts, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.countUnacknowledgedBySeverity();

      expect(result.critical).toBe(1);
      expect(result.warning).toBe(2);
      expect(result.info).toBe(1);
    });

    it('should return zeros when no alerts', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.countUnacknowledgedBySeverity();

      expect(result.critical).toBe(0);
      expect(result.warning).toBe(0);
      expect(result.info).toBe(0);
    });
  });

  describe('alert types', () => {
    const alertTypes = ['threshold_breach', 'rapid_change', 'dimension_spike', 'stale_assessment'] as const;

    alertTypes.forEach((alertType) => {
      it(`should handle ${alertType} alert type`, async () => {
        const alertWithType = { ...mockAlert, alert_type: alertType };
        const mockClient = createMockClient({
          single: { data: alertWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('alert-123');

        expect(result?.alert_type).toBe(alertType);
      });
    });
  });

  describe('severity levels', () => {
    const severities = ['info', 'warning', 'critical'] as const;

    severities.forEach((severity) => {
      it(`should handle ${severity} severity`, async () => {
        const alertWithSeverity = { ...mockAlert, severity };
        const mockClient = createMockClient({
          single: { data: alertWithSeverity, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('alert-123');

        expect(result?.severity).toBe(severity);
      });
    });
  });

  describe('alert details', () => {
    it('should handle threshold_breach details', async () => {
      const thresholdAlert = {
        ...mockAlert,
        alert_type: 'threshold_breach' as const,
        details: { threshold: 70, actual_score: 75 },
      };
      const mockClient = createMockClient({
        single: { data: thresholdAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('alert-123');

      expect(result?.details.threshold).toBe(70);
      expect(result?.details.actual_score).toBe(75);
    });

    it('should handle rapid_change details', async () => {
      const rapidChangeAlert = {
        ...mockAlert,
        alert_type: 'rapid_change' as const,
        details: {
          previous_score: 50,
          current_score: 75,
          change_percent: 50,
          time_window_hours: 24,
        },
      };
      const mockClient = createMockClient({
        single: { data: rapidChangeAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('alert-123');

      expect(result?.details.previous_score).toBe(50);
      expect(result?.details.change_percent).toBe(50);
    });

    it('should handle dimension_spike details', async () => {
      const dimensionSpikeAlert = {
        ...mockAlert,
        alert_type: 'dimension_spike' as const,
        details: {
          dimension_slug: 'market',
          dimension_score: 90,
          dimension_previous: 60,
        },
      };
      const mockClient = createMockClient({
        single: { data: dimensionSpikeAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('alert-123');

      expect(result?.details.dimension_slug).toBe('market');
      expect(result?.details.dimension_score).toBe(90);
    });

    it('should handle stale_assessment details', async () => {
      const staleAssessmentAlert = {
        ...mockAlert,
        alert_type: 'stale_assessment' as const,
        details: { hours_since_assessment: 72 },
      };
      const mockClient = createMockClient({
        single: { data: staleAssessmentAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('alert-123');

      expect(result?.details.hours_since_assessment).toBe(72);
    });

    it('should handle empty details', async () => {
      const alertWithEmptyDetails = { ...mockAlert, details: {} };
      const mockClient = createMockClient({
        single: { data: alertWithEmptyDetails, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('alert-123');

      expect(result?.details).toEqual({});
    });
  });
});
