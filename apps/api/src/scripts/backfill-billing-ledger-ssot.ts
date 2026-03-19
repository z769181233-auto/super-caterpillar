import { PrismaClient } from 'database';
import {
  mapLegacyBillingStateToChargeCode,
  mapLegacyBillingStateToSsotStatus,
} from '../billing/billing-ledger-compat.util';

const prisma = new PrismaClient({});

async function main() {
  const rows = await prisma.billingLedger.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      jobId: true,
      projectId: true,
      billingState: true,
      traceId: true,
      itemType: true,
      itemId: true,
      chargeCode: true,
      status: true,
      tenantId: true,
      evidenceRef: true,
    },
  });

  let updated = 0;
  let unchanged = 0;

  for (const row of rows) {
    const next = {
      tenantId: row.tenantId || row.projectId,
      traceId: row.traceId || row.jobId,
      itemType: row.itemType || 'JOB',
      itemId: row.itemId || row.jobId,
      chargeCode: row.chargeCode || mapLegacyBillingStateToChargeCode(row.billingState),
      status: row.status || mapLegacyBillingStateToSsotStatus(row.billingState),
    };

    const patch: Record<string, string> = {};
    if (row.tenantId !== next.tenantId) patch.tenantId = next.tenantId;
    if (row.traceId !== next.traceId) patch.traceId = next.traceId;
    if (row.itemType !== next.itemType) patch.itemType = next.itemType;
    if (row.itemId !== next.itemId) patch.itemId = next.itemId;
    if (row.chargeCode !== next.chargeCode) patch.chargeCode = next.chargeCode;
    if (row.status !== next.status) patch.status = next.status;

    if (Object.keys(patch).length === 0) {
      unchanged += 1;
      continue;
    }

    await prisma.billingLedger.update({
      where: { id: row.id },
      data: patch,
    });
    updated += 1;
  }

  process.stdout.write(
    JSON.stringify(
      {
        total: rows.length,
        updated,
        unchanged,
      },
      null,
      2
    ) + '\n'
  );
}

main()
  .catch((error) => {
    process.stderr.write(String(error?.stack || error) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
