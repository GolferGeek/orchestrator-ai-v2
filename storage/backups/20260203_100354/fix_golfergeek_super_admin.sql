-- Fix golfergeek super admin status
-- Run this against the Supabase database

-- ============================================
-- 1. Fix auth.users.is_super_admin flag
-- ============================================
UPDATE auth.users
SET is_super_admin = true,
    updated_at = now()
WHERE email = 'golfergeek@orchestratorai.io';

-- Verify the update
SELECT id, email, is_super_admin, raw_user_meta_data
FROM auth.users
WHERE email = 'golfergeek@orchestratorai.io';

-- ============================================
-- 2. Update rbac_user_org_roles to use consistent role IDs
--    (Use the newer Jan 24 role IDs that nick/justin use)
-- ============================================

-- First, let's see what golfergeek currently has
-- SELECT * FROM public.rbac_user_org_roles WHERE user_id = 'c4d5e6f7-8901-2345-6789-abcdef012345';

-- Update golfergeek's global super-admin assignment to use the newer role ID
UPDATE public.rbac_user_org_roles
SET role_id = '82c01882-ad05-4f4e-9d15-fb54d3b5f361'  -- newer super-admin role
WHERE user_id = 'c4d5e6f7-8901-2345-6789-abcdef012345'
  AND organization_slug = '*'
  AND role_id = '709bb369-5251-4e11-ad43-63f77cb6bb53';  -- older super-admin role

-- Update golfergeek's org-specific super-admin assignments to use the newer role ID
UPDATE public.rbac_user_org_roles
SET role_id = '82c01882-ad05-4f4e-9d15-fb54d3b5f361'  -- newer super-admin role
WHERE user_id = 'c4d5e6f7-8901-2345-6789-abcdef012345'
  AND role_id = '709bb369-5251-4e11-ad43-63f77cb6bb53';  -- older super-admin role

-- ============================================
-- 3. (Optional) Clean up duplicate roles
--    Only run this if you want to consolidate to a single set of roles
-- ============================================

-- First migrate ALL user assignments from old to new role IDs
-- UPDATE public.rbac_user_org_roles SET role_id = '82c01882-ad05-4f4e-9d15-fb54d3b5f361' WHERE role_id = '709bb369-5251-4e11-ad43-63f77cb6bb53';  -- super-admin
-- UPDATE public.rbac_user_org_roles SET role_id = '23d58029-a5f6-4d42-9c1d-8ae516ac0a61' WHERE role_id = 'd7470957-feb0-4a61-8ec3-880d8f66fa30';  -- admin
-- UPDATE public.rbac_user_org_roles SET role_id = 'a9dd244c-b7a7-4c6e-9bb5-b2c35fc6f327' WHERE role_id = '8cee563a-d6d4-4169-bac6-3539637b4557';  -- manager
-- UPDATE public.rbac_user_org_roles SET role_id = '4889c5ad-632c-4bc4-9da4-405e8777b9bb' WHERE role_id = 'e6b97018-a7c1-4cb7-9df4-84259b9db12a';  -- member
-- UPDATE public.rbac_user_org_roles SET role_id = 'd990c247-760e-453a-b7d1-10aab5bf9fd0' WHERE role_id = '55eaebb9-0f47-4f78-824a-1f187749f848';  -- viewer

-- Then delete the old roles (after migrating permissions too)
-- DELETE FROM public.rbac_roles WHERE id IN ('709bb369-5251-4e11-ad43-63f77cb6bb53', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '8cee563a-d6d4-4169-bac6-3539637b4557', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', '55eaebb9-0f47-4f78-824a-1f187749f848');

-- ============================================
-- 4. Verification queries
-- ============================================

-- Verify golfergeek's auth.users record
SELECT 'auth.users' as table_name, id, email, is_super_admin
FROM auth.users
WHERE email = 'golfergeek@orchestratorai.io';

-- Verify golfergeek's RBAC role assignments
SELECT
    'rbac_user_org_roles' as table_name,
    uor.organization_slug,
    r.name as role_name,
    r.id as role_id
FROM public.rbac_user_org_roles uor
JOIN public.rbac_roles r ON r.id = uor.role_id
WHERE uor.user_id = 'c4d5e6f7-8901-2345-6789-abcdef012345';

-- Compare with other super admins (nick and justin)
SELECT
    u.email,
    u.is_super_admin,
    uor.organization_slug,
    r.name as role_name
FROM auth.users u
LEFT JOIN public.rbac_user_org_roles uor ON uor.user_id = u.id
LEFT JOIN public.rbac_roles r ON r.id = uor.role_id
WHERE u.email IN ('golfergeek@orchestratorai.io', 'nick@orchestratorai.io', 'justin@orchestratorai.io')
  AND (uor.organization_slug = '*' OR uor.organization_slug IS NULL)
ORDER BY u.email;
