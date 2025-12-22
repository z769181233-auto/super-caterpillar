const { PrismaClient, Prisma } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tablesToCheck = [
    'assets',
    'security_fingerprints',
    'shot_variants',
    'video_jobs',
    'characters',
    'novel_volumes',
    'novel_scenes',
    'memory_short_term',
    'memory_long_term',
  ];

  const tableRows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (${Prisma.join(tablesToCheck)})
    ORDER BY table_name;
  `;

  const auditCols = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name IN ('nonce','signature','timestamp')
    ORDER BY column_name;
  `;

  const scenesShotsIdx = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('scenes','shots','tasks','worker_nodes','audit_logs');
  `;

  console.log(
    JSON.stringify(
      {
        tablesPresent: tableRows,
        auditColumns: auditCols,
        keyIndexes: scenesShotsIdx,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

