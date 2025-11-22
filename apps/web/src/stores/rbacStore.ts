/**
 * RBAC Store
 * Manages user permissions, roles, and organization context
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import rbacService, {
  type RbacRole,
  type RbacPermission,
  type UserRole,
  type UserOrganization,
} from '@/services/rbacService';

export const useRbacStore = defineStore('rbac', () => {
  // State
  const currentOrganization = ref<string | null>(null);
  const userRoles = ref<Map<string, UserRole[]>>(new Map()); // orgSlug -> roles
  const userPermissions = ref<Map<string, string[]>>(new Map()); // orgSlug -> permission names
  const userOrganizations = ref<UserOrganization[]>([]);
  const isSuperAdmin = ref(false);
  const allRoles = ref<RbacRole[]>([]);
  const allPermissions = ref<RbacPermission[]>([]);
  const permissionsByCategory = ref<Record<string, RbacPermission[]>>({});
  const isLoading = ref(false);
  const isInitialized = ref(false);

  // Getters
  const currentOrgRoles = computed(() => {
    if (!currentOrganization.value) return [];
    return userRoles.value.get(currentOrganization.value) || [];
  });

  const currentOrgPermissions = computed(() => {
    if (!currentOrganization.value) return [];
    return userPermissions.value.get(currentOrganization.value) || [];
  });

  const hasAnyOrganization = computed(() => userOrganizations.value.length > 0);

  // Actions

  /**
   * Initialize RBAC for the current user
   * Call this after login
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    isLoading.value = true;
    try {
      // Load user's organizations
      const orgs = await rbacService.getMyOrganizations();
      userOrganizations.value = orgs;

      // Check if super-admin
      isSuperAdmin.value = await rbacService.checkSuperAdmin();

      // Set default organization if available
      if (orgs.length > 0 && !currentOrganization.value) {
        // Prefer non-global org, or first one
        const defaultOrg = orgs.find((o) => !o.isGlobal) || orgs[0];
        await setOrganization(defaultOrg.organizationSlug);
      }

      // Load available roles and permissions for admin UI
      await loadRolesAndPermissions();

      isInitialized.value = true;
    } catch (error) {
      console.error('Failed to initialize RBAC:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Set the current organization context
   */
  async function setOrganization(orgSlug: string): Promise<void> {
    currentOrganization.value = orgSlug;
    await loadUserPermissions(orgSlug);
  }

  /**
   * Load user's permissions for an organization
   */
  async function loadUserPermissions(orgSlug: string): Promise<void> {
    try {
      const [roles, permissions] = await Promise.all([
        rbacService.getMyRoles(orgSlug),
        rbacService.getMyPermissions(orgSlug),
      ]);

      userRoles.value.set(orgSlug, roles);
      userPermissions.value.set(
        orgSlug,
        permissions.map((p) => p.permission)
      );
    } catch (error) {
      console.error(`Failed to load permissions for org ${orgSlug}:`, error);
      // Set empty permissions on error
      userRoles.value.set(orgSlug, []);
      userPermissions.value.set(orgSlug, []);
    }
  }

  /**
   * Load all available roles and permissions (for admin UI)
   */
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

  /**
   * Check if current user has a specific permission in current org
   */
  function hasPermission(permission: string): boolean {
    if (isSuperAdmin.value) return true;
    if (!currentOrganization.value) return false;

    const perms = userPermissions.value.get(currentOrganization.value) || [];

    // Check exact match
    if (perms.includes(permission)) return true;

    // Check category wildcard (rag:* for rag:read)
    const category = permission.split(':')[0];
    if (perms.includes(`${category}:*`)) return true;

    // Check full wildcard
    if (perms.includes('*:*')) return true;

    return false;
  }

  /**
   * Check if user has any of the given permissions
   */
  function hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => hasPermission(p));
  }

  /**
   * Check if user has all of the given permissions
   */
  function hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((p) => hasPermission(p));
  }

  /**
   * Check if user has a specific role in current org
   */
  function hasRole(roleName: string): boolean {
    if (isSuperAdmin.value) return true;
    if (!currentOrganization.value) return false;

    const roles = userRoles.value.get(currentOrganization.value) || [];
    return roles.some((r) => r.name === roleName);
  }

  /**
   * Check permission for a specific organization (not current)
   */
  function hasPermissionInOrg(orgSlug: string, permission: string): boolean {
    if (isSuperAdmin.value) return true;

    const perms = userPermissions.value.get(orgSlug) || [];

    if (perms.includes(permission)) return true;

    const category = permission.split(':')[0];
    if (perms.includes(`${category}:*`)) return true;
    if (perms.includes('*:*')) return true;

    return false;
  }

  /**
   * Clear RBAC state (call on logout)
   */
  function clear(): void {
    currentOrganization.value = null;
    userRoles.value.clear();
    userPermissions.value.clear();
    userOrganizations.value = [];
    isSuperAdmin.value = false;
    isInitialized.value = false;
  }

  /**
   * Refresh permissions for current organization
   */
  async function refresh(): Promise<void> {
    if (currentOrganization.value) {
      await loadUserPermissions(currentOrganization.value);
    }
  }

  return {
    // State
    currentOrganization,
    userRoles,
    userPermissions,
    userOrganizations,
    isSuperAdmin,
    allRoles,
    allPermissions,
    permissionsByCategory,
    isLoading,
    isInitialized,

    // Getters
    currentOrgRoles,
    currentOrgPermissions,
    hasAnyOrganization,

    // Actions
    initialize,
    setOrganization,
    loadUserPermissions,
    loadRolesAndPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasPermissionInOrg,
    clear,
    refresh,
  };
});
