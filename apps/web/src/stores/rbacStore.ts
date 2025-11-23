/**
 * RBAC Store
 * Unified authentication and authorization store
 * Manages: login/logout, user profile, roles, permissions, organization context
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { authService } from '@/services/authService';
import { apiService } from '@/services/apiService';
import { tokenManager } from '@/services/tokenManager';
import rbacService, {
  type RbacRole,
  type RbacPermission,
  type UserRole,
  type UserOrganization,
} from '@/services/rbacService';
import type { SignupData } from '@/types/auth';

// User profile from /auth/me
interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  roles: string[];
  organizationAccess?: string[];
}

// Token data from login/signup
interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
}

const resolveErrorMessage = (error: unknown, fallback: string): string => (
  error instanceof Error && error.message ? error.message : fallback
);

const getResponseStatus = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    if (response && typeof response.status === 'number') {
      return response.status;
    }
  }
  return undefined;
};

export const useRbacStore = defineStore('rbac', () => {
  // ==================== AUTH STATE ====================
  const token = ref<string | null>(localStorage.getItem('authToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<UserProfile | null>(null);
  const authLoading = ref(false);
  const authError = ref<string | null>(null);

  // Auth computed
  const isAuthenticated = computed(() => !!token.value);

  // Session management
  const sessionStartTime = ref<Date | null>(null);
  const lastActivityTime = ref<Date | null>(null);
  const sessionTimeoutMinutes = ref(480); // 8 hours

  const isSessionActive = computed(() => {
    if (!sessionStartTime.value || !lastActivityTime.value) return false;
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - lastActivityTime.value.getTime();
    return timeSinceLastActivity < (sessionTimeoutMinutes.value * 60 * 1000);
  });

  const updateActivity = () => {
    lastActivityTime.value = new Date();
  };

  watch(isAuthenticated, (newVal) => {
    if (newVal && !sessionStartTime.value) {
      sessionStartTime.value = new Date();
      lastActivityTime.value = new Date();
    } else if (!newVal) {
      sessionStartTime.value = null;
      lastActivityTime.value = null;
    }
  });

  // ==================== RBAC STATE ====================
  const currentOrganization = ref<string | null>(null);
  const userRoles = ref<Map<string, UserRole[]>>(new Map());
  const userPermissions = ref<Map<string, string[]>>(new Map());
  const userOrganizations = ref<UserOrganization[]>([]);
  const isSuperAdmin = ref(false);
  const allRoles = ref<RbacRole[]>([]);
  const allPermissions = ref<RbacPermission[]>([]);
  const permissionsByCategory = ref<Record<string, RbacPermission[]>>({});
  const rbacLoading = ref(false);
  const isInitialized = ref(false);

  // RBAC computed
  const isAdmin = computed(() => isSuperAdmin.value || (user.value?.roles?.includes('admin') ?? false));
  const hasAdminAccess = computed(() => isAdmin.value);
  const hasEvaluationAccess = computed(() => isSuperAdmin.value || isAdmin.value || (user.value?.roles?.includes('manager') ?? false));

  const currentOrgRoles = computed(() => {
    if (!currentOrganization.value) return [];
    return userRoles.value.get(currentOrganization.value) || [];
  });

  const currentOrgPermissions = computed(() => {
    if (!currentOrganization.value) return [];
    return userPermissions.value.get(currentOrganization.value) || [];
  });

  const hasAnyOrganization = computed(() => userOrganizations.value.length > 0);

  // ==================== AUTH ACTIONS ====================

  function setTokenData(tokenData: TokenData) {
    token.value = tokenData.accessToken;
    localStorage.setItem('authToken', tokenData.accessToken);
    if (tokenData.refreshToken) {
      refreshToken.value = tokenData.refreshToken;
      localStorage.setItem('refreshToken', tokenData.refreshToken);
    }
    apiService.setAuthToken(tokenData.accessToken);
    authError.value = null;
  }

  function clearAuthData() {
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    apiService.clearAuth();
    reset();
  }

  async function login(credentials: { email: string; password: string }) {
    authLoading.value = true;
    authError.value = null;
    try {
      const tokenData = await authService.login(credentials);
      setTokenData(tokenData);
      await fetchCurrentUser();
      await initialize();
      tokenManager.startMonitoring();
      authLoading.value = false;
      return true;
    } catch (err) {
      authError.value = resolveErrorMessage(err, 'Login failed.');
      clearAuthData();
      authLoading.value = false;
      return false;
    }
  }

  async function signupAndLogin(signupData: SignupData) {
    authLoading.value = true;
    authError.value = null;
    try {
      const tokenData = await authService.signup(signupData);
      setTokenData(tokenData);
      await fetchCurrentUser();
      await initialize();
      tokenManager.startMonitoring();
      authLoading.value = false;
      return { success: true };
    } catch (err) {
      const message = resolveErrorMessage(err, 'Signup failed.');
      authError.value = message;
      if (message.includes('confirm your account')) {
        authLoading.value = false;
        return { success: false, emailConfirmationPending: true, message };
      }
      clearAuthData();
      authLoading.value = false;
      return { success: false, message };
    }
  }

  async function logout() {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Auth service logout failed', err);
    }
    tokenManager.stopMonitoring();
    clearAuthData();
  }

  async function refreshAuthToken(): Promise<boolean> {
    try {
      authLoading.value = true;
      authError.value = null;
      const tokenData = await authService.refreshToken();
      setTokenData(tokenData);
      await fetchCurrentUser();
      return true;
    } catch {
      authError.value = 'Could not refresh authentication token.';
      clearAuthData();
      return false;
    } finally {
      authLoading.value = false;
    }
  }

  async function fetchCurrentUser() {
    if (!token.value) {
      user.value = null;
      localStorage.removeItem('userData');
      return;
    }
    try {
      const userData = await apiService.getCurrentUser() as UserProfile;
      console.log('[RbacStore] User data received:', userData);
      user.value = userData;
      localStorage.setItem('userData', JSON.stringify(userData));
      authError.value = null;
    } catch (err) {
      authError.value = 'Could not fetch user details.';
      if (getResponseStatus(err) === 401) {
        clearAuthData();
      }
    }
  }

  // ==================== RBAC ACTIONS ====================

  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    if (!token.value) return;

    rbacLoading.value = true;
    try {
      const orgs = await rbacService.getMyOrganizations();
      userOrganizations.value = orgs;
      isSuperAdmin.value = await rbacService.checkSuperAdmin();

      if (orgs.length > 0 && !currentOrganization.value) {
        const defaultOrg = orgs.find((o) => !o.isGlobal) || orgs[0];
        await setOrganization(defaultOrg.organizationSlug);
      }

      await loadRolesAndPermissions();
      isInitialized.value = true;
    } catch (error) {
      console.error('Failed to initialize RBAC:', error);
    } finally {
      rbacLoading.value = false;
    }
  }

  async function setOrganization(orgSlug: string): Promise<void> {
    currentOrganization.value = orgSlug;
    await loadUserPermissions(orgSlug);
  }

  async function loadUserPermissions(orgSlug: string): Promise<void> {
    try {
      const [roles, permissions] = await Promise.all([
        rbacService.getMyRoles(orgSlug),
        rbacService.getMyPermissions(orgSlug),
      ]);
      userRoles.value.set(orgSlug, roles);
      userPermissions.value.set(orgSlug, permissions.map((p) => p.permission));
    } catch (error) {
      console.error(`Failed to load permissions for org ${orgSlug}:`, error);
      userRoles.value.set(orgSlug, []);
      userPermissions.value.set(orgSlug, []);
    }
  }

  async function loadRolesAndPermissions(): Promise<void> {
    try {
      const [roles, permData] = await Promise.all([
        rbacService.getAllRoles(),
        rbacService.getAllPermissions(),
      ]);
      allRoles.value = roles;
      allPermissions.value = permData.permissions;
      permissionsByCategory.value = permData.grouped;
    } catch (error) {
      console.error('Failed to load roles and permissions:', error);
    }
  }

  function hasPermission(permission: string): boolean {
    if (isSuperAdmin.value) return true;
    if (!currentOrganization.value) return false;

    const perms = userPermissions.value.get(currentOrganization.value) || [];
    if (perms.includes(permission)) return true;

    const category = permission.split(':')[0];
    if (perms.includes(`${category}:*`)) return true;
    if (perms.includes('*:*')) return true;

    return false;
  }

  function hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => hasPermission(p));
  }

  function hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((p) => hasPermission(p));
  }

  function hasRole(roleName: string): boolean {
    if (isSuperAdmin.value) return true;
    if (!currentOrganization.value) return false;
    const roles = userRoles.value.get(currentOrganization.value) || [];
    return roles.some((r) => r.name === roleName);
  }

  function hasPermissionInOrg(orgSlug: string, permission: string): boolean {
    if (isSuperAdmin.value) return true;
    const perms = userPermissions.value.get(orgSlug) || [];
    if (perms.includes(permission)) return true;
    const category = permission.split(':')[0];
    if (perms.includes(`${category}:*`)) return true;
    if (perms.includes('*:*')) return true;
    return false;
  }

  function reset(): void {
    currentOrganization.value = null;
    userRoles.value.clear();
    userPermissions.value.clear();
    userOrganizations.value = [];
    isSuperAdmin.value = false;
    isInitialized.value = false;
  }

  async function refresh(): Promise<void> {
    if (currentOrganization.value) {
      await loadUserPermissions(currentOrganization.value);
    }
  }

  // Initialize on store creation if token exists
  if (token.value) {
    authService.initializeAuthHeader();
    apiService.setAuthToken(token.value);
    tokenManager.startMonitoring();
    fetchCurrentUser().then(() => initialize());
  }

  return {
    // Auth state
    token,
    refreshToken,
    user,
    isLoading: authLoading,
    error: authError,
    isAuthenticated,
    isSessionActive,
    sessionStartTime: computed(() => sessionStartTime.value),
    lastActivityTime: computed(() => lastActivityTime.value),

    // Role checks
    isSuperAdmin,
    isAdmin,
    hasAdminAccess,
    hasEvaluationAccess,

    // RBAC state
    currentOrganization,
    userRoles,
    userPermissions,
    userOrganizations,
    allRoles,
    allPermissions,
    permissionsByCategory,
    isInitialized,

    // RBAC computed
    currentOrgRoles,
    currentOrgPermissions,
    hasAnyOrganization,

    // Auth actions
    login,
    signupAndLogin,
    logout,
    fetchCurrentUser,
    refreshAuthToken,
    updateActivity,
    clearAuthData,

    // RBAC actions
    initialize,
    setOrganization,
    loadUserPermissions,
    loadRolesAndPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasPermissionInOrg,
    reset,
    clear: reset,
    refresh,
  };
});

// Export for backwards compatibility - alias as authStore
export const useAuthStore = useRbacStore;
