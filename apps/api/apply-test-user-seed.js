#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: '127.0.0.1',
  port: 6012, // Supabase local port from config.toml
  database: 'postgres',
  user: 'postgres',
  password: 'postgres'
});

const seedFile = path.join(__dirname, 'supabase', 'seed', 'test-user.sql');

async function applySeed() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase database');

    const sql = fs.readFileSync(seedFile, 'utf8');
    console.log(`📄 Applying seed file: ${seedFile}`);
    console.log(`📊 File size: ${(sql.length / 1024).toFixed(2)} KB`);

    await client.query(sql);
    console.log('✅ Test user seed file applied successfully');
    console.log('');
    console.log('📧 Email: demo.user@orchestratorai.io');
    console.log('🔑 Password: DemoUser123!');
    console.log('🏢 Organization: demo-org');
    console.log('');

  } catch (err) {
    console.error('❌ Error applying seed file:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applySeed();
