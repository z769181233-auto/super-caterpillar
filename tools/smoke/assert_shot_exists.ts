import { Client } from 'pg';

const shotId = process.env.SHOT_ID;
const databaseUrl = process.env.DATABASE_URL;

if (!shotId) {
  throw new Error('SHOT_ID required');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL required');
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    statement_timeout: 5000,
    query_timeout: 5000,
  });

  await client.connect();

  try {
    const result = await client.query(
      `
        SELECT
          s.id,
          s."organizationId",
          sc.project_id AS "projectId"
        FROM public.shots s
        LEFT JOIN public.scenes sc
          ON sc.id = s."sceneId"
        WHERE s.id = $1
        LIMIT 1
      `,
      [shotId]
    );

    const shot = result.rows[0];

    if (!shot) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            reason: 'shot_not_in_db',
            shotId,
          },
          null,
          2
        )
      );
      process.exit(2);
    }

    const out: Record<string, unknown> = { ok: true, shotId: shot.id };
    for (const key of ['organizationId', 'projectId'] as const) {
      if (shot[key] !== undefined) out[key] = shot[key];
    }

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
