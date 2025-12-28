-- Migration: Remove orch_flow.teams and orch_flow.team_members tables
--
-- Reason: Orch-Flow gets all team data from the API (which queries public.teams),
-- not from database tables. The team_id columns in other orch_flow tables
-- should remain as UUIDs without foreign key constraints.

-- ============================================
-- Step 1: Remove from Realtime publication
-- ============================================
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS orch_flow.teams;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS orch_flow.team_members;

-- ============================================
-- Step 2: Drop foreign key constraints that reference orch_flow.teams
-- ============================================
-- Drop FK from timer_state
ALTER TABLE IF EXISTS orch_flow.timer_state DROP CONSTRAINT IF EXISTS timer_state_team_id_fkey;

-- Drop FK from sprints
ALTER TABLE IF EXISTS orch_flow.sprints DROP CONSTRAINT IF EXISTS sprints_team_id_fkey;

-- Drop FK from shared_tasks
ALTER TABLE IF EXISTS orch_flow.shared_tasks DROP CONSTRAINT IF EXISTS shared_tasks_team_id_fkey;

-- Drop FK from channels
ALTER TABLE IF EXISTS orch_flow.channels DROP CONSTRAINT IF EXISTS channels_team_id_fkey;

-- ============================================
-- Step 3: Drop RLS policies for team_members
-- ============================================
DROP POLICY IF EXISTS "Team members can view team members" ON orch_flow.team_members;
DROP POLICY IF EXISTS "Team members can view their own membership" ON orch_flow.team_members;
DROP POLICY IF EXISTS "Anyone can view team members" ON orch_flow.team_members;

-- ============================================
-- Step 4: Drop RLS policies for teams
-- ============================================
DROP POLICY IF EXISTS "Anyone can view teams" ON orch_flow.teams;
DROP POLICY IF EXISTS "Team creators can create teams" ON orch_flow.teams;
DROP POLICY IF EXISTS "Team creators can update teams" ON orch_flow.teams;
DROP POLICY IF EXISTS "Team creators can delete teams" ON orch_flow.teams;

-- ============================================
-- Step 5: Drop indexes
-- ============================================
DROP INDEX IF EXISTS orch_flow.idx_orch_flow_teams_created_by;
DROP INDEX IF EXISTS orch_flow.idx_orch_flow_team_members_team;
DROP INDEX IF EXISTS orch_flow.idx_orch_flow_team_members_user;

-- ============================================
-- Step 6: Drop tables (CASCADE will handle any remaining dependencies)
-- ============================================
DROP TABLE IF EXISTS orch_flow.team_members CASCADE;
DROP TABLE IF EXISTS orch_flow.teams CASCADE;

-- ============================================
-- Note: The team_id columns in timer_state, sprints, shared_tasks, and channels
-- remain as UUID columns without foreign key constraints. They store team IDs
-- that Orch-Flow receives from the API (which queries public.teams).
-- ============================================

