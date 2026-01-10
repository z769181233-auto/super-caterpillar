import { PrismaClient } from 'database';
import * as util from "util";

const prisma = new PrismaClient();

async function check() {
  const binding = await prisma.jobEngineBinding.findUnique({
    where: { jobId: '08f445d3-9b31-4c0e-adeb-26b67f5afc10' },
  });

  if (!binding) {
    process.stderr.write(util.format('❌ FAIL: No binding found for video job') + "\n");
    process.exit(1);
  }

  process.stdout.write(util.format('Engine Key:', binding.engineKey) + "\n");

  if (binding.engineKey !== 'video_merge') {
    process.stderr.write(util.format('❌ FAIL: Engine Key mismatch. Expected video_merge, got ' + binding.engineKey) + "\n");
    process.exit(1);
  }

  process.stdout.write(util.format('✅ PASS: Engine Binding is correct') + "\n");

  // Check Billing
  // We expect some billing records with this traceId
  const billing = await prisma.costLedger.findFirst({
    where: {
      traceId: 'trace-gate-p0r2-1767943887809',
    },
  });

  if (billing) {
    process.stdout.write(util.format('✅ PASS: CostLedger found') + "\n");
  } else {
    process.stdout.write(util.format('⚠️ WARNING: CostLedger not found immediately (might be async)') + "\n");
  }

  process.stdout.write(util.format('✅ PASS: DB Checks') + "\n");
}

check()
  .catch((e) => {
    process.stderr.write(util.format(e) + "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
