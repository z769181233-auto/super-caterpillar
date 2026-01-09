/**
 * Stage 34 Day 2: List Users (只读)
 * 用途：列出当前数据库中的用户，供 Day 2 证据使用
 */

import { PrismaClient } from 'database';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const s = raw.slice(2);
    const eq = s.indexOf('=');
    if (eq >= 0) args[s.slice(0, eq)] = s.slice(eq + 1);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = args['database-url'] || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL missing');

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const dbInfo = await prisma.$queryRawUnsafe<any[]>(
      'select current_database() as db, current_schema() as schema'
    );
    console.log('[stage34_list_users] db_info=', dbInfo?.[0] ?? '(no row)');

    const users = await prisma.user.findMany({
      take: 10,
      select: { id: true, email: true, defaultOrganizationId: true } as any,
      orderBy: { id: 'asc' } as any,
    });

    console.log('[stage34_list_users] users=');
    console.log(JSON.stringify(users, null, 2));
    console.log('[stage34_list_users] RESULT=PASS');
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error('[stage34_list_users] RESULT=FAIL');
  console.error(e?.message ?? e);
  process.exit(1);
});
