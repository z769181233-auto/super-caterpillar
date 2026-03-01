import { prisma } from './_db/prisma';

const shotId = process.env.SHOT_ID;

if (!shotId) {
  throw new Error('SHOT_ID required');
}

async function main() {
  const shot = await prisma.shot.findUnique({ where: { id: shotId } });

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

  const out: any = { ok: true, shotId: (shot as any).id };
  for (const k of ['organizationId', 'tenantId', 'createdById', 'userId', 'projectId'] as const) {
    if ((shot as any)[k] !== undefined) out[k] = (shot as any)[k];
  }

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
