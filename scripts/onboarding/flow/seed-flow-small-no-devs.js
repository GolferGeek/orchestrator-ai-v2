#!/usr/bin/env node
/**
 * Flow Onboarding Script - Small Team (No Developers)
 * 
 * Creates Flow content (efforts/projects/tasks) for small teams without developers
 * Content focuses on business use cases and pre-built agents
 */

const {
  createDbClient,
  connectDb,
  disconnectDb,
} = require('../shared/db-helpers');
const { seedFlowContent } = require('../shared/seed-flow-helper');

async function seedFlowSmallNoDevs(orgSlug = null) {
  const client = createDbClient();

  try {
    await connectDb(client);

    if (orgSlug) {
      console.log(`\n📋 Seeding Flow content for organization: ${orgSlug}`);
    } else {
      console.log(`\n📋 Seeding Flow content for ALL organizations`);
    }
    console.log(`👥 Company Size: Small Team (No Developers)\n`);

    const summary = await seedFlowContent(client, orgSlug, 'small-no-devs');

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

const orgSlug = process.argv[2] || null; // Optional - if not provided, seed all orgs

if (orgSlug) {
  console.log(`📋 Seeding for organization: ${orgSlug}`);
} else {
  console.log(`📋 Seeding for ALL organizations`);
}

seedFlowSmallNoDevs(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
