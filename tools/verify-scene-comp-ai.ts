import { sceneCompositionRealEngine } from '../packages/engines/scene_composition/src';

async function runTest() {
  console.log('--- Scene Composition AI Verification ---');

  const cases = [
    {
      desc: '一名剑客站在悬崖边缘，背后是巨大的满月',
      elements: [
        { id: 'swordsman', url: 'file:///tmp/sword.png', description: '站在悬崖边的剑客' },
        { id: 'moon', url: 'file:///tmp/moon.png', description: '背景中的巨大满月' },
      ],
    },
  ];

  for (const c of cases) {
    console.log(`\nTesting Scene: "${c.desc}"`);

    // Test Fallback
    const fallback = await sceneCompositionRealEngine({
      scene_description: c.desc,
      background_url: 'file:///tmp/bg.png',
      elements: c.elements as any,
    });
    console.log(`Fallback Mode: ${fallback.composition_mode}`);

    // Test AI (Mock Mode)
    process.env.OPENAI_API_KEY = 'mock-key';
    process.env.ENABLE_SCENE_COMP_AI = '1';
    process.env.LLM_MOCK_MODE = '1';

    const aiResult = await sceneCompositionRealEngine({
      scene_description: c.desc,
      background_url: 'file:///tmp/bg.png',
      elements: c.elements as any,
    });
    console.log(`AI Mock Mode: ${aiResult.composition_mode}`);
    console.log(
      `AI Elements: ${JSON.stringify(aiResult.elements.map((e) => ({ id: e.id, x: e.x, y: e.y, scale: e.scale })))}`
    );
    console.log(`AI Reason: ${aiResult.description}`);
  }
}

runTest().catch(console.error);
