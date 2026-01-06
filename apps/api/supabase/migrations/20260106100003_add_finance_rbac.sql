-- =============================================================================
-- Finance RBAC Permission Setup
-- =============================================================================
-- Adds finance:admin permission to the RBAC system and grants it to the
-- admin role for the finance organization
-- =============================================================================

-- =============================================================================
-- 1. Add finance:admin permission
-- =============================================================================
INSERT INTO public.rbac_permissions (name, display_name, description, category)
VALUES (
    'finance:admin',
    'Administer Finance',
    'Manage finance universes, recommendations, and outcomes',
    'finance'
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- =============================================================================
-- 2. Grant finance:admin permission to admin role
-- =============================================================================
INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.rbac_roles r
CROSS JOIN public.rbac_permissions p
WHERE r.name = 'admin'
AND p.name = 'finance:admin'
ON CONFLICT (role_id, permission_id, resource_type, resource_id) DO NOTHING;

-- =============================================================================
-- 3. Verification
-- =============================================================================
DO $$
DECLARE
    permission_count INTEGER;
    role_permission_count INTEGER;
    user_access_count INTEGER;
BEGIN
    -- Check permission was created
    SELECT COUNT(*) INTO permission_count
    FROM public.rbac_permissions
    WHERE name = 'finance:admin';

    -- Check role has permission
    SELECT COUNT(*) INTO role_permission_count
    FROM public.rbac_role_permissions rp
    JOIN public.rbac_roles r ON rp.role_id = r.id
    JOIN public.rbac_permissions p ON rp.permission_id = p.id
    WHERE r.name = 'admin' AND p.name = 'finance:admin';

    -- Check users with admin role in finance org (should have access through role)
    SELECT COUNT(*) INTO user_access_count
    FROM public.rbac_user_org_roles uor
    JOIN public.rbac_roles r ON uor.role_id = r.id
    WHERE uor.organization_slug = 'finance' AND r.name = 'admin';

    RAISE NOTICE '================================================';
    RAISE NOTICE 'Finance RBAC Permission Setup Complete';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'finance:admin permission created: %', permission_count;
    RAISE NOTICE 'admin role has finance:admin permission: %', role_permission_count;
    RAISE NOTICE 'Users with admin role in finance org: %', user_access_count;
    RAISE NOTICE '================================================';

    -- Validate expected state
    IF permission_count != 1 THEN
        RAISE EXCEPTION 'Expected 1 finance:admin permission, found %', permission_count;
    END IF;

    IF role_permission_count != 1 THEN
        RAISE EXCEPTION 'Expected admin role to have finance:admin permission, found % assignments', role_permission_count;
    END IF;

    IF user_access_count < 1 THEN
        RAISE WARNING 'No users have admin role in finance org. Consider adding users via rbac_user_org_roles.';
    END IF;
END $$;
