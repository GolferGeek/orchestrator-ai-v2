-- =============================================================================
-- USERS SEED DATA
-- =============================================================================
-- Create users in both auth.users and public.users tables
-- NOTE: Must insert into auth.users FIRST due to foreign key constraint
-- =============================================================================

-- Insert into auth.users (Supabase auth) - MUST BE FIRST
-- Note: These are simplified entries - in production, Supabase Auth handles this
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change_token_current,
  email_change_token_new
) VALUES
(
  'b29a590e-b07f-49df-a25b-574c956b5035',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo.user@orchestratorai.io',
  '$2b$10$98Q4nSoIqHUwGKHVPDZqPOjaNPGLZ65bsaqb/JgiG.gwezDhwh.sq', -- 'DemoUser123!'
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Demo User"}'::jsonb,
  false,
  '',
  '',
  ''
),
(
  'b894f14e-1937-4831-8b1e-195e7535d859',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'golfergeek@golfergeek.com',
  '$2b$10$zftAWbxm65LYVAQghYQ/mewjwsizSRb7KWygYpCha0zjtq.bHlSSe', -- 'GolferGeek123!'
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"],"role":"superadmin"}'::jsonb,
  '{"display_name":"GolferGeek"}'::jsonb,
  true,
  '',
  '',
  ''
),
(
  '43432813-7b99-44c0-b094-7c7f20305939',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test.user@example.com',
  '$2b$10$a4wFYH9op4BDmLti5RbspObE58klBgS3cYi9t9bh65.FMSR.dQ3Om', -- 'Admin123!'
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Test User"}'::jsonb,
  false,
  '',
  '',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = NOW(),
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  is_super_admin = EXCLUDED.is_super_admin;

-- Insert into public.users (application users) - AFTER auth.users
INSERT INTO public.users (id, email, display_name, role, roles, namespace_access, organization_slug, status) VALUES
(
  'b29a590e-b07f-49df-a25b-574c956b5035',
  'demo.user@orchestratorai.io',
  'Demo User',
  'admin',
  '["admin", "user"]'::jsonb,
  '["demo-org", "global"]'::jsonb,
  'demo-org',
  'active'
),
(
  'b894f14e-1937-4831-8b1e-195e7535d859',
  'golfergeek@golfergeek.com',
  'GolferGeek',
  'superadmin',
  '["superadmin", "admin", "user"]'::jsonb,
  '["golfergeek", "global", "hiverarchy", "ifm", "demo-org"]'::jsonb,
  'golfergeek',
  'active'
),
(
  '43432813-7b99-44c0-b094-7c7f20305939',
  'test.user@example.com',
  'Test User',
  'user',
  '["user"]'::jsonb,
  '["demo-org"]'::jsonb,
  'demo-org',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  roles = EXCLUDED.roles,
  namespace_access = EXCLUDED.namespace_access,
  organization_slug = EXCLUDED.organization_slug,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Verification
DO $$
DECLARE
  public_user_count INTEGER;
  auth_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_user_count FROM public.users;
  SELECT COUNT(*) INTO auth_user_count FROM auth.users WHERE id IN (
    'b29a590e-b07f-49df-a25b-574c956b5035',
    'b894f14e-1937-4831-8b1e-195e7535d859',
    '43432813-7b99-44c0-b094-7c7f20305939'
  );

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Users seeded:';
  RAISE NOTICE '  public.users: %', public_user_count;
  RAISE NOTICE '  auth.users: %', auth_user_count;
  RAISE NOTICE '================================================';

  IF public_user_count < 3 THEN
    RAISE EXCEPTION 'Expected at least 3 public users, found %', public_user_count;
  END IF;

  IF auth_user_count < 3 THEN
    RAISE EXCEPTION 'Expected at least 3 auth users, found %', auth_user_count;
  END IF;

  RAISE NOTICE 'All users seeded successfully ✓';
END $$;
