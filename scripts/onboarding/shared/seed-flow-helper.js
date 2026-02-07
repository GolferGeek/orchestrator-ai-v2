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
  // Get all global teams first
  const teams = await getGlobalTeams(client);
  
  let totalEfforts = 0;
  let totalProjects = 0;
  let totalTasks = 0;

  // If teams exist, create content per team (team-scoped, no org needed)
  if (teams.length > 0) {
    console.log(`✅ Found ${teams.length} global teams - creating team-scoped content\n`);

    // Create content once per team (no organization needed)
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
          organizationSlug: null, // Team-scoped, no org needed
          teamId: team.id, // Associate with team
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
  } else {
    // No teams found - fall back to org-scoped content
    console.log(`⚠️  No teams found - creating org-scoped content instead\n`);

    // Determine which organizations to use
    let targetOrgs = [];
    if (orgSlug) {
      const orgExists = await organizationExists(client, orgSlug);
      if (!orgExists) {
        throw new Error(`Organization '${orgSlug}' does not exist`);
      }
      targetOrgs = [{ slug: orgSlug }];
    } else {
      // Create content for all organizations
      const orgs = await getAllOrganizations(client);
      if (orgs.length === 0) {
        throw new Error('No organizations found. Please create an organization first.');
      }
      targetOrgs = orgs;
      console.log(`   Creating content for ${orgs.length} organization(s)\n`);
    }

    // Create generic content for each organization
    for (const targetOrg of targetOrgs) {
      console.log(`📋 Creating content for organization: ${targetOrg.slug}`);

      // Use generic team type when no teams exist
      const template = await getFlowTemplate('generic', companySize);

      if (!template.efforts || template.efforts.length === 0) {
        console.log(`  ⏭️  No generic template content, skipping`);
        continue;
      }

      // Create efforts, projects, and tasks for this org
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
  }

  return { efforts: totalEfforts, projects: totalProjects, tasks: totalTasks };
}

module.exports = { seedFlowContent };
