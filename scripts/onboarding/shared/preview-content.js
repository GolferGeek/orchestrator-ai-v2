#!/usr/bin/env node
/**
 * Preview Script - Show What Will Be Created
 * 
 * Displays a preview of what content will be created without actually creating it
 */

const {
  createDbClient,
  connectDb,
  disconnectDb,
  getGlobalTeams,
  detectTeamType,
} = require('./db-helpers');
const {
  getFlowTemplate,
  getNotebookTemplate,
} = require('./content-loader');

async function previewFlowContent(teamType, companySize) {
  const template = await getFlowTemplate(teamType, companySize);
  
  if (!template.efforts || template.efforts.length === 0) {
    return { efforts: 0, projects: 0, tasks: 0 };
  }

  let totalEfforts = 0;
  let totalProjects = 0;
  let totalTasks = 0;

  for (const effort of template.efforts) {
    totalEfforts++;
    for (const project of effort.projects || []) {
      totalProjects++;
      totalTasks += (project.tasks || []).length;
    }
  }

  return { efforts: totalEfforts, projects: totalProjects, tasks: totalTasks };
}

async function previewNotebookContent(teamType, companySize) {
  const template = await getNotebookTemplate(teamType, companySize);
  
  if (!template.notebooks || template.notebooks.length === 0) {
    return { notebooks: 0, documents: 0 };
  }

  let totalNotebooks = 0;
  let totalDocuments = 0;

  for (const notebook of template.notebooks) {
    totalNotebooks++;
    totalDocuments += (notebook.documents || []).length;
  }

  return { notebooks: totalNotebooks, documents: totalDocuments };
}

async function previewContent(orgSlug, companySize) {
  const client = createDbClient();

  try {
    await connectDb(client);

    console.log(`\n📋 Content Preview`);
    console.log(`   Organization: ${orgSlug}`);
    console.log(`   Company Size: ${companySize === 'solo' ? 'Solo Developer' : companySize === 'small-no-devs' ? 'Small Team (No Developers)' : 'Small Team (With Developers)'}\n`);

    const teams = await getGlobalTeams(client);
    console.log(`✅ Found ${teams.length} global teams\n`);

    if (teams.length === 0) {
      console.warn('⚠️  No global teams found.');
      return;
    }

    let totalFlowEfforts = 0;
    let totalFlowProjects = 0;
    let totalFlowTasks = 0;
    let totalNotebooks = 0;
    let totalDocuments = 0;

    console.log('📊 Content Preview by Team:\n');

    for (const team of teams) {
      const teamType = detectTeamType(team);
      console.log(`\n📦 ${team.name} (${teamType})`);

      // Flow content
      const flowPreview = await previewFlowContent(teamType, companySize);
      if (flowPreview.efforts > 0) {
        console.log(`   Flow:`);
        console.log(`     - Efforts: ${flowPreview.efforts}`);
        console.log(`     - Projects: ${flowPreview.projects}`);
        console.log(`     - Tasks: ${flowPreview.tasks}`);
        totalFlowEfforts += flowPreview.efforts;
        totalFlowProjects += flowPreview.projects;
        totalFlowTasks += flowPreview.tasks;
      } else {
        console.log(`   Flow: No content`);
      }

      // Notebook content
      const notebookPreview = await previewNotebookContent(teamType, companySize);
      if (notebookPreview.notebooks > 0) {
        console.log(`   Notebook:`);
        console.log(`     - Notebooks: ${notebookPreview.notebooks}`);
        console.log(`     - Documents: ${notebookPreview.documents}`);
        totalNotebooks += notebookPreview.notebooks;
        totalDocuments += notebookPreview.documents;
      } else {
        console.log(`   Notebook: No content`);
      }
    }

    console.log(`\n📊 Total Content Summary:`);
    console.log(`   Flow:`);
    console.log(`     - Efforts: ${totalFlowEfforts}`);
    console.log(`     - Projects: ${totalFlowProjects}`);
    console.log(`     - Tasks: ${totalFlowTasks}`);
    console.log(`   Notebook:`);
    console.log(`     - Notebooks: ${totalNotebooks}`);
    console.log(`     - Documents: ${totalDocuments}`);
    console.log('');

  } catch (error) {
    console.error(`\n❌ Error generating preview:`, error.message);
    process.exit(1);
  } finally {
    await disconnectDb(client);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const orgSlug = args.find(arg => !arg.startsWith('--'));
const companySize = args.find(arg => ['solo', 'small-no-devs', 'small-with-devs'].includes(arg));

if (!orgSlug || !companySize) {
  console.error('❌ Usage: node preview-content.js <organization-slug> <company-size>');
  console.error('   Company sizes: solo, small-no-devs, small-with-devs');
  console.error('   Example: node preview-content.js demo-org solo');
  console.error('   Example: node preview-content.js demo-org small-with-devs');
  process.exit(1);
}

previewContent(orgSlug, companySize).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
