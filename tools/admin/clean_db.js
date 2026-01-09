const { Client } = require('pg');

const DB_NAME = 'scu';
const ADMIN_DB = 'postgres';

async function clean() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: ADMIN_DB,
    password: 'postgres',
    port: 5432,
  });

  try {
    await client.connect();
    console.log(`Connected to Postgres. Dropping database "${DB_NAME}"...`);

    // Terminate existing connections
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
    `);

    await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    console.log(`Dropped "${DB_NAME}". Creating...`);

    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Successfully created empty database "${DB_NAME}".`);
  } catch (e) {
    // If auth fails, try without password or assume trust, but simplified here
    console.error('Failed to clean database:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

clean();
