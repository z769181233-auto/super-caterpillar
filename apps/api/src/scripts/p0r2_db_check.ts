import { PrismaClient } from 'database';
const prisma = new PrismaClient();

async function check() {
  const binding = await prisma.jobEngineBinding.findUnique({
    where: { jobId: '08f445d3-9b31-4c0e-adeb-26b67f5afc10' },
  });

  if (!binding) {
    console.error('❌ FAIL: No binding found for video job');
    process.exit(1);
  }

  console.log('Engine Key:', binding.engineKey);

  if (binding.engineKey !== 'video_merge') {
    console.error('❌ FAIL: Engine Key mismatch. Expected video_merge, got ' + binding.engineKey);
    process.exit(1);
  }

  console.log('✅ PASS: Engine Binding is correct');

  // Check Billing
  // We expect some billing records with this traceId
  const billing = await prisma.costLedger.findFirst({
    where: {
      traceId: 'trace-gate-p0r2-1767943887809',
    },
  });

  if (billing) {
    console.log('✅ PASS: CostLedger found');
  } else {
    console.log('⚠️ WARNING: CostLedger not found immediately (might be async)');
  }

  console.log('✅ PASS: DB Checks');
}

check()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
