/**
 * Smoke 测试：初始化 API Key
 * 直接使用 pg 种子关键数据，避免 Prisma 退化导致门禁卡死。
 */

import { randomUUID } from 'crypto';

const { Client } = require('pg');

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5434/scu';

const apiKey = process.env.API_KEY || 'ak_smoke_test_key_v1';
const apiSecret = process.env.API_SECRET || 'scu_smoke_secret';
const smokeUserEmail = process.env.SMOKE_USER_EMAIL || 'smoke@example.com';
const smokeUserPasswordHash =
  process.env.SMOKE_USER_PASSWORD_HASH ||
  '$2a$10$nqOlsY8A4rwqENUT3ef5ruv4cLoT.vwZKqSu//xTNKoZXOcOu9QNS';
const smokeOrgSlug = process.env.SMOKE_ORG_SLUG || 'smoke-org';
const smokeOrgName = process.env.SMOKE_ORG_NAME || 'Smoke Org';
const smokeProjectId = '00000000-0000-0000-0000-000000000001';
const smokeReset = process.env.SMOKE_RESET === '1';

const queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: queryTimeoutMs,
    query_timeout: queryTimeoutMs,
  });

  await client.connect();

  try {
    console.log('🔑 Initializing API Key for smoke tests...');
    console.log(`   Key: ${apiKey}`);
    console.log(`   Secret: ${apiSecret.substring(0, 8)}...`);

    await client.query('BEGIN');

    if (smokeReset) {
      await client.query(`DELETE FROM api_keys WHERE key = $1`, [apiKey]);
      await client.query(`DELETE FROM organization_members WHERE "userId" IN (SELECT id FROM users WHERE email = $1)`, [
        smokeUserEmail,
      ]);
      await client.query(`DELETE FROM memberships WHERE "userId" IN (SELECT id FROM users WHERE email = $1)`, [
        smokeUserEmail,
      ]);
      await client.query(`UPDATE users SET "defaultOrganizationId" = NULL WHERE email = $1`, [smokeUserEmail]);
      await client.query(`DELETE FROM organizations WHERE slug = $1`, [smokeOrgSlug]);
      await client.query(`DELETE FROM users WHERE email = $1`, [smokeUserEmail]);
    }

    const gateUserId = 'user-gate';
    await client.query(
      `
        INSERT INTO users (id, email, "passwordHash", role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'ADMIN'::user_role, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            "passwordHash" = EXCLUDED."passwordHash",
            role = EXCLUDED.role,
            "updatedAt" = NOW()
      `,
      [gateUserId, 'gate-tester@example.com', 'dummy-hash-for-gate']
    );

    const existingUser = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [smokeUserEmail]);
    const userId = existingUser.rows[0]?.id || randomUUID();

    await client.query(
      `
        INSERT INTO users (
          id, email, "passwordHash", role, "userType", "defaultOrganizationId", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, 'ADMIN'::user_role, 'admin'::user_type, NULL, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE
        SET "passwordHash" = EXCLUDED."passwordHash",
            role = EXCLUDED.role,
            "userType" = EXCLUDED."userType",
            "updatedAt" = NOW()
      `,
      [userId, smokeUserEmail, smokeUserPasswordHash]
    );

    const existingOrg = await client.query(`SELECT id FROM organizations WHERE slug = $1 LIMIT 1`, [smokeOrgSlug]);
    const organizationId = existingOrg.rows[0]?.id || randomUUID();

    await client.query(
      `
        INSERT INTO organizations (
          id, name, slug, "ownerId", credits, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 1000000, NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            "ownerId" = EXCLUDED."ownerId",
            credits = 1000000,
            "updatedAt" = NOW()
      `,
      [organizationId, smokeOrgName, smokeOrgSlug, userId]
    );

    await client.query(`UPDATE users SET "defaultOrganizationId" = $2, "updatedAt" = NOW() WHERE email = $1`, [
      smokeUserEmail,
      organizationId,
    ]);

    await client.query(
      `
        INSERT INTO memberships (
          id, "userId", "organizationId", role, permissions, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, 'OWNER'::membership_role, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT ("userId", "organizationId") DO UPDATE
        SET role = 'OWNER'::membership_role,
            "updatedAt" = NOW()
      `,
      [randomUUID(), userId, organizationId]
    );

    await client.query(
      `
        INSERT INTO organization_members (
          id, "userId", "organizationId", role, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, 'OWNER'::organization_role, NOW(), NOW())
        ON CONFLICT ("userId", "organizationId") DO UPDATE
        SET role = 'OWNER'::organization_role,
            "updatedAt" = NOW()
      `,
      [randomUUID(), userId, organizationId]
    );

    await client.query(
      `
        INSERT INTO cost_centers (
          id, "organizationId", name, budget, "currentCost", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, 1000000, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET budget = 1000000,
            "currentCost" = 0,
            "updatedAt" = NOW()
      `,
      [`cc-${organizationId}`, organizationId, 'Default Cost Center']
    );

    await client.query(
      `
        INSERT INTO api_keys (
          id, key, "secretHash", name, "ownerUserId", "ownerOrgId", status, "expiresAt", "createdAt", "updatedAt", "secretVersion"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE'::api_key_status, NULL, NOW(), NOW(), 1)
        ON CONFLICT (key) DO UPDATE
        SET "secretHash" = EXCLUDED."secretHash",
            name = EXCLUDED.name,
            "ownerUserId" = EXCLUDED."ownerUserId",
            "ownerOrgId" = EXCLUDED."ownerOrgId",
            status = 'ACTIVE'::api_key_status,
            "expiresAt" = NULL,
            "updatedAt" = NOW(),
            "secretVersion" = 1
      `,
      [randomUUID(), apiKey, apiSecret, 'Smoke Test API Key', userId, organizationId]
    );

    await client.query(
      `
        INSERT INTO projects (
          id, name, "organizationId", "ownerId", status, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'in_progress'::project_status, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET "organizationId" = EXCLUDED."organizationId",
            "ownerId" = EXCLUDED."ownerId",
            "updatedAt" = NOW()
      `,
      [smokeProjectId, 'Smoke Verification Project', organizationId, userId]
    );

    const engines = [
      { code: 'default_novel_analysis', name: 'Default Novel Analysis', type: 'local' },
      { code: 'default_shot_render', name: 'Default Shot Render', type: 'local' },
      { code: 'video_merge', name: 'Video Merge (FFmpeg Real)', type: 'local' },
    ];

    for (const eng of engines) {
      await client.query(
        `
          INSERT INTO engines (
            id, code, name, type, "engineKey", "adapterName", "adapterType", mode, config, enabled, "isActive", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $2, $3, $4, 'production', '{}'::jsonb, true, true, NOW(), NOW())
          ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name,
              type = EXCLUDED.type,
              "engineKey" = EXCLUDED."engineKey",
              "adapterName" = EXCLUDED."adapterName",
              "adapterType" = EXCLUDED."adapterType",
              enabled = true,
              "isActive" = true,
              "updatedAt" = NOW()
        `,
        [randomUUID(), eng.code, eng.name, eng.type]
      );
    }

    const verify = await client.query(
      `SELECT key, "ownerUserId", "ownerOrgId", status FROM api_keys WHERE key = $1 LIMIT 1`,
      [apiKey]
    );

    if (!verify.rows[0]) {
      throw new Error(`apiKey not found after upsert: ${apiKey}`);
    }

    await client.query('COMMIT');

    console.log(`✅ Verified apiKey binding: ${apiKey} -> user=${userId} org=${organizationId}`);
    console.log(`✅ Seeded Smoke Project: ${smokeProjectId}`);
    console.log('✅ Default engines seeded.');
    console.log(`API_KEY=${apiKey}`);
    console.log(`API_SECRET=${apiSecret}`);
    console.log(`ORG_ID=${organizationId}`);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(`❌ Failed to initialize API Key: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
