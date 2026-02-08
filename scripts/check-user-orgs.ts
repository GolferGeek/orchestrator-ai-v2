#!/usr/bin/env tsx

/**
 * Check GolferGeek's organization memberships and permissions
 */

import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUserOrgs() {
  try {
    console.log('🔍 Checking GolferGeek Organization Memberships & Permissions\n');
    console.log('=' .repeat(80));

    const userId = '618f3960-a8be-4c67-855f-aae4130699b8';

    // 1. Check user's organizations
    console.log('\n1️⃣  ORGANIZATION MEMBERSHIPS:');
    console.log('-'.repeat(80));
    const orgs = await pool.query(`
      SELECT
        o.slug,
        o.name,
        om.role,
        om.created_at
      FROM public.organization_members om
      JOIN public.organizations o ON om.organization_slug = o.slug
      WHERE om.user_id = $1
      ORDER BY om.created_at;
    `, [userId]);

    if (orgs.rows.length === 0) {
      console.log('❌ No organization memberships found!');
    } else {
      console.table(orgs.rows);
      console.log(`\n✅ Member of ${orgs.rows.length} organization(s)\n`);
    }

    // 2. Check user's roles
    console.log('\n2️⃣  USER ROLES:');
    console.log('-'.repeat(80));
    const roles = await pool.query(`
      SELECT
        ur.role_name,
        ur.organization_slug,
        r.display_name,
        r.is_system,
        r.permissions
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_name = r.name
      WHERE ur.user_id = $1
      ORDER BY ur.organization_slug, ur.role_name;
    `, [userId]);

    if (roles.rows.length === 0) {
      console.log('❌ No roles assigned!');
    } else {
      console.table(roles.rows.map(r => ({
        role: r.role_name,
        org: r.organization_slug,
        display: r.display_name,
        system: r.is_system,
        permissions: r.permissions?.slice(0, 3).join(', ') + '...'
      })));
      console.log(`\n✅ Has ${roles.rows.length} role(s)\n`);

      // Check if super-admin
      const isSuperAdmin = roles.rows.some(r => r.role_name === 'super-admin');
      if (isSuperAdmin) {
        console.log('🌟 SUPER ADMIN DETECTED!\n');
      }
    }

    // 3. Check all organizations in system
    console.log('\n3️⃣  ALL ORGANIZATIONS IN SYSTEM:');
    console.log('-'.repeat(80));
    const allOrgs = await pool.query(`
      SELECT slug, name, created_at
      FROM public.organizations
      ORDER BY created_at;
    `);
    console.table(allOrgs.rows);

    // 4. Check all RAG collections by organization
    console.log('\n4️⃣  ALL RAG COLLECTIONS BY ORGANIZATION:');
    console.log('-'.repeat(80));
    const collections = await pool.query(`
      SELECT
        organization_slug as org,
        name,
        document_count as docs,
        chunk_count as chunks,
        status
      FROM rag_data.rag_collections
      ORDER BY organization_slug, name;
    `);

    if (collections.rows.length === 0) {
      console.log('❌ No collections found!');
    } else {
      console.table(collections.rows);
    }

    // 5. Recommendations
    console.log('\n5️⃣  RECOMMENDATIONS:');
    console.log('=' .repeat(80));

    const isSuperAdmin = roles.rows.some(r => r.role_name === 'super-admin');

    if (isSuperAdmin) {
      console.log('\n✅ You are a super admin!');
      console.log('\n📝 The API should:');
      console.log('   1. Query collections from ALL organizations (not just demo-org)');
      console.log('   2. OR pass NULL as user_id to bypass filtering');
      console.log('   3. Update the frontend to show collections from all your orgs');
      console.log('\n💡 Current issue: The API only queries demo-org');
      console.log('   Location: apps/api/src/rag/collections.controller.ts line 52-60');
    } else {
      console.log('\n⚠️  Not a super admin. Should only see collections from:');
      orgs.rows.forEach(org => {
        console.log(`   - ${org.slug} (${org.name})`);
      });
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await pool.end();
  }
}

checkUserOrgs();
