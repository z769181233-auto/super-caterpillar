// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient({});

const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function main() {
  console.log(`Injecting Stage 5 (Shot Planning) data for project ${PROJECT_ID}...`);

  // 1. Find a Shot
  const shot = await prisma.shot.findFirst({
    where: {
      scene: {
        episode: {
          season: {
            projectId: PROJECT_ID,
          },
        },
      },
    },
    include: {
      scene: true,
    },
    orderBy: { index: 'asc' },
  });

  if (!shot) {
    console.log('❌ No shot found.');
    return;
  }

  console.log(`Found Shot ${shot.index}: ${shot.title} (ID: ${shot.id})`);
  console.log(`Belongs to Scene: ${shot.scene.title}`);

  // 2. Upsert ShotPlanning record
  const planning = await prisma.shotPlanning.upsert({
    where: { shotId: shot.id },
    create: {
      shotId: shot.id,
      engineKey: 'shot_planning_v1',
      confidence: 0.95,
      data: {
        shotType: { primary: '中景 (Medium Shot)', reason: '展示角色与环境的关系' },
        movement: { primary: '推镜头 (Dolly In)', reason: '增强沉浸感' },
        lighting: { primary: '自然光', mood: '温暖' },
      },
    },
    update: {
      engineKey: 'shot_planning_v1',
      confidence: 0.95,
      data: {
        shotType: { primary: '中景 (Medium Shot)', reason: '展示角色与环境的关系' },
        movement: { primary: '推镜头 (Dolly In)', reason: '增强沉浸感' },
        lighting: { primary: '自然光', mood: '温暖' },
      },
    },
  });

  console.log(`✅ ShotPlanning record upserted for Shot ID: ${shot.id}`);
  console.log(`Data injected:`, JSON.stringify(planning.data, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
