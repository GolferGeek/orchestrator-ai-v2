#!/usr/bin/env node
/**
 * Notebook Onboarding Script - Solo Developer
 * 
 * Creates Notebook content (notebooks/documents) for solo developers
 * Creates actual markdown files on disk and uploads them via API
 */

const {
  createNotebookClient,
  createNotebook,
  createSource,
} = require('../shared/api-helpers');
const {
  createSourceFile,
  getTeamUploadFolder,
  ensureDirectory,
} = require('../shared/file-helpers');
const { getNotebookTemplate } = require('../shared/content-loader');
const {
  createDbClient,
  connectDb,
  disconnectDb,
  getGlobalTeams,
  detectTeamType,
} = require('../shared/db-helpers');

async function seedNotebookSolo(orgSlug) {
  const dbClient = createDbClient();
  const notebookClient = await createNotebookClient();

  try {
    await connectDb(dbClient);

    console.log(`\n📋 Seeding Notebook content`);
    console.log(`👤 Company Size: Solo Developer\n`);

    // Get all global teams
    const teams = await getGlobalTeams(dbClient);
    console.log(`✅ Found ${teams.length} global teams\n`);

    if (teams.length === 0) {
      console.warn('⚠️  No global teams found. Content will be generic.');
    }

    let totalNotebooks = 0;
    let totalDocuments = 0;

    // Create content for each team
    for (const team of teams) {
      const teamType = detectTeamType(team);
      console.log(`\n📦 Processing team: ${team.name} (${teamType})`);

      // Get template for this team and company size
      const template = await getNotebookTemplate(teamType, 'solo');

      if (!template.notebooks || template.notebooks.length === 0) {
        console.log(`  ⏭️  No template content for ${teamType}, skipping`);
        continue;
      }

      // Create notebooks and documents
      for (const notebookTemplate of template.notebooks) {
        console.log(`  📓 Creating notebook: ${notebookTemplate.name}`);

        // Create notebook via API
        const notebook = await createNotebook(notebookClient, {
          name: notebookTemplate.name,
          description: notebookTemplate.description || '',
          teamId: team.id,
        });

        totalNotebooks++;
        console.log(`    ✅ Created notebook: ${notebook.id || notebook.name}`);

        // Create documents for this notebook
        for (const docTemplate of notebookTemplate.documents || []) {
          console.log(`    📄 Creating document: ${docTemplate.title}`);

          // Create markdown file on disk first
          const filePath = await createSourceFile(
            team.id,
            `temp-${Date.now()}`, // Temporary source ID, will be replaced after API call
            docTemplate.filename || `${docTemplate.title.toLowerCase().replace(/\s+/g, '-')}.md`,
            docTemplate.content
          );

          // Create source via API (which will create proper folder structure)
          const source = await createSource(notebookClient, {
            type: 'upload',
            notebookId: notebook.id || notebook.name,
            filePath: filePath,
            title: docTemplate.title,
            teamId: team.id,
          });

          // Now create the file in the correct location (using actual source ID)
          if (source.id) {
            const correctFilePath = await createSourceFile(
              team.id,
              source.id,
              docTemplate.filename || `${docTemplate.title.toLowerCase().replace(/\s+/g, '-')}.md`,
              docTemplate.content
            );
            // Delete the temporary file
            const fs = require('fs').promises;
            try {
              await fs.unlink(filePath);
            } catch (e) {
              // Ignore if already deleted
            }
          }

          totalDocuments++;
          console.log(`      ✅ Created document: ${source.id || source.title}`);
        }
      }
    }

    console.log(`\n✅ Notebook seeding complete!`);
    console.log(`   📊 Summary:`);
    console.log(`      - Notebooks: ${totalNotebooks}`);
    console.log(`      - Documents: ${totalDocuments}\n`);

  } catch (error) {
    console.error(`\n❌ Error seeding Notebook content:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await disconnectDb(dbClient);
  }
}

const orgSlug = process.argv[2];

if (!orgSlug) {
  console.error('❌ Usage: node seed-notebook-solo.js <organization-slug>');
  console.error('   Example: node seed-notebook-solo.js demo-org');
  console.error('\n   Note: orgSlug is for reference only. Notebooks are created per team.');
  process.exit(1);
}

seedNotebookSolo(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
