const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/scu',
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  const resAssets = await client.query(
    'SELECT id, "ownerId", "storageKey", type, "createdAt", "createdByJobId" FROM "Asset" ORDER BY "createdAt" DESC LIMIT 5'
  );
  process.stderr.write('--- Assets ---\n');
  resAssets.rows.forEach((r) => process.stderr.write(JSON.stringify(r) + '\n'));

  const resJobs = await client.query(
    'SELECT id, type, status, "lastError" FROM shot_jobs ORDER BY "createdAt" DESC LIMIT 5'
  );
  process.stderr.write('--- Jobs ---\n');
  resJobs.rows.forEach((r) => {
    process.stderr.write(`Job ${r.id} [${r.type}] ${r.status}\n`);
    process.stderr.write(`Error: ${r.lastError}\n`);
    process.stderr.write('-'.repeat(20) + '\n');
  });

  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
