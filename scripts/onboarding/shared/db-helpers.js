#!/usr/bin/env node
/**
 * Database Helper Functions for Flow Onboarding
 * 
 * Provides PostgreSQL connection and Flow operations for Supabase
 */

const { Client } = require('pg');
const path = require('path');

/**
 * Create PostgreSQL client connection to Supabase
 */
function createDbClient() {
  if (!process.env.PGHOST || !process.env.PGPORT) {
    console.error('ERROR: PGHOST and PGPORT environment variables are required');
    process.exit(1);
  }

  const host = process.env.PGHOST;
  const port = parseInt(process.env.PGPORT);
  const database = process.env.PGDATABASE || 'postgres';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';

  return new Client({
    host,
    port,
    database,
    user,
    password,
  });
}

/**
 * Connect to database
 */
async function connectDb(client) {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase database');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    throw error;
  }
}

/**
 * Disconnect from database
 */
async function disconnectDb(client) {
  try {
    await client.end();
    console.log('✅ Disconnected from database');
  } catch (error) {
    console.error('❌ Error disconnecting:', error.message);
  }
}

/**
 * Get all global teams (org_slug IS NULL)
 */
async function getGlobalTeams(client) {
  const query = `
    SELECT id, name, description
    FROM public.teams
    WHERE org_slug IS NULL
    ORDER BY name;
  `;

  const result = await client.query(query);
  return result.rows;
}

/**
 * Detect team type from team name/description
 * Returns: 'leadership', 'developer', 'hardware', 'agent-dev', 'evangelist', 'data', or 'generic'
 */
function detectTeamType(team) {
  const name = (team.name || '').toLowerCase();
  const description = (team.description || '').toLowerCase();

  // Check most specific first
  if (name.includes('slt') || name.includes('leadership') || description.includes('leadership')) {
    return 'leadership';
  }
  // Check agent-dev BEFORE generic developer (since "agent development" contains "development")
  if (name.includes('agent') && (name.includes('development') || name.includes('dev'))) {
    return 'agent-dev';
  }
  if (name.includes('evangelist') || description.includes('evangelism') || description.includes('advocacy')) {
    return 'evangelist';
  }
  if (name.includes('hardware') || description.includes('hardware') || description.includes('infrastructure')) {
    return 'hardware';
  }
  // Check for data team
  if (name.includes('data') || description.includes('data') || description.includes('analytics') || description.includes('engineering')) {
    return 'data';
  }
  // Generic developer check last
  if (name.includes('software') || name.includes('developer') || description.includes('software') || description.includes('development')) {
    return 'developer';
  }

  return 'generic';
}

/**
 * Create an effort in orch_flow schema
 */
async function createEffort(client, effortData) {
  const query = `
    INSERT INTO orch_flow.efforts (
      organization_slug,
      team_id,
      name,
      description,
      status,
      order_index,
      icon,
      color,
      estimated_days
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, name;
  `;

  const values = [
    effortData.organizationSlug || null, // Can be null for team-scoped content
    effortData.teamId || null, // Associate with team
    effortData.name,
    effortData.description || null,
    effortData.status || 'not_started',
    effortData.orderIndex || 0,
    effortData.icon || null,
    effortData.color || null,
    effortData.estimatedDays || null,
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

/**
 * Create a project in orch_flow schema
 */
async function createProject(client, projectData) {
  const query = `
    INSERT INTO orch_flow.projects (
      effort_id,
      name,
      description,
      status,
      order_index
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name;
  `;

  const values = [
    projectData.effortId,
    projectData.name,
    projectData.description || null,
    projectData.status || 'not_started',
    projectData.orderIndex || 0,
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

/**
 * Create a task in orch_flow schema
 */
async function createTask(client, taskData) {
  const query = `
    INSERT INTO orch_flow.tasks (
      project_id,
      title,
      description,
      status,
      order_index,
      documentation_url,
      is_milestone
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, title;
  `;

  const values = [
    taskData.projectId,
    taskData.title,
    taskData.description || null,
    taskData.status || 'pending',
    taskData.orderIndex || 0,
    taskData.documentationUrl || null,
    taskData.isMilestone || false,
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

/**
 * Check if organization exists
 */
async function organizationExists(client, orgSlug) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM public.organizations
      WHERE slug = $1
    );
  `;

  const result = await client.query(query, [orgSlug]);
  return result.rows[0].exists;
}

/**
 * Get all organizations
 */
async function getAllOrganizations(client) {
  const query = `
    SELECT slug, name
    FROM public.organizations
    WHERE slug NOT IN ('*', 'all')
    ORDER BY slug;
  `;

  const result = await client.query(query);
  return result.rows;
}

/**
 * Get all efforts for an organization
 */
async function getEffortsForOrg(client, orgSlug) {
  const query = `
    SELECT id, name, organization_slug
    FROM orch_flow.efforts
    WHERE organization_slug = $1;
  `;

  const result = await client.query(query, [orgSlug]);
  return result.rows;
}

/**
 * Delete all efforts (and cascading projects/tasks) for an organization
 */
async function deleteEffortsForOrg(client, orgSlug) {
  const query = `
    DELETE FROM orch_flow.efforts
    WHERE organization_slug = $1;
  `;

  const result = await client.query(query, [orgSlug]);
  return result.rowCount;
}

module.exports = {
  createDbClient,
  connectDb,
  disconnectDb,
  getGlobalTeams,
  detectTeamType,
  createEffort,
  createProject,
  createTask,
  organizationExists,
  getAllOrganizations,
  getEffortsForOrg,
  deleteEffortsForOrg,
};
