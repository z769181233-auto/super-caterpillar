import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient({});

const PROJECT_ID = 'wangu_trailer_20260215_232235';

// Character IDs from DB sweep
const CHAR_MAP = {
  ZHANG_RUOCHEN: 'cmlotfzx70002l27rtbe09l26',
  LIN_FEI: 'cmlotfzxl0004l27rahsw8wiq',
  ZHANG_JI: 'cmlotm11s000810vfwqal1frm',
};

const SHOTS = [
  {
    sceneIndex: 1,
    shotIndex: 1,
    description: '昆仑背叛 - 张若尘胸膛贯穿特写 (特写)',
    prompt:
      'Cinematic close-up of Zhang Ruochen being pierced by a glowing sword tips dripping blood, glowing wounds, expressions of betrayal and agony, shattered dimensional background, Masterpiece 3D CGI.',
    charId: CHAR_MAP.ZHANG_RUOCHEN,
    motion: 'ZOOM_IN',
  },
  {
    sceneIndex: 1,
    shotIndex: 2,
    description: '昆仑背叛 - 池瑶公主背影全景 (全景)',
    prompt:
      'Wide shot of a majestic princess in flowing white and silver robes holding a glowing sword, standing amidst shattered celestial ruins and purple nebulae, back facing camera, god-like aura, high-end 3D render.',
    charId: null,
    motion: 'PAN_LEFT',
  },
  {
    sceneIndex: 2,
    shotIndex: 1,
    description: '冷宫惊醒 - 张若尘惊醒特写 (特写)',
    prompt:
      'Extreme close up of Zhang Ruochen eyes snapping open, sweat on forehead, reflection of sword in pupils, dark room, flickering candlelight, cinematic 3D CGI.',
    charId: CHAR_MAP.ZHANG_RUOCHEN,
    motion: 'ZOOM_IN',
  },
  {
    sceneIndex: 2,
    shotIndex: 2,
    description: '冷宫惊醒 - 林妃焦灼中景 (中景)',
    prompt:
      'Medium shot of Lin Fei in elegant but worn palace robes, hands trembling, face full of worry and grief, standing near a wooden bed in a cold dark room, snowy wind outside window, hyper-realistic 3D.',
    charId: CHAR_MAP.LIN_FEI,
    motion: 'TILT_UP',
  },
  {
    sceneIndex: 3,
    shotIndex: 1,
    description: '八皇子逼宫 - 张济步入全景 (全景)',
    prompt:
      'Wide shot of 8th Prince Zhang Ji in golden royal python robes walking aggressively into a ruined palace room, guards following behind, kicking broken furniture, glowing arrogant face, Unreal Engine 5 render.',
    charId: CHAR_MAP.ZHANG_JI,
    motion: 'PAN_RIGHT',
  },
  {
    sceneIndex: 3,
    shotIndex: 2,
    description: '八皇子逼宫 - 林妃发钗落地特写 (特写)',
    prompt:
      'Close up of a broken jade hairpin falling onto the cold dusty floor, shattered pieces, Lin Fei hands being pushed away in background (blurred), high cinematic detail, 8k resolution.',
    charId: CHAR_MAP.LIN_FEI,
    motion: 'ZOOM_OUT',
  },
  {
    sceneIndex: 3,
    shotIndex: 3,
    description: '八皇子逼宫 - 张若尘铁血坚毅特写 (特写)',
    prompt:
      'Close up of Zhang Ruochen face, nails digging into the wooden bed frame, blood dripping from palm, eyes turning from sickly to sharp and murderous, sword-like gaze, Masterpiece 3D CGI.',
    charId: CHAR_MAP.ZHANG_RUOCHEN,
    motion: 'ZOOM_IN',
  },
  {
    sceneIndex: 4,
    shotIndex: 1,
    description: '暗自发誓 - 张若尘雪中扶起母亲全景 (全景)',
    prompt:
      'Wide cinematic shot of Zhang Ruochen supporting his mother Lin Fei in a snowy palace courtyard, huge statue of Empress Chi Yao in distance, dark blue night atmosphere, snow drifting, dramatic lighting.',
    charId: CHAR_MAP.ZHANG_RUOCHEN,
    motion: 'PAN_LEFT',
  },
  {
    sceneIndex: 4,
    shotIndex: 2,
    description: '暗自发誓 - 张若尘左眼燃烧剑火大特写 (特写)',
    prompt:
      'Ultra-detail macro shot of Zhang Ruochen left eye, reflecting a burning silver flame in the shape of a sword, glowing iris, skin texture visible, cosmic power awakening effect.',
    charId: CHAR_MAP.ZHANG_RUOCHEN,
    motion: 'ZOOM_IN',
  },
  {
    sceneIndex: 4,
    shotIndex: 3,
    description: '暗自发誓 - 池瑶女皇神像远景 (远景)',
    prompt:
      'Extreme wide shot of a giant, thousand-foot tall golden statue of Empress Chi Yao standing above the Clouds of Yunwu City, majestic and terrifying, glowing eyes, sunrise breaking behind it.',
    charId: null,
    motion: 'TILT_DOWN',
  },
  {
    sceneIndex: 5,
    shotIndex: 1,
    description: '核心剧情 - 时空晶石银色微光特写 (特写)',
    prompt:
      'Macro shot of a date-seed shaped crystal stone glowing with shifting silver time-space ripples, floating in a dark stone room, glowing runes appearing on surface, high-end VFX render.',
    charId: null,
    motion: 'ZOOM_IN',
  },
];

async function main() {
  console.log('[Produce] Sourcing project and organization...');
  const project = await prisma.projects.findUnique({
    where: { id: PROJECT_ID },
    select: { organizationId: true },
  });

  if (!project) {
    throw new Error(`Project ${PROJECT_ID} not found`);
  }

  const ORG_ID = project.organizationId;

  console.log('[Produce] Purging current scenes and jobs for Episode 1...');
  await prisma.shot_jobs.deleteMany({ where: { projectId: PROJECT_ID } });
  await prisma.shots.deleteMany({ where: { scene: { projectId: PROJECT_ID } } });
  await prisma.scenes.deleteMany({ where: { projectId: PROJECT_ID } });

  console.log('[Produce] Creating new scenes and shots...');

  for (const s of SHOTS) {
    // 1. Create Scene (Sequential - Each gets its own ID)
    const scene = await prisma.scenes.create({
      data: {
        projectId: PROJECT_ID,
        sceneIndex: s.sceneIndex,
        title: `Scene ${s.sceneIndex} Shot ${s.shotIndex}`,
        summary: s.description.split(' - ')[0],
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
      },
    });

    // 2. Create Shot
    const shot = await prisma.shots.create({
      data: {
        sceneId: scene.id,
        index: s.shotIndex,
        description: s.description,
        visualPrompt: s.prompt,
        cameraMovement: s.motion,
        reviewStatus: 'APPROVED',
        type: 'DEFAULT',
        params: {
          prompt: s.prompt,
          characterId: s.charId,
          cameraMovement: s.motion,
        } as any,
        organizationId: ORG_ID,
      },
    });

    // 3. Create ShotJob
    const job = await prisma.shot_jobs.create({
      data: {
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        sceneId: scene.id,
        shotId: shot.id,
        status: 'PENDING',
        priority: 10,
        type: 'SHOT_RENDER',
        payload: {
          projectId: PROJECT_ID,
          organizationId: ORG_ID,
          sceneId: scene.id,
          shotId: shot.id,
          prompt: s.prompt,
          characterId: s.charId,
          cameraMovement: s.motion,
          engineKey: 'real_shot_render',
          referenceSheetId: 'v18_sealed_reference',
        } as any,
      },
    });

    console.log(`[Success] Enqueued Scene ${s.sceneIndex}.${s.shotIndex} -> Job ID: ${job.id}`);
  }

  console.log('[Produce] All 11 production-grade shots enqueued successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
