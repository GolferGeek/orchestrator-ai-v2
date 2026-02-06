#!/usr/bin/env node
/**
 * Flow Onboarding Script - Solo Developer
 * 
 * Creates minimal Flow content (efforts/projects/tasks) for solo developers
 * Content is created for all global teams, scaled for solo use
 */

const {
  createDbClient,
  connectDb,
  disconnectDb,
} = require('../shared/db-helpers');
const { seedFlowContent } = require('../shared/seed-flow-helper');

async function seedFlowSolo(orgSlug = null) {
  const client = createDbClient();

  try {
    await connectDb(client);

    console.log(`\n📋 Seeding Flow content`);
    console.log(`👤 Company Size: Solo Developer`);
    if (orgSlug) {
      console.log(`🏢 Organization: ${orgSlug}`);
    } else {
      console.log(`🏢 Organization: (will use first available - teams span all orgs)`);
    }
    console.log(``);

    const summary = await seedFlowContent(client, orgSlug, 'solo');

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

// Main execution
const orgSlug = process.argv[2] || null; // Optional - if not provided, uses first org

seedFlowSolo(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
