#!/usr/bin/env node
/**
 * Flow Onboarding Script - Small Team (With Developers)
 * 
 * Creates comprehensive Flow content (efforts/projects/tasks) for small teams with developers
 * Content includes both business and technical tasks
 */

const {
  createDbClient,
  connectDb,
  disconnectDb,
} = require('../shared/db-helpers');
const { seedFlowContent } = require('../shared/seed-flow-helper');

async function seedFlowSmallWithDevs(orgSlug = null) {
  const client = createDbClient();

  try {
    await connectDb(client);

    console.log(`\n📋 Seeding Flow content for teams`);
    console.log(`👥 Company Size: Small Team (With Developers)\n`);

    const summary = await seedFlowContent(client, orgSlug, 'small-with-devs');

    console.log(`\n✅ Flow seeding complete!`);
    console.log(`   📊 Summary:`);
    console.log(`      - Efforts: ${summary.efforts}`);
    console.log(`      - Projects: ${summary.projects}`);
    console.log(`      - Tasks: ${summary.tasks}\n`);

  } catch (error) {
    console.error(`\n❌ Error seeding Flow content:`, error.message);
    process.exit(1);
  } finally {
    await disconnectDb(client);
  }
}

const orgSlug = process.argv[2] || null; // Optional - ignored, content is team-scoped

seedFlowSmallWithDevs(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
