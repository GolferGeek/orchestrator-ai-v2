#!/usr/bin/env tsx

/**
 * Check what RBAC tables exist and GolferGeek's access level
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:6012/postgres'
});

async function checkRBAC() {
  try {
    console.log('🔍 Checking RBAC Structure\n');
    console.log('=' .repeat(80));

    // 1. Check what tables exist
    console.log('\n1️⃣  RBAC TABLES IN public SCHEMA:');
    console.log('-'.repeat(80));
    const tables = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND (
        tablename LIKE '%organization%'
        OR tablename LIKE '%user%'
        OR tablename LIKE '%role%'
        OR tablename LIKE '%member%'
        OR tablename LIKE '%permission%'
      )
      ORDER BY tablename;
    `);
    console.table(tables.rows);

    // 2. Check organizations table
    console.log('\n2️⃣  ORGANIZATIONS:');
    console.log('-'.repeat(80));
    try {
      const orgs = await pool.query(`SELECT * FROM public.organizations LIMIT 10;`);
      console.table(orgs.rows);
    } catch (e: any) {
      console.log('❌ Table does not exist or error:', e.message);
    }

    // 3. Try to find user role information
    const userId = '618f3960-a8be-4c67-855f-aae4130699b8';

    console.log('\n3️⃣  GOLFERGEEK USER INFO:');
    console.log('-'.repeat(80));
    const user = await pool.query(`
      SELECT id, email, raw_user_meta_data
      FROM auth.users
      WHERE id = $1;
    `, [userId]);

    if (user.rows.length > 0) {
      console.log('User ID:', user.rows[0].id);
      console.log('Email:', user.rows[0].email);
      console.log('Metadata:', JSON.stringify(user.rows[0].raw_user_meta_data, null, 2));
    }

    // 4. Check if there's a simple solution: just pass NULL for super admins
    console.log('\n4️⃣  SOLUTION FOR SUPER ADMIN:');
    console.log('=' .repeat(80));
    console.log('\n💡 For GolferGeek (super admin):');
    console.log('   The API should pass NULL as user_id to bypass access filtering');
    console.log('\n📝 Modify: apps/api/src/rag/collections.controller.ts');
    console.log('   Line 52-60: Check if user is super admin, then pass NULL');
    console.log('\n   Example:');
    console.log('   ```typescript');
    console.log('   const userId = isSuperAdmin(req.user) ? null : req.user.id;');
    console.log('   return this.collectionsService.getCollections(orgSlug, userId);');
    console.log('   ```');

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await pool.end();
  }
}

checkRBAC();
