import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  mapLegacyBillingStateToChargeCode,
  mapLegacyBillingStateToSsotStatus,
} from '../billing/billing-ledger-compat.util';
import { getRuntimeDbTimeoutMs, withRuntimePgClient } from '../prisma/pg-runtime.util';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

type BillingLedgerRow = {
  id: string;
  job_id: string;
  project_id: string;
  billing_state: string;
  trace_id: string | null;
  item_type: string | null;
  item_id: string | null;
  charge_code: string | null;
  status: string | null;
  tenant_id: string | null;
};

async function main() {
  const batchSize = 200;
  let cursorId: string | null = null;
  let total = 0;
  let updated = 0;
  let unchanged = 0;

  await withRuntimePgClient(
    {
      applicationName: 'super-caterpillar-api-ledger-backfill',
      queryTimeoutMs: getRuntimeDbTimeoutMs('query'),
    },
    async (client) => {
      // Old local databases can still be on the pre-SSOT table shape.
      await client.query(`
        ALTER TABLE billing_ledger
        ADD COLUMN IF NOT EXISTS tenant_id TEXT,
        ADD COLUMN IF NOT EXISTS trace_id TEXT,
        ADD COLUMN IF NOT EXISTS item_type TEXT,
        ADD COLUMN IF NOT EXISTS item_id TEXT,
        ADD COLUMN IF NOT EXISTS charge_code TEXT,
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CREDIT',
        ADD COLUMN IF NOT EXISTS evidence_ref TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      `);

      while (true) {
        const result = await client.query(
          `
            SELECT
              id,
              job_id,
              project_id,
              billing_state,
              trace_id,
              item_type,
              item_id,
              charge_code,
              status,
              tenant_id
            FROM billing_ledger
            WHERE ($1::uuid IS NULL OR id::text > $1::text)
            ORDER BY id::text ASC
            LIMIT $2
          `,
          [cursorId, batchSize]
        );

        const rows = result.rows as BillingLedgerRow[];
        if (rows.length === 0) {
          break;
        }

        total += rows.length;

        for (const row of rows) {
          const next = {
            tenantId: row.tenant_id || row.project_id,
            traceId: row.trace_id || row.job_id,
            itemType: row.item_type || 'JOB',
            itemId: row.item_id || row.job_id,
            chargeCode: row.charge_code || mapLegacyBillingStateToChargeCode(row.billing_state),
            status: row.status || mapLegacyBillingStateToSsotStatus(row.billing_state),
          };

          const sets: string[] = [];
          const values: string[] = [];
          let idx = 2;

          if (row.tenant_id !== next.tenantId) {
            sets.push(`tenant_id = $${idx++}`);
            values.push(next.tenantId);
          }
          if (row.trace_id !== next.traceId) {
            sets.push(`trace_id = $${idx++}`);
            values.push(next.traceId);
          }
          if (row.item_type !== next.itemType) {
            sets.push(`item_type = $${idx++}`);
            values.push(next.itemType);
          }
          if (row.item_id !== next.itemId) {
            sets.push(`item_id = $${idx++}`);
            values.push(next.itemId);
          }
          if (row.charge_code !== next.chargeCode) {
            sets.push(`charge_code = $${idx++}`);
            values.push(next.chargeCode);
          }
          if (row.status !== next.status) {
            sets.push(`status = $${idx++}`);
            values.push(next.status);
          }

          if (sets.length === 0) {
            unchanged += 1;
            continue;
          }

          await client.query(
            `
              UPDATE billing_ledger
              SET ${sets.join(', ')}, updated_at = NOW()
              WHERE id = $1::uuid
            `,
            [row.id, ...values]
          );
          updated += 1;
        }

        cursorId = rows[rows.length - 1]?.id ?? null;
        process.stdout.write(
          JSON.stringify(
            {
              progress: {
                scanned: total,
                updated,
                unchanged,
                lastId: cursorId,
              },
            },
            null,
            2
          ) + '\n'
        );
      }
    }
  );

  process.stdout.write(
    JSON.stringify(
      {
        total,
        updated,
        unchanged,
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error) + '\n');
  process.exit(1);
});
