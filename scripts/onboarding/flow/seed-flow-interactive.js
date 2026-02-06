#!/usr/bin/env node
/**
 * Flow Onboarding Script - Interactive
 * 
 * Interactive script that prompts user for company size and creates appropriate Flow content
 */

const readline = require('readline');
const {
  createDbClient,
  connectDb,
  disconnectDb,
} = require('../shared/db-helpers');
const { seedFlowContent } = require('../shared/seed-flow-helper');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function seedFlowInteractive(orgSlug = null) {
  const client = createDbClient();

  try {
    await connectDb(client);

    console.log(`\n📋 Interactive Flow Onboarding`);
    if (orgSlug) {
      console.log(`🏢 Organization: ${orgSlug}\n`);
    } else {
      console.log(`🏢 Organization: ALL organizations\n`);
    }

    // Prompt for company size
    console.log('Select your company size:');
    console.log('  1. Solo Developer');
    console.log('  2. Small Team (No Developers)');
    console.log('  3. Small Team (With Developers)');
    console.log('');

    const sizeChoice = await question('Enter choice (1-3): ');
    let companySize;

    switch (sizeChoice.trim()) {
      case '1':
        companySize = 'solo';
        break;
      case '2':
        companySize = 'small-no-devs';
        break;
      case '3':
        companySize = 'small-with-devs';
        break;
      default:
        console.error('❌ Invalid choice. Exiting.');
        process.exit(1);
    }

    console.log(`\n✅ Selected: ${companySize === 'solo' ? 'Solo Developer' : companySize === 'small-no-devs' ? 'Small Team (No Developers)' : 'Small Team (With Developers)'}\n`);

    const summary = await seedFlowContent(client, orgSlug, companySize);

    console.log(`\n✅ Flow seeding complete!`);
    console.log(`   📊 Summary:`);
    console.log(`      - Efforts: ${summary.efforts}`);
    console.log(`      - Projects: ${summary.projects}`);
    console.log(`      - Tasks: ${summary.tasks}\n`);

  } catch (error) {
    console.error(`\n❌ Error seeding Flow content:`, error.message);
    process.exit(1);
  } finally {
    rl.close();
    await disconnectDb(client);
  }
}

const orgSlug = process.argv[2] || null; // Optional - if not provided, seed all orgs

if (orgSlug) {
  console.log(`📋 Seeding for organization: ${orgSlug}`);
} else {
  console.log(`📋 Seeding for ALL organizations`);
}

seedFlowInteractive(orgSlug).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
