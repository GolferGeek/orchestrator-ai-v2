#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: '127.0.0.1',
  port: 6012,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres'
});

const seedFile = path.join(__dirname, 'supabase', 'seed.sql');

async function applySeed() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const sql = fs.readFileSync(seedFile, 'utf8');
    console.log(`📄 Applying seed file: ${seedFile}`);
    console.log(`📊 File size: ${(sql.length / 1024).toFixed(2)} KB`);

    await client.query(sql);
    console.log('✅ Seed file applied successfully');

  } catch (err) {
    console.error('❌ Error applying seed file:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applySeed();
