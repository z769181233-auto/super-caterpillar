import { vg03RealEngine } from '../packages/engines/vg03/src';

async function runTest() {
  console.log('--- VG03 AI Lighting Engine Verification ---');

  const cases = [
    { mood: '阴森恐怖的古堡，只有微弱的烛光' },
    { mood: '充满希望的黎明，第一缕阳光刺破云层' },
    { mood: '华丽奢靡的派对，霓虹灯光交错' },
  ];

  for (const c of cases) {
    console.log(`\nTesting Mood: "${c.mood}"`);

    // Test Fallback
    const fallback = await vg03RealEngine({ mood_description: c.mood });
    console.log(`Fallback Mode Params: ${JSON.stringify(fallback.parameters)}`);

    // Test AI (Mock Mode)
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.ENABLE_VG03_AI = '1';
    process.env.LLM_MOCK_MODE = '1';

    const aiResult = await vg03RealEngine({ mood_description: c.mood });
    console.log(`AI Mock Preset: ${aiResult.preset}`);
    console.log(`AI FFmpeg Filter: ${aiResult.filter_string}`);
    console.log(`AI Reason: ${aiResult.description}`);
  }
}

runTest().catch(console.error);
