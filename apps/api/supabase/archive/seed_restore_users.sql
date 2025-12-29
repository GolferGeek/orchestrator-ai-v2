-- =============================================================================
-- Restore Users from Backup (2025-12-25)
-- =============================================================================

-- Insert auth.users (using UPSERT to avoid conflicts)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'd514cc64-448a-4330-a942-36df57875f0c', 'authenticated', 'authenticated', 'justin@orchestratorai.io', '$2a$06$.W0xJ8aX0N.UUlU7lGwZMu4bSFrPCQ/W0FfozmYfqIW1woPRcUJzq', '2025-12-24 15:20:13.022863+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"display_name": "Justin"}', true, '2025-12-24 15:20:13.022863+00', '2025-12-24 15:20:13.022863+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
  ('00000000-0000-0000-0000-000000000000', '4691ce47-56a3-4453-8f11-de9a361475c1', 'authenticated', 'authenticated', 'nick@orchestratorai.io', '$2a$06$XPBJA1MSB075oz2DClw5KeXKtnYGkeXR7t1nqGwCWwq1MQJp8fqDi', '2025-12-24 15:20:13.022863+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"display_name": "Nick"}', true, '2025-12-24 15:20:13.022863+00', '2025-12-24 15:20:13.022863+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
  ('00000000-0000-0000-0000-000000000000', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'authenticated', 'authenticated', 'admin@orchestratorai.io', '$2a$06$ya9CLkT9qtkauKlIrGqOVOokKvMDwyEZdJpEXe5FTPYJjBZOaSufa', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-01 23:16:18.114918+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Admin User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-01 23:16:18.117028+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
  ('00000000-0000-0000-0000-000000000000', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'authenticated', 'authenticated', 'demo.user@orchestratorai.io', '$2a$06$Yw9Qp97fHSSuHYAixrJTaOTSeKv2ccZsmudH.crWoHRD5yvxRzDNm', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-02 13:15:21.516136+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Demo User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-02 13:15:21.517592+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
  ('00000000-0000-0000-0000-000000000000', '618f3960-a8be-4c67-855f-aae4130699b8', 'authenticated', 'authenticated', 'golfergeek@orchestratorai.io', '$2a$06$GUExJYQlTNRePpmayGMlxexg6J5tze6htaEMSZdCZn9MEOtf5Y0o6', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-24 21:02:41.100059+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "GolferGeek"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-25 15:29:37.553556+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Insert public.users (using UPSERT to avoid conflicts)
INSERT INTO public.users (id, email, display_name, created_at, updated_at, status, organization_slug)
VALUES
  ('493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo.user@orchestratorai.io', 'Demo User', '2025-10-12 18:39:12.714052+00', '2025-12-04 21:15:39.951579+00', 'active', 'demo-org'),
  ('739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'admin@orchestratorai.io', 'Admin', '2025-10-09 19:28:38.352108+00', '2025-12-04 21:15:39.951579+00', 'active', 'demo-org'),
  ('618f3960-a8be-4c67-855f-aae4130699b8', 'golfergeek@orchestratorai.io', 'GolferGeek', '2025-10-09 19:28:38.352108+00', '2025-10-09 19:28:38.352108+00', 'active', 'demo-org'),
  ('d514cc64-448a-4330-a942-36df57875f0c', 'justin@orchestratorai.io', 'Justin', '2025-12-04 18:51:46.764751+00', '2025-12-04 18:51:46.764751+00', 'active', 'demo-org'),
  ('4691ce47-56a3-4453-8f11-de9a361475c1', 'nick@orchestratorai.io', 'Nick', '2025-12-04 18:51:46.764751+00', '2025-12-04 18:51:46.764751+00', 'active', 'demo-org')
ON CONFLICT (id) DO NOTHING;

-- Insert orch_flow.profiles for these users (for orch-flow app)
INSERT INTO orch_flow.profiles (id, display_name, created_at, updated_at)
VALUES
  ('493101fa-8892-4de4-a0f9-daf43afdca1f', 'Demo User', NOW(), NOW()),
  ('739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'Admin', NOW(), NOW()),
  ('618f3960-a8be-4c67-855f-aae4130699b8', 'GolferGeek', NOW(), NOW()),
  ('d514cc64-448a-4330-a942-36df57875f0c', 'Justin', NOW(), NOW()),
  ('4691ce47-56a3-4453-8f11-de9a361475c1', 'Nick', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Ensure super-admin roles are assigned
INSERT INTO public.rbac_user_org_roles (user_id, organization_slug, role_id, assigned_by, assigned_at)
SELECT
  u.id,
  'demo-org',
  (SELECT id FROM public.rbac_roles WHERE name = 'super-admin'),
  u.id,
  NOW()
FROM auth.users u
WHERE u.email IN ('justin@orchestratorai.io', 'nick@orchestratorai.io', 'golfergeek@orchestratorai.io')
ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;

-- Also assign to admin users
INSERT INTO public.rbac_user_org_roles (user_id, organization_slug, role_id, assigned_by, assigned_at)
SELECT
  u.id,
  'demo-org',
  (SELECT id FROM public.rbac_roles WHERE name = 'admin'),
  u.id,
  NOW()
FROM auth.users u
WHERE u.email IN ('admin@orchestratorai.io')
ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;

-- Assign user role to demo user
INSERT INTO public.rbac_user_org_roles (user_id, organization_slug, role_id, assigned_by, assigned_at)
SELECT
  u.id,
  'demo-org',
  (SELECT id FROM public.rbac_roles WHERE name = 'user'),
  u.id,
  NOW()
FROM auth.users u
WHERE u.email IN ('demo.user@orchestratorai.io')
ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;

SELECT 'Users restored successfully!' as status;
