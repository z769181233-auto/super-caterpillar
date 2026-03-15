import { LocalStorageAdapter } from '@scu/storage';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const { Client } = require('pg');

async function main() {
  const repoRoot = path.resolve(__dirname, '../../');
  const storageRoot = process.env.STORAGE_ROOT || path.join(repoRoot, '.data/storage');
  const storage = new LocalStorageAdapter(storageRoot);
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5434/scu';
  const queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  console.log(`[Seed] Storage Root: ${storageRoot}`);

  const seedId = `seed-${Date.now()}`;
  const frameKeys: string[] = [];
  const colors = ['red', 'green', 'blue'];

  for (let i = 0; i < 3; i++) {
    const color = colors[i];
    const key = `temp/seed/${seedId}/${i}.png`;
    const absPath = storage.getAbsolutePath(key);

    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    const proc = spawnSync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=640x360`,
      '-frames:v',
      '1',
      '-y',
      absPath,
    ]);

    if (proc.status !== 0) {
      throw new Error(`FFmpeg failed: ${proc.stderr.toString()}`);
    }

    frameKeys.push(key);
  }

  console.log(`[Seed] Generated ${frameKeys.length} frames.`);

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: queryTimeoutMs,
    query_timeout: queryTimeoutMs,
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const smokeEmail = process.env.SMOKE_USER_EMAIL || 'smoke@example.com';
    const smokeOrgSlug = process.env.SMOKE_ORG_SLUG || 'smoke-org';

    const userResult = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [smokeEmail]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      throw new Error(`Smoke user not found: ${smokeEmail}. Run tools/smoke/init_api_key.ts first.`);
    }

    const orgResult = await client.query(`SELECT id FROM organizations WHERE slug = $1 LIMIT 1`, [
      smokeOrgSlug,
    ]);
    const orgId = orgResult.rows[0]?.id;
    if (!orgId) {
      throw new Error(`Smoke organization not found: ${smokeOrgSlug}. Run tools/smoke/init_api_key.ts first.`);
    }

    const projectId = randomUUID();
    await client.query(
      `
        INSERT INTO projects (
          id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'in_progress'::project_status, NOW(), NOW())
      `,
      [projectId, `E2E Video Project ${seedId}`, userId, orgId]
    );

    const seasonId = randomUUID();
    await client.query(
      `
        INSERT INTO seasons (
          id, "projectId", index, title, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, 1, 'S1', NOW(), NOW())
      `,
      [seasonId, projectId]
    );

    const episodeId = randomUUID();
    await client.query(
      `
        INSERT INTO episodes (
          id, "seasonId", "projectId", index, name, status
        )
        VALUES ($1, $2, $3, 1, 'E1', 'draft')
      `,
      [episodeId, seasonId, projectId]
    );

    const sceneId = randomUUID();
    await client.query(
      `
        INSERT INTO scenes (
          id, "episodeId", scene_index, title, summary, project_id, created_at, updated_at
        )
        VALUES ($1, $2, 1, 'Sc1', 'E2E Test Scene Summary', $3, NOW(), NOW())
      `,
      [sceneId, episodeId, projectId]
    );

    const shotId = randomUUID();
    await client.query(
      `
        INSERT INTO shots (
          id, "sceneId", index, type, "organizationId"
        )
        VALUES ($1, $2, 1, 'VIDEO', $3)
      `,
      [shotId, sceneId, orgId]
    );

    await client.query(
      `
        INSERT INTO engines (
          id, code, "engineKey", name, "adapterName", "adapterType", type, config, "isActive", enabled, mode, "createdAt", "updatedAt"
        )
        VALUES ($1, 'default_video_render', 'default_video_render', 'Video Render Engine', 'default_video_render', 'local', 'local', '{}'::jsonb, true, true, 'production', NOW(), NOW())
        ON CONFLICT (code) DO UPDATE
        SET "engineKey" = EXCLUDED."engineKey",
            name = EXCLUDED.name,
            "adapterName" = EXCLUDED."adapterName",
            "adapterType" = EXCLUDED."adapterType",
            type = EXCLUDED.type,
            config = EXCLUDED.config,
            "isActive" = true,
            enabled = true,
            mode = 'production',
            "updatedAt" = NOW()
      `,
      [randomUUID()]
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify({
        shotId,
        frameKeys,
        projectId,
      })
    );
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
