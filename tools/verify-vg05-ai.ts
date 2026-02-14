import { vg05RealEngine } from '../packages/engines/vg05/src';

async function runTest() {
  console.log('--- VG05 AI VFX Compositor Verification ---');

  const cases = [
    { ctx: '繁忙的赛博朋克都市，电子屏幕不断闪烁报警。', pacing: 0.9 },
    { ctx: '清晨的湖边，雾气缭绕，一切都像是一场梦。', pacing: 0.2 },
    { ctx: '那是一段被遗忘的历史，画面充满了岁月的痕迹。', pacing: 0.4 },
  ];

  for (const c of cases) {
    console.log(`\nTesting Context: "${c.ctx}" (Pacing: ${c.pacing})`);

    // Test Fallback
    const fallback = await vg05RealEngine({ scene_context: c.ctx, pacing_score: c.pacing });
    console.log(`Fallback Preset: ${fallback.vfx_preset}`);

    // Test AI (Mock Mode)
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.ENABLE_VG05_AI = '1';
    process.env.LLM_MOCK_MODE = '1';

    const aiResult = await vg05RealEngine({ scene_context: c.ctx, pacing_score: c.pacing });
    console.log(`AI Mock Preset: ${aiResult.vfx_preset}`);
    console.log(`AI Intensity: ${aiResult.intensity}`);
    console.log(`AI Filter: ${aiResult.filter_string}`);
    console.log(`AI Reason: ${aiResult.description}`);
  }
}

runTest().catch(console.error);
