import { randomUUID } from 'crypto';

const { Client } = require('pg');

const TEST_STORAGE_KEY = process.env.TEST_STORAGE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_STORAGE_KEY) {
  console.error('Error: TEST_STORAGE_KEY env var is missing.');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL env var is missing.');
  process.exit(1);
}

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  console.log(`Ensuring Gate 3 Data for key: ${TEST_STORAGE_KEY}`);

  const email = process.env.AUTH_EMAIL || 'gate_bot@example.com';
  console.log(`Using user email: ${email}`);

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const userId = randomUUID();
      const existingUser = await client.query(
        'SELECT id FROM "users" WHERE email = $1 LIMIT 1',
        [email]
      );
      const user =
        existingUser.rows[0] ||
        (
          await client.query(
            `INSERT INTO "users" ("id", "email", "passwordHash", "updatedAt")
             VALUES ($1, $2, $3, NOW())
             RETURNING id`,
            [userId, email, 'placeholder_hash']
          )
        ).rows[0];

      const orgId = 'gate-org';
      const existingOrg = await client.query(
        'SELECT id FROM "organizations" WHERE id = $1 OR slug = $2 LIMIT 1',
        [orgId, 'gate-org']
      );
      if (existingOrg.rowCount > 0) {
        await client.query(
          `UPDATE "organizations"
             SET "ownerId" = $2, "credits" = $3, "updatedAt" = NOW()
           WHERE id = $1`,
          [existingOrg.rows[0].id, user.id, 1000000]
        );
        console.log(`Org updated ownership and credits: ${existingOrg.rows[0].id}`);
      } else {
        await client.query(
          `INSERT INTO "organizations" ("id", "name", "slug", "ownerId", "credits", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [orgId, 'Gate Org', 'gate-org', user.id, 1000000]
        );
        console.log(`Org ensured via insert with credits: ${orgId}`);
      }

      const projectId = 'gate-project-3';
      const existingProject = await client.query(
        'SELECT id FROM "projects" WHERE id = $1 LIMIT 1',
        [projectId]
      );
      if (existingProject.rowCount > 0) {
        await client.query(
          `UPDATE "projects"
             SET "ownerId" = $2, "organizationId" = $3, "updatedAt" = NOW()
           WHERE id = $1`,
          [projectId, user.id, orgId]
        );
      } else {
        await client.query(
          `INSERT INTO "projects" ("id", "name", "ownerId", "organizationId", "status", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::project_status, NOW())`,
          [projectId, 'Gate 3 Probe Project', user.id, orgId, 'in_progress']
        );
      }

      const existingAsset = await client.query(
        `SELECT id FROM "assets"
         WHERE "ownerType" = $1::"AssetOwnerType"
           AND "ownerId" = $2
           AND "type" = $3::"AssetType"
         LIMIT 1`,
        ['SHOT', user.id, 'VIDEO']
      );

      if (existingAsset.rowCount > 0) {
        await client.query(
          `UPDATE "assets"
             SET "storageKey" = $2,
                 "status" = $3::"AssetStatus",
                 "projectId" = $4
           WHERE id = $1`,
          [existingAsset.rows[0].id, TEST_STORAGE_KEY, 'PUBLISHED', projectId]
        );
        console.log(`Asset updated (reused): ${existingAsset.rows[0].id}`);
      } else {
        const assetId = randomUUID();
        await client.query(
          `INSERT INTO "assets"
            ("id", "projectId", "ownerId", "ownerType", "status", "storageKey", "type")
           VALUES
            ($1, $2, $3, $4::"AssetOwnerType", $5::"AssetStatus", $6, $7::"AssetType")`,
          [assetId, projectId, user.id, 'SHOT', 'PUBLISHED', TEST_STORAGE_KEY, 'VIDEO']
        );
        console.log(`Asset created: ${assetId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
