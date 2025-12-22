/**
 * Smoke DB diagnostics
 * - Uses the same DB config as the app (DATABASE_URL or DB_* parts)
 * - Prints connection info (masked), migration status, and key table counts
 * - Friendly errors (no scary stack traces)
 */

import { PrismaClient } from 'database';

type MaskedUrl = { masked: string; raw?: string };

function maskDatabaseUrl(url: string | undefined): MaskedUrl {
  if (!url) return { masked: '(not set)' };
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return { masked: parsed.toString(), raw: url };
  } catch {
    return { masked: '(invalid url)', raw: url };
  }
}

async function getPrisma(): Promise<PrismaClient> {
  // Rely on app-level env resolution; if DATABASE_URL is missing but DB_HOST etc. exist,
  // Prisma will still need DATABASE_URL. Prefer to fail early with a clear message.
  if (!process.env.DATABASE_URL) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env;
    if (DB_HOST) {
      const assembled = `postgresql://${DB_USER ?? 'postgres'}:${DB_PASS ?? 'postgres'}@${DB_HOST}:${DB_PORT ?? '5432'}/${DB_NAME ?? 'super_caterpillar_dev'}?schema=public`;
      process.env.DATABASE_URL = assembled;
      console.log(`[diag] DATABASE_URL assembled from DB_*: ${maskDatabaseUrl(assembled).masked}`);
    } else {
      console.warn('[diag] DATABASE_URL is not set and DB_HOST is empty; Prisma may fail to connect.');
    }
  }
  return new PrismaClient();
}

async function main() {
  const dbUrl = maskDatabaseUrl(process.env.DATABASE_URL);
  console.log('[diag] DATABASE_URL =', dbUrl.masked);

  const prisma = await getPrisma();

  try {
    const db = await prisma.$queryRawUnsafe<{ db: string; schema: string }[]>(
      'select current_database() as db, current_schema() as schema',
    );
    console.log('[diag] current_database/current_schema =', db?.[0]);
  } catch (err: any) {
    console.error('[diag] ❌ failed to query current_database/current_schema:', err?.message || err);
    console.error('       Possible causes: DB not reachable, bad credentials, or schema missing.');
    throw err;
  }

  try {
    const migrations = await prisma.$queryRawUnsafe<any[]>(
      'select id, name, finished_at from "prisma_migrations" order by finished_at desc limit 5',
    );
    console.log(`[diag] migrations count = ${migrations.length}`);
    if (migrations.length > 0) {
      const latest = migrations[0];
      console.log('[diag] latest migration =', { id: latest.id, name: latest.name, finished_at: latest.finished_at });
    } else {
      console.warn('[diag] prisma_migrations table is empty (migrations may not have run).');
    }
  } catch (err: any) {
    console.warn('[diag] ⚠️  prisma_migrations not readable:', err?.message || err);
    console.warn('       Possible causes: migrations not applied, table not created, or different schema.');
  }

  const keyTables = [
    { name: 'users', label: 'User' },
    { name: 'organizations', label: 'Organization' },
    { name: 'projects', label: 'Project' },
    { name: 'jobs', label: 'Job' },
    { name: 'api_keys', label: 'ApiKey' },
  ];

  for (const t of keyTables) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`select count(*)::bigint as count from "${t.name}"`);
      console.log(`[diag] ${t.label} count = ${rows[0]?.count ?? 'n/a'}`);
    } catch (err: any) {
      console.warn(`[diag] ⚠️  cannot count ${t.name}:`, err?.message || err);
    }
  }

  try {
    const anyKey = await prisma.apiKey.findFirst({ select: { id: true, key: true, status: true } });
    console.log('[diag] sample apiKey =', anyKey);
  } catch (e: any) {
    console.error('[diag] prisma.apiKey.findFirst ERROR =', e?.message || e);
    console.error('       Possible causes: api_keys table missing columns or prisma schema mismatch.');
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[diag] exit with failure:', err?.message || err);
  process.exit(1);
});
