import { vg04RealEngine } from '../packages/engines/vg04/src';

async function runTest() {
  console.log('--- VG04 AI Camera Path Verification ---');

  const cases = [
    { desc: '少年在雨中疯狂奔跑', pacing: 0.9 },
    { desc: '寂静的图书馆，阳光照在书架上', pacing: 0.2 },
    { desc: '周围的景色快速旋转', pacing: 0.7 },
  ];

  for (const c of cases) {
    console.log(`\nTesting: "${c.desc}" (Pacing: ${c.pacing})`);

    // Test Fallback (No AI Key)
    const fallback = await vg04RealEngine({ shot_description: c.desc, pacing_score: c.pacing });
    console.log(`Fallback Mode: ${fallback.mode} | Reason: ${fallback.description}`);

    // Test AI (Mock Mode via env)
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.ENABLE_VG04_AI = '1';
    process.env.LLM_MOCK_MODE = '1';

    const aiResult = await vg04RealEngine({ shot_description: c.desc, pacing_score: c.pacing });
    console.log(`AI Mock Mode: ${aiResult.mode} | AI Reason: ${aiResult.description}`);
    console.log(`Keyframes Count: ${aiResult.keyframes.length}`);
  }
}

runTest().catch(console.error);
