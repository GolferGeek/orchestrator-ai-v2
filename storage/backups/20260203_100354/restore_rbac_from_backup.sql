-- Restore all RBAC records from backup
-- Run this against the Supabase database
-- Uses ON CONFLICT to avoid duplicates

BEGIN;

-- ============================================
-- 1. RBAC Permissions (19 records)
-- ============================================
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at)
VALUES
  ('69658475-31df-4ac8-8b8c-9e6feafb22a8', '*:*', 'Full Access', 'Complete access to everything', 'system', '2026-01-18 13:29:29.397453+00'),
  ('06914f5c-99bf-43e3-aeb9-9b54c002c7b1', 'rag:read', 'Read RAG', 'Query RAG collections and view documents', 'rag', '2026-01-18 13:29:29.397453+00'),
  ('a97db32e-4c3b-471b-93fb-8382fcf4dc48', 'rag:write', 'Write RAG', 'Upload documents and manage collections', 'rag', '2026-01-18 13:29:29.397453+00'),
  ('31a74cdf-4ca9-4344-a411-af3cfdf3e80b', 'rag:delete', 'Delete RAG', 'Delete documents and collections', 'rag', '2026-01-18 13:29:29.397453+00'),
  ('86b20e2e-5284-4468-a2ca-f5fd9cf258e3', 'rag:admin', 'Administer RAG', 'Full RAG administration', 'rag', '2026-01-18 13:29:29.397453+00'),
  ('4b67a8ae-3678-4165-8346-b7c69c23789a', 'agents:execute', 'Execute Agents', 'Run agent conversations', 'agents', '2026-01-18 13:29:29.397453+00'),
  ('2ec24854-14bc-4172-a349-01c043103d2a', 'agents:manage', 'Manage Agents', 'Create and configure agents', 'agents', '2026-01-18 13:29:29.397453+00'),
  ('097ed81b-aa08-4850-bb4b-cbb20e36600b', 'agents:admin', 'Administer Agents', 'Full agent administration', 'agents', '2026-01-18 13:29:29.397453+00'),
  ('91afbb48-3cb0-494d-b6ad-5edb05e0cc29', 'admin:users', 'Manage Users', 'Invite and manage organization users', 'admin', '2026-01-18 13:29:29.397453+00'),
  ('321bbf45-6439-4bb3-8381-d4da657ecfa3', 'admin:roles', 'Manage Roles', 'Assign roles to users', 'admin', '2026-01-18 13:29:29.397453+00'),
  ('404c87e8-6a7e-4f72-ade9-c90cd0fd9a19', 'admin:settings', 'Manage Settings', 'Configure organization settings', 'admin', '2026-01-18 13:29:29.397453+00'),
  ('82753778-f1ce-4a3f-b56c-bf4dbf73d046', 'admin:billing', 'Manage Billing', 'View and manage billing', 'admin', '2026-01-18 13:29:29.397453+00'),
  ('348ec28f-1cb4-4602-9b4e-1711c05551bf', 'admin:audit', 'View Audit Logs', 'Access audit and usage logs', 'admin', '2026-01-18 13:29:29.397453+00'),
  ('7ed97c78-42d2-49ba-aae7-eca113b4b67c', 'llm:use', 'Use LLM', 'Make LLM API calls', 'llm', '2026-01-18 13:29:29.397453+00'),
  ('56e2cce0-4577-4958-a676-4bc54b5eae86', 'llm:admin', 'Administer LLM', 'Configure models and usage limits', 'llm', '2026-01-18 13:29:29.397453+00'),
  ('d1f63d62-e6ce-4307-85eb-198e4bf46129', 'deliverables:read', 'Read Deliverables', 'View deliverables', 'deliverables', '2026-01-18 13:29:29.397453+00'),
  ('855a4193-5c45-4eab-8f8a-ce84787ebe69', 'deliverables:write', 'Write Deliverables', 'Create and edit deliverables', 'deliverables', '2026-01-18 13:29:29.397453+00'),
  ('2e29531e-00e6-4395-abc0-03161f6cff8a', 'deliverables:delete', 'Delete Deliverables', 'Delete deliverables', 'deliverables', '2026-01-18 13:29:29.397453+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. RBAC Roles (10 records - 2 sets)
-- ============================================
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at)
VALUES
  -- Newer set (Jan 24)
  ('82c01882-ad05-4f4e-9d15-fb54d3b5f361', 'super-admin', 'Super Administrator', 'Full access to all organizations and resources', true, '2026-01-24 00:27:57.312315+00', '2026-01-24 00:27:57.312315+00'),
  ('23d58029-a5f6-4d42-9c1d-8ae516ac0a61', 'admin', 'Administrator', 'Full access within assigned organization', true, '2026-01-24 00:27:57.312315+00', '2026-01-24 00:27:57.312315+00'),
  ('a9dd244c-b7a7-4c6e-9bb5-b2c35fc6f327', 'manager', 'Manager', 'Can manage users and resources within organization', true, '2026-01-24 00:27:57.312315+00', '2026-01-24 00:27:57.312315+00'),
  ('4889c5ad-632c-4bc4-9da4-405e8777b9bb', 'member', 'Member', 'Standard access within organization', true, '2026-01-24 00:27:57.312315+00', '2026-01-24 00:27:57.312315+00'),
  ('d990c247-760e-453a-b7d1-10aab5bf9fd0', 'viewer', 'Viewer', 'Read-only access within organization', true, '2026-01-24 00:27:57.312315+00', '2026-01-24 00:27:57.312315+00'),
  -- Older set (Jan 18)
  ('709bb369-5251-4e11-ad43-63f77cb6bb53', 'super-admin', 'Super Administrator', 'Full access to all organizations and resources', true, '2026-01-18 13:29:29.397453+00', '2026-01-18 13:29:29.397453+00'),
  ('d7470957-feb0-4a61-8ec3-880d8f66fa30', 'admin', 'Administrator', 'Full access within assigned organization', true, '2026-01-18 13:29:29.397453+00', '2026-01-18 13:29:29.397453+00'),
  ('8cee563a-d6d4-4169-bac6-3539637b4557', 'manager', 'Manager', 'Can manage users and resources within organization', true, '2026-01-18 13:29:29.397453+00', '2026-01-18 13:29:29.397453+00'),
  ('e6b97018-a7c1-4cb7-9df4-84259b9db12a', 'member', 'Member', 'Standard access within organization', true, '2026-01-18 13:29:29.397453+00', '2026-01-18 13:29:29.397453+00'),
  ('55eaebb9-0f47-4f78-824a-1f187749f848', 'viewer', 'Viewer', 'Read-only access within organization', true, '2026-01-18 13:29:29.397453+00', '2026-01-18 13:29:29.397453+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. RBAC Role Permissions (30 records)
-- ============================================
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at)
VALUES
  -- super-admin (older) gets full access
  ('f2cfbb36-99be-43ee-b990-98c5e4ff0ec5', '709bb369-5251-4e11-ad43-63f77cb6bb53', '69658475-31df-4ac8-8b8c-9e6feafb22a8', NULL, NULL, '2026-01-18 13:29:29.397453+00'),

  -- admin (older) permissions
  ('7cd4a7fa-6c3e-4a28-ab95-66e0d437a6b1', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '86b20e2e-5284-4468-a2ca-f5fd9cf258e3', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('ecc5139b-1869-40f5-a739-67957114dbaf', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '097ed81b-aa08-4850-bb4b-cbb20e36600b', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('cf244bfa-5160-417c-a04e-5146a7efa88e', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '91afbb48-3cb0-494d-b6ad-5edb05e0cc29', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('d21016e5-ce31-4b14-ab09-8db644d4ad5a', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '321bbf45-6439-4bb3-8381-d4da657ecfa3', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('eb4cd5e6-f848-46e3-8a0c-f3d6b3af4db5', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '404c87e8-6a7e-4f72-ade9-c90cd0fd9a19', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('25cabbf9-61c7-4d0b-8a02-99a16303120c', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '348ec28f-1cb4-4602-9b4e-1711c05551bf', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('cbc0ccd2-e355-4af6-a917-bdd2b15b18fd', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '56e2cce0-4577-4958-a676-4bc54b5eae86', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('9efe1e70-bf1c-4e4b-9669-964ed6eb96bb', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', 'd1f63d62-e6ce-4307-85eb-198e4bf46129', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('f1b6696d-1267-494b-80e0-d06d54607a30', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '855a4193-5c45-4eab-8f8a-ce84787ebe69', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('855ab8ea-1cce-4b0d-bfff-92cffa9a6666', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '2e29531e-00e6-4395-abc0-03161f6cff8a', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('8ea8863f-1972-49fb-96b2-58dd9fca06b2', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', '7ed97c78-42d2-49ba-aae7-eca113b4b67c', NULL, NULL, '2026-01-18 13:29:29.46836+00'),

  -- manager (older) permissions
  ('317b3981-645e-4cdf-aaf9-9b62f3c3f43c', '8cee563a-d6d4-4169-bac6-3539637b4557', '06914f5c-99bf-43e3-aeb9-9b54c002c7b1', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('59dc1583-81aa-4ee5-b3f5-0356b582c408', '8cee563a-d6d4-4169-bac6-3539637b4557', 'a97db32e-4c3b-471b-93fb-8382fcf4dc48', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('074b309c-c21c-4f9c-b7c6-d6519f98a82c', '8cee563a-d6d4-4169-bac6-3539637b4557', '4b67a8ae-3678-4165-8346-b7c69c23789a', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('4f1bb44f-52c1-4eee-8ac4-b99422f69fde', '8cee563a-d6d4-4169-bac6-3539637b4557', '2ec24854-14bc-4172-a349-01c043103d2a', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('a3655e6c-539b-4d53-acca-ac7abb0339a3', '8cee563a-d6d4-4169-bac6-3539637b4557', '91afbb48-3cb0-494d-b6ad-5edb05e0cc29', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('d7f6a6a8-72fa-4d5c-8006-4712ec1eeb47', '8cee563a-d6d4-4169-bac6-3539637b4557', '7ed97c78-42d2-49ba-aae7-eca113b4b67c', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('5fb89f68-31b6-4d40-85c0-e6e7b2ccad78', '8cee563a-d6d4-4169-bac6-3539637b4557', 'd1f63d62-e6ce-4307-85eb-198e4bf46129', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('5b20b890-cc29-404e-b446-296aac2830e8', '8cee563a-d6d4-4169-bac6-3539637b4557', '855a4193-5c45-4eab-8f8a-ce84787ebe69', NULL, NULL, '2026-01-18 13:29:29.397453+00'),

  -- member (older) permissions
  ('a76b7dc0-e9b3-4273-ae46-7c60ee50e78a', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', '06914f5c-99bf-43e3-aeb9-9b54c002c7b1', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('7622b536-4574-4dac-902c-f2824706ee15', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', '4b67a8ae-3678-4165-8346-b7c69c23789a', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('e3bdf2da-d07f-4ba6-8b59-08fb88db6afd', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', '7ed97c78-42d2-49ba-aae7-eca113b4b67c', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('bfeb8c0d-be75-4c41-a0af-ee259daf671b', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', 'd1f63d62-e6ce-4307-85eb-198e4bf46129', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('1192f226-f0ad-4e3e-833b-c0594d2c2d73', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', '855a4193-5c45-4eab-8f8a-ce84787ebe69', NULL, NULL, '2026-01-18 13:29:29.397453+00'),

  -- viewer (older) permissions
  ('447088b8-b7f7-4226-9be6-0720ede24605', '55eaebb9-0f47-4f78-824a-1f187749f848', '06914f5c-99bf-43e3-aeb9-9b54c002c7b1', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('3288f2a3-716f-4a5a-b7d0-c8dd48e0c80f', '55eaebb9-0f47-4f78-824a-1f187749f848', 'd1f63d62-e6ce-4307-85eb-198e4bf46129', NULL, NULL, '2026-01-18 13:29:29.397453+00'),
  ('af868800-2db4-4e1f-a091-1a52bd327322', '55eaebb9-0f47-4f78-824a-1f187749f848', '7ed97c78-42d2-49ba-aae7-eca113b4b67c', NULL, NULL, '2026-01-18 13:29:29.46758+00'),
  ('98ab5247-916d-4937-a928-4e2fcdb7b1e2', '55eaebb9-0f47-4f78-824a-1f187749f848', '4b67a8ae-3678-4165-8346-b7c69c23789a', NULL, NULL, '2026-01-18 13:29:29.46758+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. RBAC User Org Roles (30 records)
-- ============================================
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at)
VALUES
  -- Justin (cd5faf70) - super-admin globally and specific orgs
  ('4fa1cdd6-75b3-4383-a156-2bc982729c1f', 'cd5faf70-408d-4e57-a882-9f442fc1a89d', '*', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.373237+00', NULL),
  ('a61fedb7-98aa-49de-880b-b980f32f995c', 'cd5faf70-408d-4e57-a882-9f442fc1a89d', 'legal', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.612462+00', NULL),
  ('c206f3d5-530a-4768-bf21-82f6aaf88957', 'cd5faf70-408d-4e57-a882-9f442fc1a89d', 'marketing', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.613627+00', NULL),

  -- Nick (147fdb77) - super-admin globally and specific orgs
  ('3920e3c7-ca27-41b9-bf36-84034664c779', '147fdb77-e6dc-4d4b-be0a-3b8a71a5c312', '*', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.373237+00', NULL),
  ('518865f9-3169-44ca-8ac2-7bff43e449d5', '147fdb77-e6dc-4d4b-be0a-3b8a71a5c312', 'legal', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.612462+00', NULL),
  ('a1530834-1fcb-4ac8-addf-ae97765808ed', '147fdb77-e6dc-4d4b-be0a-3b8a71a5c312', 'marketing', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, '2026-01-24 00:27:57.613627+00', NULL),

  -- Josh (a1b2c3d4-e5f6-4a5b) - admin for golfergeek org
  ('4f184471-e32b-4400-8aa4-a607eaf30752', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'golfergeek', '23d58029-a5f6-4d42-9c1d-8ae516ac0a61', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '2026-01-24 00:27:57.571075+00', NULL),
  ('eeddbc07-74a4-4315-af5d-c411f1649f66', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'golfergeek', 'd7470957-feb0-4a61-8ec3-880d8f66fa30', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '2026-01-18 13:29:29.575417+00', NULL),

  -- Older user records (ee84cda7 = justin old?, 1007c1f9 = nick old?)
  ('bd962e0e-871e-4280-9ded-a396c3cd9d91', 'ee84cda7-f4bd-442e-94cf-49c81597cfc3', '*', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.455014+00', NULL),
  ('a6616ddb-b34f-456c-bb0c-1658c6901179', '1007c1f9-0105-4a2b-b38a-22be4f2b35b1', '*', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.455014+00', NULL),
  ('42b94c47-8b22-41ba-9517-d50629135923', 'ee84cda7-f4bd-442e-94cf-49c81597cfc3', 'legal', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.59508+00', NULL),
  ('e04b931d-73ef-481e-a9d6-eddbbcf2be97', '1007c1f9-0105-4a2b-b38a-22be4f2b35b1', 'legal', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.59508+00', NULL),
  ('b3980b40-768b-4ac5-94cb-08052e3bfbd8', 'ee84cda7-f4bd-442e-94cf-49c81597cfc3', 'marketing', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.595899+00', NULL),
  ('4014bccd-cca6-4902-8d88-4ddb0721ebff', '1007c1f9-0105-4a2b-b38a-22be4f2b35b1', 'marketing', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-18 13:29:29.595899+00', NULL),

  -- GolferGeek (c4d5e6f7) - super-admin globally and multiple orgs
  ('9b0c4a66-978d-4dff-9b32-6c8c5407a1fb', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'marketing', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.202026+00', NULL),
  ('8bb37067-bc31-4568-9bec-fa2890eaf11c', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'finance', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.202026+00', NULL),
  ('f4c1064c-fc3f-4fd1-943f-197642f185d8', 'c4d5e6f7-8901-2345-6789-abcdef012345', '*', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.202026+00', NULL),
  ('f1f698a9-611a-47b2-b32a-a9f174893b94', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'engineering', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.202026+00', NULL),
  ('e29d4a7a-1508-45fe-9c62-40e6f579b017', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'legal', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.202026+00', NULL),

  -- Admin user (a1b2c3d4-e5f6-7890) - super-admin globally and multiple orgs
  ('4efff75e-273d-4b26-93b8-2d1d15a57352', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'marketing', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.354321+00', NULL),
  ('d18c500e-c139-41c0-a4b5-e8c4cc46953a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'finance', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.354321+00', NULL),
  ('afd1f986-6e44-4fa8-a125-d27e3a4c6651', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '*', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.354321+00', NULL),
  ('117286c8-690f-40eb-a2e8-c9ca6f4f188c', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'engineering', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.354321+00', NULL),
  ('2afee6b5-e5ec-4ee4-8fc6-431f38bbdc70', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'legal', '709bb369-5251-4e11-ad43-63f77cb6bb53', NULL, '2026-01-19 21:29:38.354321+00', NULL),

  -- Demo user (b29a590e) - member role in multiple orgs
  ('bfd107d4-c185-4f02-966c-2a4cf0311aa1', 'b29a590e-b07f-49df-a25b-574c956b5035', 'engineering', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', NULL, '2026-01-19 21:29:38.510941+00', NULL),
  ('a843aa64-4852-40db-b00e-5a34662154f8', 'b29a590e-b07f-49df-a25b-574c956b5035', 'legal', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', NULL, '2026-01-19 21:29:38.510941+00', NULL),
  ('c4f7dae2-0aa1-4061-8400-d2d559edc9da', 'b29a590e-b07f-49df-a25b-574c956b5035', '*', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', NULL, '2026-01-19 21:29:38.510941+00', NULL),
  ('06d7402f-1d2e-4a7f-9a45-39466739c442', 'b29a590e-b07f-49df-a25b-574c956b5035', 'marketing', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', NULL, '2026-01-19 21:29:38.510941+00', NULL),
  ('db38ad88-e4c0-4680-b4f3-4c2e04819e51', 'b29a590e-b07f-49df-a25b-574c956b5035', 'finance', 'e6b97018-a7c1-4cb7-9df4-84259b9db12a', NULL, '2026-01-19 21:29:38.510941+00', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. Also add golfergeek with NEWER super-admin role for consistency
-- ============================================
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at)
VALUES
  (gen_random_uuid(), 'c4d5e6f7-8901-2345-6789-abcdef012345', '*', '82c01882-ad05-4f4e-9d15-fb54d3b5f361', NULL, now(), NULL)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
SELECT 'rbac_permissions' as table_name, count(*) as count FROM public.rbac_permissions;
SELECT 'rbac_roles' as table_name, count(*) as count FROM public.rbac_roles;
SELECT 'rbac_role_permissions' as table_name, count(*) as count FROM public.rbac_role_permissions;
SELECT 'rbac_user_org_roles' as table_name, count(*) as count FROM public.rbac_user_org_roles;

-- Show all super-admins
SELECT u.email, u.is_super_admin, uor.organization_slug, r.name as role_name
FROM auth.users u
LEFT JOIN public.rbac_user_org_roles uor ON uor.user_id = u.id
LEFT JOIN public.rbac_roles r ON r.id = uor.role_id
WHERE r.name = 'super-admin'
ORDER BY u.email, uor.organization_slug;
