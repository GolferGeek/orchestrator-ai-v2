import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { UserRole } from '../decorators/roles.decorator';

// Test utilities for creating mock execution contexts
const createMockExecutionContext = (options: {
  user?: { id: string; roles?: string[] };
  body?: Record<string, unknown>;
}): ExecutionContext => {
  const { user, body = {} } = options;

  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        body,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({
      getData: () => ({}),
      getContext: () => ({}),
    }),
    switchToWs: () => ({
      getData: () => ({}),
      getClient: () => ({}),
    }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
};

describe('RolesGuard - Security Tests', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let supabaseService: jest.Mocked<SupabaseService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    supabaseService = {
      getServiceClient: jest.fn(),
      getAnonClient: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

    guard = new RolesGuard(reflector, supabaseService);

    // Spy on logger to verify error messages don't leak sensitive info
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  describe('Role-Based Access Control - Security', () => {
    it('should allow user with required role', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-1',
                  email: 'admin@example.com',
                  display_name: 'Admin User',
                  roles: ['admin'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-1' },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user without required role', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-2',
                  email: 'viewer@example.com',
                  display_name: 'Viewer',
                  roles: ['user'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-2' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('should handle missing roles gracefully', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-3',
                  email: 'noroles@example.com',
                  display_name: 'No Roles',
                  roles: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-3' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should default to user role when roles array is empty', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-4',
                  email: 'default@example.com',
                  display_name: 'Default User',
                  roles: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-4' },
      });

      // Should succeed because user role is implicit default
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should not be bypassable via role manipulation in request body', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-5',
                  email: 'attacker@example.com',
                  display_name: 'Attacker',
                  roles: ['user'], // Database has 'user' role
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-5' },
        body: { roles: ['admin'] }, // Attempt to inject admin role via body
      });

      // Should deny because database roles are used, not request body
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not be bypassable via user object manipulation', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-6',
                  email: 'attacker2@example.com',
                  display_name: 'Attacker 2',
                  roles: ['user'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-6', roles: ['admin'] }, // Injected roles in user object
      });

      // Should deny because guard fetches roles from database
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authenticated user', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const context = createMockExecutionContext({
        user: undefined,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication required',
      );

      // Should not call database when user is missing
      expect(supabaseService.getServiceClient).not.toHaveBeenCalled();
    });

    it('should require user ID', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const context = createMockExecutionContext({
        user: {} as { id: string },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication required',
      );
    });

    it('should handle user profile not found', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'nonexistent-user' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User profile not found',
      );
    });
  });

  describe('No Roles Required - Bypass', () => {
    it('should allow access when no roles are specified', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createMockExecutionContext({
        user: { id: 'user-any' },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Should not call database when no roles are required
      expect(supabaseService.getServiceClient).not.toHaveBeenCalled();
    });

    it('should allow access when roles array is empty', async () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const context = createMockExecutionContext({
        user: { id: 'user-any' },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Should not call database when no roles are required
      expect(supabaseService.getServiceClient).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Roles - OR Logic', () => {
    it('should allow user with any of multiple required roles', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ADMIN,
        UserRole.DEVELOPER,
      ]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-dev',
                  email: 'dev@example.com',
                  display_name: 'Developer',
                  roles: ['developer'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-dev' },
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user without any of multiple required roles', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ADMIN,
        UserRole.DEVELOPER,
      ]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-support',
                  email: 'support@example.com',
                  display_name: 'Support',
                  roles: ['support'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-support' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('Role Validation - Security', () => {
    it('should filter out invalid role strings', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-invalid',
                  email: 'invalid@example.com',
                  display_name: 'Invalid Roles',
                  roles: ['admin', 'invalid-role-xyz', 'fake-admin'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-invalid' },
      });

      // Should succeed because 'admin' is valid (invalid roles are filtered)
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny when all roles are invalid', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-all-invalid',
                  email: 'allinvalid@example.com',
                  display_name: 'All Invalid',
                  roles: ['fake-admin', 'super-user', 'root'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-all-invalid' },
      });

      // All roles filtered out, defaults to 'user', should deny
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Database Error Handling - Security', () => {
    it('should not expose database error details', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: {
                  code: 'DB_ERROR',
                  message:
                    'Connection to database failed: timeout at 10.0.0.5:5432',
                },
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-db-error' },
      });

      try {
        await guard.canActivate(context);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const message = (error as ForbiddenException).message;
        // Should not leak database details
        expect(message).not.toContain('timeout');
        expect(message).not.toContain('10.0.0.5');
        expect(message).not.toContain('5432');
        expect(message).toBe('Error verifying user permissions');
      }
    });

    it('should handle database exception gracefully', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockRejectedValue(new Error('DB connection lost')),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-exception' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Error verifying user permissions',
      );
    });

    it('should preserve ForbiddenException error messages', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-not-found' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'User profile not found',
      );
    });
  });

  describe('Request Enhancement', () => {
    it('should add user profile to request for controllers', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const userProfile = {
        id: 'user-enhance',
        email: 'enhance@example.com',
        display_name: 'Enhanced User',
        roles: ['admin'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockRequest = {
        user: { id: 'user-enhance' },
        body: {},
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: userProfile,
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      await guard.canActivate(context);

      expect((mockRequest as Record<string, unknown>).userProfile).toEqual(
        userProfile,
      );
    });
  });

  describe('Service Client Usage - Security', () => {
    it('should use service client to bypass RLS', async () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-rls',
                  email: 'rls@example.com',
                  display_name: 'RLS Test',
                  roles: ['admin'],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      supabaseService.getServiceClient.mockReturnValue(mockClient as never);

      const context = createMockExecutionContext({
        user: { id: 'user-rls' },
      });

      await guard.canActivate(context);

      // Verify service client was used (bypasses RLS)
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
      expect(supabaseService.getAnonClient).not.toHaveBeenCalled();
    });
  });
});
