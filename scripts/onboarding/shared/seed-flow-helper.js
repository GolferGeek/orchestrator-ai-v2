#!/usr/bin/env node
/**
 * Helper function for Flow seeding scripts
 * 
 * Common logic for creating Flow content across all organizations
 */

const {
  getGlobalTeams,
  detectTeamType,
  createEffort,
  createProject,
  createTask,
  getAllOrganizations,
  organizationExists,
} = require('./db-helpers');
const { getFlowTemplate } = require('./content-loader');

/**
 * Seed Flow content for teams (teams span all organizations)
 * 
 * @param {Object} client - Database client
 * @param {string|null} orgSlug - Organization slug to create content in (null = use first org)
 * @param {string} companySize - Company size ('solo', 'small-no-devs', 'small-with-devs')
 * @returns {Object} Summary with counts
 */
async function seedFlowContent(client, orgSlug, companySize) {
  // Determine which organization to use (teams span all orgs, but Flow content needs an org)
  let targetOrg = null;
  if (orgSlug) {
    const orgExists = await organizationExists(client, orgSlug);
    if (!orgExists) {
      throw new Error(`Organization '${orgSlug}' does not exist`);
    }
    targetOrg = { slug: orgSlug };
  } else {
    // Use first organization (teams are global, content goes in one org)
    const orgs = await getAllOrganizations(client);
    if (orgs.length === 0) {
      throw new Error('No organizations found. Please create an organization first.');
    }
    targetOrg = orgs[0];
    console.log(`   Using organization: ${targetOrg.slug} (${targetOrg.name || ''})`);
    console.log(`   Note: Teams span all organizations, content created once per team\n`);
  }

  // Get all global teams (these span all organizations)
  const teams = await getGlobalTeams(client);
  console.log(`✅ Found ${teams.length} global teams\n`);

  if (teams.length === 0) {
    console.warn('⚠️  No global teams found. Content will be generic.');
  }

  let totalEfforts = 0;
  let totalProjects = 0;
  let totalTasks = 0;

  // Create content once per team (teams span all organizations)
  for (const team of teams) {
    const teamType = detectTeamType(team);
    console.log(`📦 Processing team: ${team.name} (${teamType})`);

    // Get template for this team and company size
    const template = await getFlowTemplate(teamType, companySize);

    if (!template.efforts || template.efforts.length === 0) {
      console.log(`  ⏭️  No template content for ${teamType}, skipping`);
      continue;
    }

    // Create efforts, projects, and tasks for this team
    for (const effortTemplate of template.efforts) {
      console.log(`  📁 Creating effort: ${effortTemplate.name}`);

      const effort = await createEffort(client, {
        organizationSlug: targetOrg.slug,
        name: effortTemplate.name,
        description: effortTemplate.description,
        icon: effortTemplate.icon,
        color: effortTemplate.color,
        estimatedDays: effortTemplate.estimatedDays,
        orderIndex: totalEfforts,
      });

      totalEfforts++;

      // Create projects within this effort
      for (const projectTemplate of effortTemplate.projects || []) {
        console.log(`    📂 Creating project: ${projectTemplate.name}`);

        const project = await createProject(client, {
          effortId: effort.id,
          name: projectTemplate.name,
          description: projectTemplate.description,
          orderIndex: totalProjects,
        });

        totalProjects++;

        // Create tasks within this project
        for (let i = 0; i < (projectTemplate.tasks || []).length; i++) {
          const taskTemplate = projectTemplate.tasks[i];
          console.log(`      ✓ Creating task: ${taskTemplate.title}`);

          await createTask(client, {
            projectId: project.id,
            title: taskTemplate.title,
            description: taskTemplate.description,
            documentationUrl: taskTemplate.documentationUrl,
            isMilestone: taskTemplate.isMilestone || false,
            orderIndex: i,
          });

          totalTasks++;
        }
      }
    }
  }

  return { efforts: totalEfforts, projects: totalProjects, tasks: totalTasks };
}

module.exports = { seedFlowContent };
