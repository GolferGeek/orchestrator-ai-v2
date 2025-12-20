import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

async function restoreDatabase() {
  const client = new Client({
    host: '127.0.0.1',
    port: 6012,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
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
