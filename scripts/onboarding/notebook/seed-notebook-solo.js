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

          // Create a temporary file for upload (API will save it to correct location)
          const os = require('os');
          const path = require('path');
          const fs = require('fs').promises;
          
          const tempDir = os.tmpdir();
          const tempFileName = `${docTemplate.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
          const tempFilePath = path.join(tempDir, tempFileName);
          
          // Write content to temp file
          await fs.writeFile(tempFilePath, docTemplate.content, 'utf8');

          try {
            // Create source via API (which will save file to correct location)
            const source = await createSource(notebookClient, {
              type: 'upload',
              notebookId: notebook.id || notebook.name,
              filePath: tempFilePath,
              title: docTemplate.title,
              teamId: team.id,
            });

            console.log(`    ✅ Created source: ${source.id || 'unknown'}`);
          } finally {
            // Always clean up temp file
            try {
              await fs.unlink(tempFilePath);
            } catch (e) {
              // Ignore errors deleting temp file
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
