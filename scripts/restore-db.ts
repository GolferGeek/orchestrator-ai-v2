import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

async function restoreDatabase() {
  if (!process.env.PGHOST || !process.env.PGPORT) {
    console.error('ERROR: PGHOST and PGPORT environment variables are required');
    process.exit(1);
  }

  const client = new Client({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    console.log('Reading SQL file...');
    const sql = readFileSync('/tmp/restore.sql', 'utf-8');
    console.log(`SQL file size: ${sql.length} characters`);

    console.log('Executing restore...');
    await client.query(sql);
    console.log('✓ Database restored successfully!');
  } catch (error) {
    console.error('Error restoring database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

restoreDatabase();
