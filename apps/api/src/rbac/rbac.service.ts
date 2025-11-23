import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Database row types for RPC and table queries
 */
interface RpcPermissionRow {
  permission_name: string;
  resource_type?: string;
  resource_id?: string;
}

interface RpcRoleRow {
  role_id: string;
  role_name: string;
  role_display_name: string;
  is_global: boolean;
  assigned_at: string;
  expires_at?: string;
}

interface RpcOrganizationRow {
  organization_slug: string;
  organization_name: string;
  role_name: string;
  is_global: boolean;
}

interface RbacRoleDbRow {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
}

interface RbacPermissionDbRow {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category?: string;
}

interface RbacAuditLogDbRow {
  id: string;
  action: string;
  actor_id: string;
  target_user_id: string;
  target_role_id: string;
  organization_slug: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PermissionCheck {
  permission: string;
  resourceType?: string;
  resourceId?: string;
}

export interface UserRole {
  id: string;
  name: string;
  displayName: string;
  isGlobal: boolean;
  assignedAt: Date;
  expiresAt?: Date;
}

export interface UserPermission {
  permission: string;
  resourceType?: string;
  resourceId?: string;
}

export interface UserOrganization {
  organizationSlug: string;
  organizationName: string;
  roleName: string;
  isGlobal: boolean;
}

export interface RbacRole {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
}

export interface RbacPermission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category?: string;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Check if user has permission in organization
   */
  async hasPermission(
    userId: string,
    organizationSlug: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<boolean> {
    const { data, error } = (await this.supabase
      .getServiceClient()
      .rpc('rbac_has_permission', {
        p_user_id: userId,
        p_organization_slug: organizationSlug,
        p_permission: permission,
        p_resource_type: resourceType || null,
        p_resource_id: resourceId || null,
      })) as { data: boolean | null; error: { message: string } | null };

    if (error) {
      this.logger.error(`Permission check failed: ${error.message}`, error);
      return false;
    }

    return data === true;
  }

  /**
   * Require permission - throws ForbiddenException if not authorized
   */
  async requirePermission(
    userId: string,
    organizationSlug: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<void> {
    const hasAccess = await this.hasPermission(
      userId,
      organizationSlug,
      permission,
      resourceType,
      resourceId,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Permission denied: ${permission}${resourceType ? ` on ${resourceType}` : ''}`,
      );
    }
  }

  /**
   * Get all permissions for user in organization
   */
  async getUserPermissions(
    userId: string,
    organizationSlug: string,
  ): Promise<UserPermission[]> {
    const { data, error } = (await this.supabase
      .getServiceClient()
      .rpc('rbac_get_user_permissions', {
        p_user_id: userId,
        p_organization_slug: organizationSlug,
      })) as {
      data: RpcPermissionRow[] | null;
      error: { message: string } | null;
    };

    if (error) {
      this.logger.error(
        `Failed to get user permissions: ${error.message}`,
        error,
      );
      return [];
    }

    return (data || []).map((row) => ({
      permission: row.permission_name,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
    }));
  }

  /**
   * Get user's roles in organization
   */
  async getUserRoles(
    userId: string,
    organizationSlug: string,
  ): Promise<UserRole[]> {
    const { data, error } = (await this.supabase
      .getServiceClient()
      .rpc('rbac_get_user_roles', {
        p_user_id: userId,
        p_organization_slug: organizationSlug,
      })) as {
      data: RpcRoleRow[] | null;
      error: { message: string } | null;
    };

    if (error) {
      this.logger.error(`Failed to get user roles: ${error.message}`, error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.role_id,
      name: row.role_name,
      displayName: row.role_display_name,
      isGlobal: row.is_global,
      assignedAt: new Date(row.assigned_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  /**
   * Get all organizations user has access to
   */
  async getUserOrganizations(userId: string): Promise<UserOrganization[]> {
    const { data, error } = (await this.supabase
      .getServiceClient()
      .rpc('rbac_get_user_organizations', {
        p_user_id: userId,
      })) as {
      data: RpcOrganizationRow[] | null;
      error: { message: string } | null;
    };

    if (error) {
      this.logger.error(
        `Failed to get user organizations: ${error.message}`,
        error,
      );
      return [];
    }

    return (data || []).map((row) => ({
      organizationSlug: row.organization_slug,
      organizationName: row.organization_name,
      roleName: row.role_name,
      isGlobal: row.is_global,
    }));
  }

  /**
   * Get all available roles
   */
  async getAllRoles(): Promise<RbacRole[]> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('rbac_roles')
      .select('id, name, display_name, description, is_system')
      .order('name');

    if (error) {
      this.logger.error(`Failed to get roles: ${error.message}`, error);
      return [];
    }

    const typedData = data as RbacRoleDbRow[] | null;
    return (typedData || []).map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      isSystem: row.is_system,
    }));
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<RbacPermission[]> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('rbac_permissions')
      .select('id, name, display_name, description, category')
      .order('category, name');

    if (error) {
      this.logger.error(`Failed to get permissions: ${error.message}`, error);
      return [];
    }

    const typedData = data as RbacPermissionDbRow[] | null;
    return (typedData || []).map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      category: row.category,
    }));
  }

  /**
   * Assign role to user in organization
   */
  async assignRole(
    targetUserId: string,
    organizationSlug: string,
    roleName: string,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<void> {
    // Get role ID
    const { data: role, error: roleError } = await this.supabase
      .getServiceClient()
      .from('rbac_roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError || !role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    const typedRole = role as { id: string };

    // Insert assignment
    const { error } = await this.supabase
      .getServiceClient()
      .from('rbac_user_org_roles')
      .upsert(
        {
          user_id: targetUserId,
          organization_slug: organizationSlug,
          role_id: typedRole.id,
          assigned_by: assignedBy,
          expires_at: expiresAt?.toISOString() || null,
        },
        {
          onConflict: 'user_id,organization_slug,role_id',
        },
      );

    if (error) {
      throw new Error(`Failed to assign role: ${error.message}`);
    }

    // Audit log
    await this.logAudit(
      'grant',
      assignedBy,
      targetUserId,
      typedRole.id,
      organizationSlug,
      {
        role_name: roleName,
        expires_at: expiresAt?.toISOString(),
      },
    );
  }

  /**
   * Revoke role from user in organization
   */
  async revokeRole(
    targetUserId: string,
    organizationSlug: string,
    roleName: string,
    revokedBy: string,
  ): Promise<void> {
    // Get role ID
    const { data: role, error: roleError } = await this.supabase
      .getServiceClient()
      .from('rbac_roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError || !role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    const typedRole = role as { id: string };

    // Delete assignment
    const { error } = await this.supabase
      .getServiceClient()
      .from('rbac_user_org_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('organization_slug', organizationSlug)
      .eq('role_id', typedRole.id);

    if (error) {
      throw new Error(`Failed to revoke role: ${error.message}`);
    }

    // Audit log
    await this.logAudit(
      'revoke',
      revokedBy,
      targetUserId,
      typedRole.id,
      organizationSlug,
      {
        role_name: roleName,
      },
    );
  }

  /**
   * Check if user is super-admin
   * Super-admin is determined by having the 'super-admin' role with organization_slug = '*'
   * The '*' indicates global access across all organizations
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    // Check if user has super-admin role with organization_slug = '*' (global access)
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('rbac_user_org_roles')
      .select(`
        id,
        role_id,
        organization_slug,
        role:rbac_roles!inner(name)
      `)
      .eq('user_id', userId)
      .eq('organization_slug', '*')
      .limit(10);

    if (error) {
      this.logger.error(`[RbacService] Error checking super admin: ${error.message}`);
      return false;
    }

    if (!data || data.length === 0) {
      return false;
    }

    // Check if any of the roles is 'super-admin'
    // The role data comes from the join, so we need to check the nested role object
    return data.some((record: any) => {
      const role = record.role;
      return role && role.name === 'super-admin';
    });
  }

  /**
   * Check if user is admin for a specific organization
   * Admin is determined by having the 'admin' role for the organization
   * Also returns true if user is super-admin (global access)
   * If organizationSlug is '*', checks if user is admin for any organization
   */
  async isAdmin(userId: string, organizationSlug: string): Promise<boolean> {
    // Super admins are admins everywhere
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) {
      return true;
    }

    // If organizationSlug is '*', check if user is admin for any organization
    if (organizationSlug === '*') {
      const { data, error } = await this.supabase
        .getServiceClient()
        .from('rbac_user_org_roles')
        .select(`
          id,
          role_id,
          organization_slug,
          role:rbac_roles!inner(name)
        `)
        .eq('user_id', userId)
        .limit(100);

      if (error) {
        this.logger.error(`[RbacService] Error checking admin (any org): ${error.message}`);
        return false;
      }

      if (!data || data.length === 0) {
        return false;
      }

      // Check if user has admin role for any organization
      return data.some((record: any) => {
        const role = record.role;
        return role && role.name === 'admin';
      });
    }

    // Check if user has admin role for the specific organization
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('rbac_user_org_roles')
      .select(`
        id,
        role_id,
        organization_slug,
        role:rbac_roles!inner(name)
      `)
      .eq('user_id', userId)
      .eq('organization_slug', organizationSlug)
      .limit(10);

    if (error) {
      this.logger.error(`[RbacService] Error checking admin: ${error.message}`);
      return false;
    }

    if (!data || data.length === 0) {
      return false;
    }

    // Check if any of the roles is 'admin'
    return data.some((record: any) => {
      const role = record.role;
      return role && role.name === 'admin';
    });
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(
    organizationSlug?: string,
    limit = 100,
  ): Promise<
    Array<{
      id: string;
      action: string;
      actorId: string;
      targetUserId: string;
      targetRoleId: string;
      organizationSlug: string;
      details: Record<string, unknown>;
      createdAt: Date;
    }>
  > {
    let query = this.supabase
      .getServiceClient()
      .from('rbac_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (organizationSlug) {
      query = query.eq('organization_slug', organizationSlug);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get audit log: ${error.message}`, error);
      return [];
    }

    const typedData = data as RbacAuditLogDbRow[] | null;
    return (typedData || []).map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      targetUserId: row.target_user_id,
      targetRoleId: row.target_role_id,
      organizationSlug: row.organization_slug,
      details: row.details,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Log an audit entry
   */
  private async logAudit(
    action: string,
    actorId: string,
    targetUserId: string | null,
    targetRoleId: string | null,
    organizationSlug: string | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.supabase.getServiceClient().from('rbac_audit_log').insert({
      action,
      actor_id: actorId,
      target_user_id: targetUserId,
      target_role_id: targetRoleId,
      organization_slug: organizationSlug,
      details,
    });
  }
}
