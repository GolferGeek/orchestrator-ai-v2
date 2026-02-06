#!/usr/bin/env node
/**
 * Notebook Onboarding Script - Small Team (No Developers)
 * 
 * Creates Notebook content (notebooks/documents) for small teams without developers
 * Focuses on business user guides and pre-built agent usage
 */

const {
  createNotebookClient,
  createNotebook,
  createSource,
} = require('../shared/api-helpers');
const {
  createSourceFile,
} = require('../shared/file-helpers');
const { getNotebookTemplate } = require('../shared/content-templates');
const {
  createDbClient,
  connectDb,
  disconnectDb,
  getGlobalTeams,
  detectTeamType,
} = require('../shared/db-helpers');

async function seedNotebookSmallNoDevs(orgSlug) {
  const dbClient = createDbClient();
  const notebookClient = await createNotebookClient();

  try {
    await connectDb(dbClient);

    console.log(`\n📋 Seeding Notebook content`);
    console.log(`👥 Company Size: Small Team (No Developers)\n`);

    const teams = await getGlobalTeams(dbClient);
    console.log(`✅ Found ${teams.length} global teams\n`);

    if (teams.length === 0) {
      console.warn('⚠️  No global teams found. Content will be generic.');
    }

    let totalNotebooks = 0;
    let totalDocuments = 0;

    for (const team of teams) {
      const teamType = detectTeamType(team);
      console.log(`\n📦 Processing team: ${team.name} (${teamType})`);

      const template = getNotebookTemplate(teamType, 'small-no-devs');

      if (!template.notebooks || template.notebooks.length === 0) {
        console.log(`  ⏭️  No template content for ${teamType}, skipping`);
        continue;
      }

      for (const notebookTemplate of template.notebooks) {
        console.log(`  📓 Creating notebook: ${notebookTemplate.name}`);

        const notebook = await createNotebook(notebookClient, {
          name: notebookTemplate.name,
          description: notebookTemplate.description || '',
          teamId: team.id,
        });

        totalNotebooks++;
        console.log(`    ✅ Created notebook: ${notebook.id || notebook.name}`);

        for (const docTemplate of notebookTemplate.documents || []) {
          console.log(`    📄 Creating document: ${docTemplate.title}`);

          const filePath = await createSourceFile(
            team.id,
            `temp-${Date.now()}`,
            docTemplate.filename || `${docTemplate.title.toLowerCase().replace(/\s+/g, '-')}.md`,
            docTemplate.content
          );

          const source = await createSource(notebookClient, {
            type: 'upload',
            notebookId: notebook.id || notebook.name,
            filePath: filePath,
            title: docTemplate.title,
            teamId: team.id,
          });

          if (source.id) {
            const correctFilePath = await createSourceFile(
              team.id,
              source.id,
              docTemplate.filename || `${docTemplate.title.toLowerCase().replace(/\s+/g, '-')}.md`,
              docTemplate.content
            );
            const fs = require('fs').promises;
            try {
              await fs.unlink(filePath);
            } catch (e) {
              // Ignore
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
  console.error('❌ Usage: node seed-notebook-small-no-devs.js <organization-slug>');
  console.error('   Example: node seed-notebook-small-no-devs.js demo-org');
  process.exit(1);
}

seedNotebookSmallNoDevs(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
