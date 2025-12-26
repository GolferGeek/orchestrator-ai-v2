#!/usr/bin/env tsx

/**
 * Fix RAG collection organization slug from '*' to 'demo-org'
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:6012/postgres'
});

async function fixOrgSlug() {
  try {
    console.log('🔧 Fixing RAG collection organization slug...\n');

    const result = await pool.query(`
      UPDATE rag_data.rag_collections
      SET organization_slug = 'demo-org'
      WHERE organization_slug = '*';
    `);

    console.log(`✅ Updated ${result.rowCount} collection(s)`);

    // Verify
    const check = await pool.query(`
      SELECT id, name, organization_slug FROM rag_data.rag_collections;
    `);

    console.log('\n📋 Current collections:');
    console.table(check.rows);

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await pool.end();
  }
}

fixOrgSlug();
