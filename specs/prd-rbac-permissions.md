# PRD: Role-Based Access Control (RBAC) System

## Document Information
- **Version**: 1.0
- **Status**: Draft
- **Author**: Claude Code
- **Date**: 2025-01-22
- **Dependencies**: Existing user/organization tables

---

## 1. Executive Summary

This PRD defines a comprehensive RBAC system for Orchestrator AI that supports:
- **Multi-tenant access**: Users can belong to multiple organizations with different roles in each
- **Super-admin capability**: Global access across all organizations
- **Resource-level permissions**: Fine-grained access control to specific resources (collections, documents, agents)
- **Standard RBAC pattern**: Industry-standard approach used by AWS IAM, GCP IAM, etc.

**Primary Use Cases:**
1. Control which users can access which RAG documents
2. Restrict admin functionality by role
3. Allow super-admins to manage all organizations
4. Enable users to have different permissions in different organizations

---

## 2. Current State

### 2.1 Backend Implementation

#### Auth Module Structure
```
apps/api/src/auth/
├── auth.module.ts           # Global module exporting AuthService, JwtAuthGuard, StreamTokenService
├── auth.service.ts          # Signup, login, logout, token refresh, role management
├── auth.controller.ts       # /auth/* endpoints including admin user management
├── guards/
│   ├── jwt-auth.guard.ts    # JWT validation via Supabase
│   └── roles.guard.ts       # Role-based access control
├── decorators/
│   ├── current-user.decorator.ts  # @CurrentUser() extracts authenticated user
│   ├── public.decorator.ts        # @Public() marks routes as public
│   └── roles.decorator.ts         # @Roles(), @AdminOnly(), @DeveloperAccess(), etc.
└── services/
    └── stream-token.service.ts    # Short-lived tokens for SSE connections
```

#### Current User Roles (Enum)
```typescript
// apps/api/src/auth/decorators/roles.decorator.ts
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  EVALUATION_MONITOR = 'evaluation-monitor',
  BETA_TESTER = 'beta-tester',
  SUPPORT = 'support',
}
```

#### Database Schema (users table)
```sql
-- apps/api/supabase/migrations/20250120000003_create_users_table.sql
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',        -- Legacy single role (deprecated)
    roles JSONB NOT NULL DEFAULT '["user"]'::jsonb,  -- Array of roles
    namespace_access JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Agent namespace access
    organization_slug VARCHAR(255),                  -- Optional org reference
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Current Organizations Table
```sql
-- apps/api/supabase/migrations/20250120000001_create_organizations_table.sql
CREATE TABLE IF NOT EXISTS public.organizations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Frontend Implementation

#### Auth Store (`apps/web/src/stores/authStore.ts`)
- **622 lines** of comprehensive RBAC logic
- Same `UserRole` enum as backend (6 roles)
- **18 hardcoded permissions** in `Permission` enum
- **Role-permission mappings** in `ROLE_PERMISSIONS` constant
- Methods: `hasRole()`, `hasAnyRole()`, `hasPermission()`, `hasAnyPermission()`, `canAccessResource()`
- Session management: `updateActivity()`, `extendSession()`, `getRemainingSessionTime()`
- Audit logging: `logAccessAttempt()`, `getAccessAttempts()` (limited to last 100 entries)

#### Current Frontend Permissions (Enum)
```typescript
// apps/web/src/stores/authStore.ts
export enum Permission {
  CREATE_USERS = 'create_users',
  READ_USERS = 'read_users',
  UPDATE_USERS = 'update_users',
  DELETE_USERS = 'delete_users',
  MANAGE_USER_ROLES = 'manage_user_roles',
  CREATE_PII_PATTERNS = 'create_pii_patterns',
  READ_PII_PATTERNS = 'read_pii_patterns',
  UPDATE_PII_PATTERNS = 'update_pii_patterns',
  DELETE_PII_PATTERNS = 'delete_pii_patterns',
  CREATE_AGENTS = 'create_agents',
  READ_AGENTS = 'read_agents',
  UPDATE_AGENTS = 'update_agents',
  DELETE_AGENTS = 'delete_agents',
  CREATE_EVALUATIONS = 'create_evaluations',
  READ_EVALUATIONS = 'read_evaluations',
  UPDATE_EVALUATIONS = 'update_evaluations',
  DELETE_EVALUATIONS = 'delete_evaluations',
  VIEW_ADMIN_DASHBOARD = 'view_admin_dashboard',
}
```

#### Route Guards (`apps/web/src/router/index.ts`)
```typescript
// beforeEach guard checks:
// 1. meta.requiresAuth - redirects to /login if not authenticated
// 2. meta.requiresRole - redirects to /access-denied if missing role
```

#### Existing Directives & Composables
- `v-role-guard` directive (`apps/web/src/directives/roleGuard.ts`)
- `useRoleGuard()` composable (`apps/web/src/composables/useRoleGuard.ts`)
- `RoleTestingPanel.vue` for development testing

#### Auth Services
- `authService.ts` - Login, signup, logout, token management
- `apiService.ts` - API calls with auth headers
- `tokenManager.ts` - Automatic token refresh
- `userManagementService.ts` - Admin user CRUD (already exists but UI missing)

### 2.3 What's Missing

#### Backend Gaps
| Gap | Description |
|-----|-------------|
| No organization membership table | Users aren't formally linked to organizations with roles |
| No permission-based authorization | Only role-based checks exist |
| No organization-scoped roles | Roles are global to the user, not per-org |
| No organization guard | No way to restrict access to org-specific resources |
| No role_audit_log table | Referenced in code but doesn't exist in schema |
| Permissions not in database | Hardcoded in code, not queryable |

#### Frontend Gaps
| Gap | Description |
|-----|-------------|
| No User Management Page | `userManagementService.ts` exists but no UI |
| No Role Management Page | Cannot view/edit roles in UI |
| No Forgot Password Page | Types exist in `auth.ts` but no UI |
| Signup disabled | Link commented out in `LoginPage.vue` |
| No permission admin UI | Cannot configure role-permission mappings |
| Permissions hardcoded | `Permission` enum is static, not from database |

### 2.4 Limitations of Current System

- Cannot give a user different roles in different organizations
- Cannot restrict access to specific resources (documents, collections)
- No super-admin concept for cross-org access
- No audit trail for permission changes
- Frontend and backend permission definitions can drift apart
- No way to create custom roles or permissions at runtime

---

## 3. Data Model

### 3.1 Core Tables

```sql
-- =============================================================================
-- ROLES TABLE
-- =============================================================================
-- Defines available roles in the system
-- Roles are global (not per-org) - the same "admin" role exists everywhere

CREATE TABLE IF NOT EXISTS rbac_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,  -- System roles cannot be deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed system roles
INSERT INTO rbac_roles (name, display_name, description, is_system) VALUES
    ('super-admin', 'Super Administrator', 'Full access to all organizations and resources', true),
    ('admin', 'Administrator', 'Full access within assigned organization', true),
    ('manager', 'Manager', 'Can manage users and resources within organization', true),
    ('member', 'Member', 'Standard access within organization', true),
    ('viewer', 'Viewer', 'Read-only access within organization', true);


-- =============================================================================
-- PERMISSIONS TABLE
-- =============================================================================
-- Defines available permissions (actions)
-- Format: resource:action (e.g., rag:read, agents:execute, admin:users)

CREATE TABLE IF NOT EXISTS rbac_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),  -- For UI grouping: 'rag', 'agents', 'admin', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed permissions
INSERT INTO rbac_permissions (name, display_name, category, description) VALUES
    -- Wildcard permissions
    ('*:*', 'Full Access', 'system', 'Complete access to everything'),

    -- RAG permissions
    ('rag:read', 'Read RAG', 'rag', 'Query RAG collections and view documents'),
    ('rag:write', 'Write RAG', 'rag', 'Upload documents and manage collections'),
    ('rag:delete', 'Delete RAG', 'rag', 'Delete documents and collections'),
    ('rag:admin', 'Administer RAG', 'rag', 'Full RAG administration'),

    -- Agent permissions
    ('agents:execute', 'Execute Agents', 'agents', 'Run agent conversations'),
    ('agents:manage', 'Manage Agents', 'agents', 'Create and configure agents'),
    ('agents:admin', 'Administer Agents', 'agents', 'Full agent administration'),

    -- Admin permissions
    ('admin:users', 'Manage Users', 'admin', 'Invite and manage organization users'),
    ('admin:roles', 'Manage Roles', 'admin', 'Assign roles to users'),
    ('admin:settings', 'Manage Settings', 'admin', 'Configure organization settings'),
    ('admin:billing', 'Manage Billing', 'admin', 'View and manage billing'),
    ('admin:audit', 'View Audit Logs', 'admin', 'Access audit and usage logs'),

    -- LLM permissions
    ('llm:use', 'Use LLM', 'llm', 'Make LLM API calls'),
    ('llm:admin', 'Administer LLM', 'llm', 'Configure models and usage limits'),

    -- Deliverables permissions
    ('deliverables:read', 'Read Deliverables', 'deliverables', 'View deliverables'),
    ('deliverables:write', 'Write Deliverables', 'deliverables', 'Create and edit deliverables'),
    ('deliverables:delete', 'Delete Deliverables', 'deliverables', 'Delete deliverables');


-- =============================================================================
-- ROLE-PERMISSION MAPPING
-- =============================================================================
-- Links roles to permissions
-- Can optionally scope to specific resources

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,

    -- Resource scoping (NULL = all resources of this type in org)
    resource_type VARCHAR(100),  -- 'collection', 'document', 'agent', etc.
    resource_id UUID,            -- Specific resource ID (NULL = all)

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE(role_id, permission_id, resource_type, resource_id)
);

-- Create index for permission lookups
CREATE INDEX idx_role_permissions_role ON rbac_role_permissions(role_id);
CREATE INDEX idx_role_permissions_resource ON rbac_role_permissions(resource_type, resource_id)
    WHERE resource_type IS NOT NULL;


-- =============================================================================
-- USER-ORGANIZATION-ROLE MAPPING
-- =============================================================================
-- Links users to organizations with specific roles
-- organization_slug = '*' means global access (super-admin)

CREATE TABLE IF NOT EXISTS rbac_user_org_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_slug VARCHAR(255) NOT NULL,  -- '*' for global/super-admin
    role_id UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,

    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Optional expiration

    -- Prevent duplicate role assignments
    UNIQUE(user_id, organization_slug, role_id)
);

-- Create indexes for lookups
CREATE INDEX idx_user_org_roles_user ON rbac_user_org_roles(user_id);
CREATE INDEX idx_user_org_roles_org ON rbac_user_org_roles(organization_slug);
CREATE INDEX idx_user_org_roles_user_org ON rbac_user_org_roles(user_id, organization_slug);


-- =============================================================================
-- PERMISSION AUDIT LOG
-- =============================================================================
-- Track all permission changes for compliance

CREATE TABLE IF NOT EXISTS rbac_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,  -- 'grant', 'revoke', 'role_created', etc.
    actor_id UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    target_role_id UUID REFERENCES rbac_roles(id),
    organization_slug VARCHAR(255),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rbac_audit_created ON rbac_audit_log(created_at DESC);
CREATE INDEX idx_rbac_audit_actor ON rbac_audit_log(actor_id);
CREATE INDEX idx_rbac_audit_target ON rbac_audit_log(target_user_id);
```

### 3.2 Seed Default Role-Permission Mappings

```sql
-- Super-admin gets everything
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_permissions p
WHERE r.name = 'super-admin' AND p.name = '*:*';

-- Admin gets most permissions (within their org)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_permissions p
WHERE r.name = 'admin'
  AND p.name IN ('rag:admin', 'agents:admin', 'admin:users', 'admin:roles',
                 'admin:settings', 'admin:audit', 'llm:admin',
                 'deliverables:read', 'deliverables:write', 'deliverables:delete');

-- Manager gets operational permissions
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_permissions p
WHERE r.name = 'manager'
  AND p.name IN ('rag:read', 'rag:write', 'agents:execute', 'agents:manage',
                 'admin:users', 'llm:use', 'deliverables:read', 'deliverables:write');

-- Member gets standard access
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_permissions p
WHERE r.name = 'member'
  AND p.name IN ('rag:read', 'agents:execute', 'llm:use',
                 'deliverables:read', 'deliverables:write');

-- Viewer gets read-only
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_permissions p
WHERE r.name = 'viewer'
  AND p.name IN ('rag:read', 'deliverables:read');
```

---

## 4. Permission Check Logic

### 4.1 Core Permission Function

```sql
-- =============================================================================
-- PERMISSION CHECK FUNCTION
-- =============================================================================
-- Returns TRUE if user has the specified permission in the organization
-- Handles wildcards, resource scoping, and super-admin

CREATE OR REPLACE FUNCTION rbac_has_permission(
    p_user_id UUID,
    p_organization_slug VARCHAR(255),
    p_permission VARCHAR(100),
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_has_permission BOOLEAN := FALSE;
    v_permission_parts TEXT[];
    v_permission_category TEXT;
BEGIN
    -- Parse permission into category:action
    v_permission_parts := string_to_array(p_permission, ':');
    v_permission_category := v_permission_parts[1];

    -- Check for permission (including wildcards and resource scoping)
    SELECT EXISTS(
        SELECT 1
        FROM rbac_user_org_roles uor
        JOIN rbac_role_permissions rp ON uor.role_id = rp.role_id
        JOIN rbac_permissions p ON rp.permission_id = p.id
        WHERE uor.user_id = p_user_id
          -- Organization check: user's org matches OR user has global access ('*')
          AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
          -- Not expired
          AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
          -- Permission check: exact match, category wildcard, or full wildcard
          AND (
              p.name = p_permission                           -- Exact: rag:read
              OR p.name = v_permission_category || ':*'       -- Category wildcard: rag:*
              OR p.name = '*:*'                               -- Full wildcard
          )
          -- Resource scoping: NULL means all, or must match specific resource
          AND (
              rp.resource_type IS NULL                        -- No resource restriction
              OR (
                  rp.resource_type = p_resource_type
                  AND (rp.resource_id IS NULL OR rp.resource_id = p_resource_id)
              )
          )
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$;


-- =============================================================================
-- GET USER'S EFFECTIVE PERMISSIONS
-- =============================================================================
-- Returns all permissions a user has in an organization (for UI display)

CREATE OR REPLACE FUNCTION rbac_get_user_permissions(
    p_user_id UUID,
    p_organization_slug VARCHAR(255)
)
RETURNS TABLE (
    permission_name VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id UUID
)
LANGUAGE sql STABLE
AS $$
    SELECT DISTINCT
        p.name AS permission_name,
        rp.resource_type,
        rp.resource_id
    FROM rbac_user_org_roles uor
    JOIN rbac_role_permissions rp ON uor.role_id = rp.role_id
    JOIN rbac_permissions p ON rp.permission_id = p.id
    WHERE uor.user_id = p_user_id
      AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
      AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
    ORDER BY p.name;
$$;


-- =============================================================================
-- GET USER'S ROLES IN ORGANIZATION
-- =============================================================================

CREATE OR REPLACE FUNCTION rbac_get_user_roles(
    p_user_id UUID,
    p_organization_slug VARCHAR(255)
)
RETURNS TABLE (
    role_id UUID,
    role_name VARCHAR(100),
    role_display_name VARCHAR(255),
    is_global BOOLEAN,
    assigned_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT
        r.id AS role_id,
        r.name AS role_name,
        r.display_name AS role_display_name,
        (uor.organization_slug = '*') AS is_global,
        uor.assigned_at,
        uor.expires_at
    FROM rbac_user_org_roles uor
    JOIN rbac_roles r ON uor.role_id = r.id
    WHERE uor.user_id = p_user_id
      AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
      AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
    ORDER BY r.name;
$$;
```

### 4.2 TypeScript Service Layer

```typescript
// apps/api/src/rbac/rbac.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface PermissionCheck {
  permission: string;
  resourceType?: string;
  resourceId?: string;
}

@Injectable()
export class RbacService {
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
    const { data, error } = await this.supabase.client.rpc('rbac_has_permission', {
      p_user_id: userId,
      p_organization_slug: organizationSlug,
      p_permission: permission,
      p_resource_type: resourceType || null,
      p_resource_id: resourceId || null,
    });

    if (error) {
      console.error('Permission check failed:', error);
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
  ): Promise<Array<{ permission: string; resourceType?: string; resourceId?: string }>> {
    const { data, error } = await this.supabase.client.rpc('rbac_get_user_permissions', {
      p_user_id: userId,
      p_organization_slug: organizationSlug,
    });

    if (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }

    return data.map((row: any) => ({
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
  ): Promise<Array<{ id: string; name: string; displayName: string; isGlobal: boolean }>> {
    const { data, error } = await this.supabase.client.rpc('rbac_get_user_roles', {
      p_user_id: userId,
      p_organization_slug: organizationSlug,
    });

    if (error) {
      console.error('Failed to get user roles:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.role_id,
      name: row.role_name,
      displayName: row.role_display_name,
      isGlobal: row.is_global,
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
    const { data: role } = await this.supabase.client
      .from('rbac_roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    // Insert assignment
    const { error } = await this.supabase.client
      .from('rbac_user_org_roles')
      .upsert({
        user_id: targetUserId,
        organization_slug: organizationSlug,
        role_id: role.id,
        assigned_by: assignedBy,
        expires_at: expiresAt?.toISOString() || null,
      });

    if (error) {
      throw new Error(`Failed to assign role: ${error.message}`);
    }

    // Audit log
    await this.supabase.client.from('rbac_audit_log').insert({
      action: 'grant',
      actor_id: assignedBy,
      target_user_id: targetUserId,
      target_role_id: role.id,
      organization_slug: organizationSlug,
      details: { role_name: roleName, expires_at: expiresAt },
    });
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
    const { data: role } = await this.supabase.client
      .from('rbac_roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    // Delete assignment
    const { error } = await this.supabase.client
      .from('rbac_user_org_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('organization_slug', organizationSlug)
      .eq('role_id', role.id);

    if (error) {
      throw new Error(`Failed to revoke role: ${error.message}`);
    }

    // Audit log
    await this.supabase.client.from('rbac_audit_log').insert({
      action: 'revoke',
      actor_id: revokedBy,
      target_user_id: targetUserId,
      target_role_id: role.id,
      organization_slug: organizationSlug,
      details: { role_name: roleName },
    });
  }

  /**
   * Check if user is super-admin (has '*' org access)
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('rbac_user_org_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_slug', '*')
      .limit(1);

    return (data?.length ?? 0) > 0;
  }
}
```

---

## 5. API Endpoints

### 5.1 RBAC Controller

```typescript
// apps/api/src/rbac/rbac.controller.ts

@Controller('api/rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ==================== ROLES ====================

  @Get('roles')
  async getAllRoles() {
    // Returns all available roles
  }

  @Post('roles')
  @RequirePermission('admin:roles')
  async createRole(@Body() dto: CreateRoleDto) {
    // Create custom role (non-system)
  }

  // ==================== USER ROLES ====================

  @Get('users/:userId/roles')
  @RequirePermission('admin:users')
  async getUserRoles(
    @Param('userId') userId: string,
    @Query('organizationSlug') orgSlug: string,
  ) {
    return this.rbacService.getUserRoles(userId, orgSlug);
  }

  @Post('users/:userId/roles')
  @RequirePermission('admin:roles')
  async assignRole(
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: User,
  ) {
    await this.rbacService.assignRole(
      userId,
      dto.organizationSlug,
      dto.roleName,
      currentUser.id,
      dto.expiresAt,
    );
  }

  @Delete('users/:userId/roles/:roleName')
  @RequirePermission('admin:roles')
  async revokeRole(
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
    @Query('organizationSlug') orgSlug: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.rbacService.revokeRole(userId, orgSlug, roleName, currentUser.id);
  }

  // ==================== PERMISSIONS ====================

  @Get('users/:userId/permissions')
  async getUserPermissions(
    @Param('userId') userId: string,
    @Query('organizationSlug') orgSlug: string,
  ) {
    return this.rbacService.getUserPermissions(userId, orgSlug);
  }

  @Get('check')
  async checkPermission(
    @Query('permission') permission: string,
    @Query('organizationSlug') orgSlug: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @CurrentUser() currentUser: User,
  ) {
    const hasAccess = await this.rbacService.hasPermission(
      currentUser.id,
      orgSlug,
      permission,
      resourceType,
      resourceId,
    );
    return { hasPermission: hasAccess };
  }

  // ==================== AUDIT ====================

  @Get('audit')
  @RequirePermission('admin:audit')
  async getAuditLog(
    @Query('organizationSlug') orgSlug: string,
    @Query('limit') limit = 100,
  ) {
    // Return audit log entries
  }
}
```

### 5.2 Permission Guard Decorator

```typescript
// apps/api/src/rbac/decorators/require-permission.decorator.ts

export const RequirePermission = (permission: string, resourceParam?: string) => {
  return applyDecorators(
    SetMetadata('permission', permission),
    SetMetadata('resourceParam', resourceParam),
    UseGuards(RbacGuard),
  );
};

// apps/api/src/rbac/guards/rbac.guard.ts

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>('permission', context.getHandler());
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgSlug = request.headers['x-organization-slug'] || request.query.organizationSlug;

    if (!user || !orgSlug) {
      throw new ForbiddenException('Authentication required');
    }

    // Check for resource-specific permission
    const resourceParam = this.reflector.get<string>('resourceParam', context.getHandler());
    const resourceId = resourceParam ? request.params[resourceParam] : undefined;

    return this.rbacService.hasPermission(
      user.id,
      orgSlug,
      permission,
      undefined,
      resourceId,
    );
  }
}
```

---

## 6. Frontend Implementation

### 6.1 RBAC Store

```typescript
// apps/web/src/stores/rbacStore.ts

export const useRbacStore = defineStore('rbac', () => {
  const userRoles = ref<Map<string, Role[]>>(new Map());  // orgSlug -> roles
  const userPermissions = ref<Map<string, string[]>>(new Map());  // orgSlug -> permissions
  const isSuperAdmin = ref(false);

  // Load current user's roles for an organization
  async function loadUserRoles(orgSlug: string) {
    const roles = await rbacService.getUserRoles(orgSlug);
    userRoles.value.set(orgSlug, roles);
  }

  // Load current user's permissions for an organization
  async function loadUserPermissions(orgSlug: string) {
    const permissions = await rbacService.getUserPermissions(orgSlug);
    userPermissions.value.set(orgSlug, permissions.map(p => p.permission));
  }

  // Check if current user has permission
  function hasPermission(orgSlug: string, permission: string): boolean {
    const perms = userPermissions.value.get(orgSlug) || [];

    // Check exact match
    if (perms.includes(permission)) return true;

    // Check category wildcard (rag:* for rag:read)
    const category = permission.split(':')[0];
    if (perms.includes(`${category}:*`)) return true;

    // Check full wildcard
    if (perms.includes('*:*')) return true;

    return false;
  }

  // Check if user has any of the given permissions
  function hasAnyPermission(orgSlug: string, permissions: string[]): boolean {
    return permissions.some(p => hasPermission(orgSlug, p));
  }

  return {
    userRoles,
    userPermissions,
    isSuperAdmin,
    loadUserRoles,
    loadUserPermissions,
    hasPermission,
    hasAnyPermission,
  };
});
```

### 6.2 Permission Directive

```typescript
// apps/web/src/directives/permission.directive.ts

// Usage: v-permission="'rag:write'" or v-permission="['rag:write', 'rag:admin']"
export const vPermission: Directive = {
  mounted(el, binding) {
    const rbacStore = useRbacStore();
    const orgStore = useOrganizationStore();
    const orgSlug = orgStore.currentOrganization?.slug;

    if (!orgSlug) {
      el.style.display = 'none';
      return;
    }

    const permissions = Array.isArray(binding.value) ? binding.value : [binding.value];
    const hasAccess = rbacStore.hasAnyPermission(orgSlug, permissions);

    if (!hasAccess) {
      el.style.display = 'none';
    }
  },
};
```

### 6.3 Admin UI Components

#### Role Management Page
```
/app/admin/roles
- List all roles with their permissions
- Create custom roles (non-system)
- Edit role permissions
- View users assigned to each role
```

#### User Role Assignment
```
/app/admin/users/:userId/roles
- List user's roles across all organizations they belong to
- Assign/revoke roles
- Set role expiration dates
- View permission summary
```

#### Add to AdminSettingsPage
```vue
<ion-col size="12" size-md="6" size-lg="4">
  <ion-card button @click="navigateTo('/app/admin/roles')" class="action-card roles">
    <ion-card-content>
      <div class="card-icon">
        <ion-icon :icon="peopleOutline" />
      </div>
      <h3>Role Management</h3>
      <p>Manage roles and permissions</p>
    </ion-card-content>
  </ion-card>
</ion-col>
```

---

## 7. Integration with RAG

Once RBAC is implemented, RAG permissions become simple:

### 7.1 Add Permission Column to Documents

```sql
ALTER TABLE rag_documents ADD COLUMN required_permission VARCHAR(100);
-- e.g., 'rag:read:sensitive' for sensitive docs
```

### 7.2 Update RAG Search Function

```sql
CREATE OR REPLACE FUNCTION rag_search(
    p_collection_id UUID,
    p_organization_slug TEXT,
    p_user_id UUID,  -- NEW: for permission check
    p_query_embedding vector(768),
    p_top_k INTEGER DEFAULT 5,
    p_similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (...)
AS $$
    SELECT ...
    FROM rag_document_chunks c
    JOIN rag_documents d ON c.document_id = d.id
    JOIN rag_collections col ON c.collection_id = col.id
    WHERE c.collection_id = p_collection_id
      AND col.organization_slug = p_organization_slug
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
      -- Permission filter: user must have required permission for document
      AND (
          d.required_permission IS NULL
          OR rbac_has_permission(p_user_id, p_organization_slug, d.required_permission)
      )
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_top_k;
$$;
```

---

## 8. Migration Strategy (Full Replacement)

This is a **clean cutover** - we replace the old system entirely, not run both in parallel.

### 8.1 Database Migration

#### Single Migration File
```sql
-- apps/api/supabase/migrations/2025XXXX_rbac_full_replacement.sql

-- =============================================================================
-- STEP 1: Create RBAC tables (from Section 3)
-- =============================================================================
-- [Include all CREATE TABLE statements from Section 3.1]

-- =============================================================================
-- STEP 2: Seed roles and permissions (from Section 3.2)
-- =============================================================================
-- [Include all INSERT statements]

-- =============================================================================
-- STEP 3: Migrate existing user data
-- =============================================================================
INSERT INTO rbac_user_org_roles (user_id, organization_slug, role_id, assigned_by)
SELECT
    u.id,
    COALESCE(u.organization_slug, 'demo-org'),
    r.id,
    u.id
FROM public.users u
CROSS JOIN LATERAL (
    SELECT jsonb_array_elements_text(u.roles) AS old_role
) roles
JOIN rbac_roles r ON (
    CASE roles.old_role
        WHEN 'admin' THEN 'admin'
        WHEN 'developer' THEN 'manager'
        WHEN 'evaluation-monitor' THEN 'viewer'
        WHEN 'beta-tester' THEN 'member'
        WHEN 'support' THEN 'member'
        ELSE 'member'
    END = r.name
)
ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;

-- =============================================================================
-- STEP 4: Remove legacy columns
-- =============================================================================
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
ALTER TABLE public.users DROP COLUMN IF EXISTS roles;
ALTER TABLE public.users DROP COLUMN IF EXISTS namespace_access;
```

### 8.2 Backend Changes

#### DELETE These Files
| File | Reason |
|------|--------|
| `apps/api/src/auth/guards/roles.guard.ts` | Replaced by `RbacGuard` |
| `apps/api/src/auth/decorators/roles.decorator.ts` | Replaced by `@RequirePermission()` |

#### REPLACE These Files
| File | Changes |
|------|---------|
| `apps/api/src/auth/auth.service.ts` | Remove role management, use RbacService |
| `apps/api/src/auth/auth.controller.ts` | Remove `/admin/users/:id/roles` endpoints, add `/rbac/*` |
| `apps/api/src/auth/auth.module.ts` | Import RbacModule, remove RolesGuard |

#### CREATE These Files
| File | Purpose |
|------|---------|
| `apps/api/src/rbac/rbac.module.ts` | RBAC module |
| `apps/api/src/rbac/rbac.service.ts` | Permission checks, role assignment |
| `apps/api/src/rbac/rbac.controller.ts` | RBAC API endpoints |
| `apps/api/src/rbac/rbac.guard.ts` | Permission-based guard |
| `apps/api/src/rbac/decorators/require-permission.decorator.ts` | `@RequirePermission()` |

#### UPDATE All Controllers
Replace `@Roles(['admin'])` with `@RequirePermission('admin:*')` throughout:
- `AgentsAdminController`
- `EvaluationController`
- `ObservabilityStreamController`
- `AuthController` admin endpoints
- Any other protected endpoints

### 8.3 Frontend Changes

#### DELETE These Files
| File | Reason |
|------|--------|
| `apps/web/src/directives/roleGuard.ts` | Replaced by `v-permission` |
| `apps/web/src/composables/useRoleGuard.ts` | Replaced by `useRbac()` |
| `apps/web/src/components/Testing/RoleTestingPanel.vue` | Obsolete |

#### REWRITE These Files
| File | Changes |
|------|---------|
| `apps/web/src/stores/authStore.ts` | Remove `UserRole`, `Permission` enums, `ROLE_PERMISSIONS`, all permission methods. Keep only auth (login/logout/token). |
| `apps/web/src/router/index.ts` | Replace `requiresRole` with `requiresPermission` in route meta |
| `apps/web/src/views/LoginPage.vue` | Add organization selection after login |
| `apps/web/src/main.ts` | Register `v-permission`, remove `v-role-guard` |

#### CREATE These Files
| File | Purpose |
|------|---------|
| `apps/web/src/stores/rbacStore.ts` | Permissions state, `hasPermission()` |
| `apps/web/src/services/rbacService.ts` | RBAC API calls |
| `apps/web/src/directives/permission.ts` | `v-permission` directive |
| `apps/web/src/composables/useRbac.ts` | Composable for permission checks |
| `apps/web/src/views/admin/UserManagementPage.vue` | User list, invite, role assignment |
| `apps/web/src/views/admin/RoleManagementPage.vue` | Role list, permission editor |
| `apps/web/src/components/rbac/UserRoleAssignment.vue` | Assign roles to user |
| `apps/web/src/components/rbac/RolePermissionEditor.vue` | Edit role permissions |
| `apps/web/src/components/rbac/PermissionGate.vue` | Wrapper component for permission checks |

### 8.4 What Gets Removed from authStore.ts

```typescript
// DELETE all of these from authStore.ts:

export enum UserRole { ... }           // DELETE - roles come from database
export enum Permission { ... }         // DELETE - permissions come from database
const ROLE_PERMISSIONS = { ... }       // DELETE - mappings in database

// DELETE these methods:
hasRole()
hasAnyRole()
hasAllRoles()
hasPermission()
hasAnyPermission()
hasAllPermissions()
canAccessResource()
logAccessAttempt()
getAccessAttempts()

// KEEP these methods (auth only):
login()
signupAndLogin()
logout()
refreshAuthToken()
initializeAuth()
```

### 8.5 New authStore.ts (Simplified)

```typescript
// apps/web/src/stores/authStore.ts (after cleanup)
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const isAuthenticated = ref(false);
  const isLoading = ref(false);
  const currentOrganization = ref<string | null>(null);

  // Actions
  async function login(email: string, password: string) { ... }
  async function logout() { ... }
  async function refreshToken() { ... }
  async function setOrganization(orgSlug: string) {
    currentOrganization.value = orgSlug;
    // Trigger rbacStore to load permissions for this org
    const rbacStore = useRbacStore();
    await rbacStore.loadPermissions(orgSlug);
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    currentOrganization,
    login,
    logout,
    refreshToken,
    setOrganization,
  };
});
```

---

## 9. Implementation Plan (Full Replacement)

### Phase 1: Database & Backend RBAC Module (2-3 days)
- [ ] Create RBAC database migration with all tables, functions, and seed data
- [ ] Migrate existing user roles to `rbac_user_org_roles`
- [ ] Drop legacy `role`, `roles`, `namespace_access` columns from users table
- [ ] Create `apps/api/src/rbac/rbac.module.ts`
- [ ] Create `apps/api/src/rbac/rbac.service.ts`
- [ ] Create `apps/api/src/rbac/rbac.controller.ts`
- [ ] Create `apps/api/src/rbac/rbac.guard.ts`
- [ ] Create `apps/api/src/rbac/decorators/require-permission.decorator.ts`
- [ ] Delete `apps/api/src/auth/guards/roles.guard.ts`
- [ ] Delete `apps/api/src/auth/decorators/roles.decorator.ts`
- [ ] Update `auth.module.ts` to import RbacModule

### Phase 2: Backend Controller Updates (1-2 days)
- [ ] Replace all `@Roles()` decorators with `@RequirePermission()`
- [ ] Update `AgentsAdminController`
- [ ] Update `EvaluationController`
- [ ] Update `ObservabilityStreamController`
- [ ] Update `AuthController` (remove role management endpoints)
- [ ] Add organization slug header requirement to protected routes
- [ ] Test all API endpoints with new permission system

### Phase 3: Frontend RBAC Foundation (2-3 days)
- [ ] Create `apps/web/src/stores/rbacStore.ts`
- [ ] Create `apps/web/src/services/rbacService.ts`
- [ ] Create `apps/web/src/directives/permission.ts`
- [ ] Create `apps/web/src/composables/useRbac.ts`
- [ ] Rewrite `authStore.ts` (remove all permission logic, keep auth only)
- [ ] Delete `apps/web/src/directives/roleGuard.ts`
- [ ] Delete `apps/web/src/composables/useRoleGuard.ts`
- [ ] Delete `apps/web/src/components/Testing/RoleTestingPanel.vue`
- [ ] Update `main.ts` to register `v-permission`

### Phase 4: Frontend Router & Login Updates (1-2 days)
- [ ] Update `router/index.ts` - replace `requiresRole` with `requiresPermission`
- [ ] Update route guard to use rbacStore
- [ ] Update `LoginPage.vue` - add organization selection
- [ ] Add organization context to all API calls (header)
- [ ] Update `AccessDeniedPage.vue` for permission-based messages

### Phase 5: Admin UI - User Management (2-3 days)
- [ ] Create `apps/web/src/views/admin/UserManagementPage.vue`
- [ ] Create `apps/web/src/components/rbac/UserRoleAssignment.vue`
- [ ] Create `apps/web/src/components/rbac/InviteUserModal.vue`
- [ ] Add route `/app/admin/users`
- [ ] Add card to `AdminSettingsPage.vue`
- [ ] Implement user list with search/filter
- [ ] Implement role assignment UI
- [ ] Implement user invite flow
- [ ] Implement user deactivate flow

### Phase 6: Admin UI - Role Management (2-3 days)
- [ ] Create `apps/web/src/views/admin/RoleManagementPage.vue`
- [ ] Create `apps/web/src/components/rbac/RolePermissionEditor.vue`
- [ ] Create `apps/web/src/components/rbac/CreateRoleModal.vue`
- [ ] Add route `/app/admin/roles`
- [ ] Add card to `AdminSettingsPage.vue`
- [ ] Implement role list view
- [ ] Implement permission editor (checkbox grid)
- [ ] Implement custom role creation
- [ ] Create `apps/web/src/views/admin/AuditLogPage.vue`

### Phase 7: Permission Integration Across App (2-3 days)
- [ ] Add `v-permission` to all admin UI elements
- [ ] Update sidebar/menu to show/hide based on permissions
- [ ] Add `v-permission` to action buttons throughout app
- [ ] Add `PermissionGate.vue` wrapper component
- [ ] Test all permission flows end-to-end
- [ ] Verify super-admin can access all orgs

### Phase 8: RAG Integration (1-2 days)
- [ ] Add `required_permission VARCHAR(100)` to `rag_documents` table
- [ ] Update `rag_search` function to filter by permission
- [ ] Add permission selector to document upload UI
- [ ] Add collection-level default permission setting
- [ ] Test document access filtering

**Total Estimated Time: 14-21 days**

---

## 10. Testing Checklist

### Permission Logic
- [ ] User with exact permission can access resource
- [ ] User with category wildcard (rag:*) can access resource
- [ ] User with full wildcard (*:*) can access everything
- [ ] User without permission is denied
- [ ] Super-admin (org = '*') can access all organizations
- [ ] Expired role assignments are ignored
- [ ] Resource-scoped permissions work correctly

### Multi-Org
- [ ] User sees correct roles per organization
- [ ] Switching organizations updates permissions
- [ ] Super-admin sees all organizations

### UI
- [ ] v-permission hides unauthorized elements
- [ ] Role management CRUD works
- [ ] Audit log displays changes

---

## 10. Security Considerations

1. **Permission checks are server-side** - Frontend hiding is UX only, real enforcement is in API
2. **Audit logging** - All permission changes are logged
3. **No permission inheritance by default** - Explicit assignment required
4. **Super-admin is powerful** - Limit who gets `organization_slug = '*'`
5. **JWT doesn't contain permissions** - Always check database for current state
