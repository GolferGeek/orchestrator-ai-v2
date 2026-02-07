#!/usr/bin/env node
/**
 * Comprehensive Deletion Script for Onboarding Content
 * 
 * Removes all onboarding content:
 * - Flow: Efforts, projects, tasks (by organization_slug)
 * - Notebook: Notebooks, sources, notes (by team)
 * - Files: Actual document files on disk
 */

const readline = require('readline');
const {
  createDbClient,
  connectDb,
  disconnectDb,
  getGlobalTeams,
  getEffortsForOrg,
  deleteEffortsForOrg,
  getAllOrganizations,
} = require('./db-helpers');
const {
  createNotebookClient,
  getNotebooks,
  deleteNotebook,
  getSourcesForNotebook,
  deleteSource,
  getNotesForNotebook,
  deleteNote,
} = require('./api-helpers');
const {
  findAllFiles,
  deleteFile,
  deleteDirectory,
  getTeamUploadFolder,
} = require('./file-helpers');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function deleteFlowContent(client, orgSlug, dryRun = false) {
  console.log(`\n🗑️  Deleting Flow content for organization: ${orgSlug}`);

  const efforts = await getEffortsForOrg(client, orgSlug);
  console.log(`   Found ${efforts.length} efforts`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would delete ${efforts.length} efforts (and cascading projects/tasks)`);
    return { deleted: 0 };
  }

  const deletedCount = await deleteEffortsForOrg(client, orgSlug);
  console.log(`   ✅ Deleted ${deletedCount} efforts`);

  return { deleted: deletedCount };
}

async function deleteNotebookContent(notebookClient, dbClient, dryRun = false) {
  console.log(`\n🗑️  Deleting Notebook content`);

  // Get all global teams
  const teams = await getGlobalTeams(dbClient);
  console.log(`   Found ${teams.length} teams`);

  let totalNotebooks = 0;
  let totalSources = 0;
  let totalNotes = 0;

  for (const team of teams) {
    console.log(`\n   Processing team: ${team.name}`);

    // Get notebooks for this team
    const notebooks = await getNotebooks(notebookClient, {});
    const teamNotebooks = notebooks.filter(nb => nb.team_id === team.id);

    console.log(`     Found ${teamNotebooks.length} notebooks`);

    for (const notebook of teamNotebooks) {
      const notebookId = notebook.id || notebook.name;

      if (dryRun) {
        // Count sources and notes
        const sources = await getSourcesForNotebook(notebookClient, notebookId);
        const notes = await getNotesForNotebook(notebookClient, notebookId);
        totalSources += sources.length;
        totalNotes += notes.length;
        totalNotebooks++;
        console.log(`     [DRY RUN] Would delete notebook "${notebook.name}" (${sources.length} sources, ${notes.length} notes)`);
        continue;
      }

      // Delete sources
      const sources = await getSourcesForNotebook(notebookClient, notebookId);
      for (const source of sources) {
        try {
          await deleteSource(notebookClient, source.id);
          totalSources++;
        } catch (error) {
          console.warn(`       ⚠️  Failed to delete source ${source.id}: ${error.message}`);
        }
      }

      // Delete notes
      const notes = await getNotesForNotebook(notebookClient, notebookId);
      for (const note of notes) {
        try {
          await deleteNote(notebookClient, note.id);
          totalNotes++;
        } catch (error) {
          console.warn(`       ⚠️  Failed to delete note ${note.id}: ${error.message}`);
        }
      }

      // Delete notebook
      try {
        await deleteNotebook(notebookClient, notebookId);
        totalNotebooks++;
        console.log(`     ✅ Deleted notebook "${notebook.name}"`);
      } catch (error) {
        console.warn(`       ⚠️  Failed to delete notebook ${notebookId}: ${error.message}`);
      }
    }
  }

  if (dryRun) {
    console.log(`\n   [DRY RUN] Would delete:`);
    console.log(`     - Notebooks: ${totalNotebooks}`);
    console.log(`     - Sources: ${totalSources}`);
    console.log(`     - Notes: ${totalNotes}`);
  } else {
    console.log(`\n   ✅ Deleted:`);
    console.log(`     - Notebooks: ${totalNotebooks}`);
    console.log(`     - Sources: ${totalSources}`);
    console.log(`     - Notes: ${totalNotes}`);
  }

  return { notebooks: totalNotebooks, sources: totalSources, notes: totalNotes };
}

async function deleteFiles(dbClient, dryRun = false) {
  console.log(`\n🗑️  Deleting document files`);

  const teams = await getGlobalTeams(dbClient);
  let totalFiles = 0;
  let totalDirs = 0;

  for (const team of teams) {
    const teamFolder = getTeamUploadFolder(team.id);
    const files = await findAllFiles(teamFolder);

    if (dryRun) {
      console.log(`   [DRY RUN] Team ${team.name}: Would delete ${files.length} files`);
      totalFiles += files.length;
      if (files.length > 0) {
        totalDirs++;
      }
      continue;
    }

    // Delete files
    for (const file of files) {
      try {
        await deleteFile(file);
        totalFiles++;
      } catch (error) {
        console.warn(`     ⚠️  Failed to delete file ${file}: ${error.message}`);
      }
    }

    // Try to delete empty directories
    try {
      await deleteDirectory(teamFolder);
      if (files.length > 0) {
        totalDirs++;
      }
    } catch (error) {
      // Directory might not be empty or might not exist, that's okay
    }
  }

  if (dryRun) {
    console.log(`\n   [DRY RUN] Would delete:`);
    console.log(`     - Files: ${totalFiles}`);
    console.log(`     - Directories: ${totalDirs}`);
  } else {
    console.log(`\n   ✅ Deleted:`);
    console.log(`     - Files: ${totalFiles}`);
    console.log(`     - Directories: ${totalDirs}`);
  }

  return { files: totalFiles, directories: totalDirs };
}

async function deleteOnboardingContent(orgSlug, options = {}) {
  const { dryRun = false, force = false } = options;
  const dbClient = createDbClient();
  const notebookClient = await createNotebookClient();

  try {
    await connectDb(dbClient);

    // Determine which organizations to process
    let orgsToProcess = [];
    if (orgSlug === 'all' || orgSlug === '*') {
      const allOrgs = await getAllOrganizations(dbClient);
      orgsToProcess = allOrgs.map(org => org.slug);
      console.log(`\n🗑️  Onboarding Content Deletion`);
      console.log(`   Organizations: ALL (${orgsToProcess.length} organizations)`);
      console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'DELETE'}\n`);
    } else {
      orgsToProcess = [orgSlug];
      console.log(`\n🗑️  Onboarding Content Deletion`);
      console.log(`   Organization: ${orgSlug}`);
      console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'DELETE'}\n`);
    }

    if (!force && !dryRun) {
      const answer = await question('⚠️  This will delete ALL onboarding content. Continue? (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Deletion cancelled.');
        return;
      }
    }

    // Delete Flow content for each organization
    let totalFlowEfforts = 0;
    for (const org of orgsToProcess) {
      const flowResult = await deleteFlowContent(dbClient, org, dryRun);
      totalFlowEfforts += flowResult.deleted;
    }

    // Delete Notebook content (once, as it's team-scoped, not org-scoped)
    const notebookResult = await deleteNotebookContent(notebookClient, dbClient, dryRun);

    // Delete files (once, as files are team-scoped)
    const fileResult = await deleteFiles(dbClient, dryRun);

    // Summary
    console.log(`\n📊 Deletion Summary:`);
    console.log(`   Flow:`);
    console.log(`     - Efforts: ${totalFlowEfforts} (across ${orgsToProcess.length} organization(s))`);
    console.log(`   Notebook:`);
    console.log(`     - Notebooks: ${notebookResult.notebooks}`);
    console.log(`     - Sources: ${notebookResult.sources}`);
    console.log(`     - Notes: ${notebookResult.notes}`);
    console.log(`   Files:`);
    console.log(`     - Files: ${fileResult.files}`);
    console.log(`     - Directories: ${fileResult.directories}`);

    if (dryRun) {
      console.log(`\n✅ Dry run complete. No content was deleted.`);
      console.log(`   Run without --dry-run to actually delete.`);
    } else {
      console.log(`\n✅ Deletion complete!`);
    }

  } catch (error) {
    console.error(`\n❌ Error during deletion:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
    await disconnectDb(dbClient);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const orgSlug = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (!orgSlug) {
  console.error('❌ Usage: node delete-onboarding-content.js <organization-slug|all> [--dry-run] [--force]');
  console.error('   Example: node delete-onboarding-content.js demo-org');
  console.error('   Example: node delete-onboarding-content.js all --force');
  console.error('   Example: node delete-onboarding-content.js demo-org --dry-run');
  console.error('   Example: node delete-onboarding-content.js demo-org --force');
  process.exit(1);
}

deleteOnboardingContent(orgSlug, { dryRun, force }).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
