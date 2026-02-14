import { ce08RealEngine } from '../packages/engines/ce08/src';

async function runTest() {
    console.log('--- CE08 AI Character Arc Verification ---');

    const cases = [
        { name: '林晚舟', desc: '在目睹了好友的背叛后，林晚舟并没有流泪，而是平静地烧掉了所有的往来书信，眼神比冬日的寒冰还要冷。' },
        { name: '小石头', desc: '虽然两腿发抖，但他还是紧紧握住那根锈迹斑斑的铁棍，挡在了妹妹身前，对着黑暗中的巨兽发出了人生第一声咆哮。' }
    ];

    for (const c of cases) {
        console.log(`\nTesting Character: "${c.name}"`);
        console.log(`Scenario: "${c.desc}"`);

        // Test Fallback
        const fallback = await ce08RealEngine({ character_name: c.name, scenario_text: c.desc });
        console.log(`Fallback Arc Status: ${fallback.arc_status}`);

        // Test AI (Mock Mode)
        process.env.OPENAI_API_KEY = 'mock-key';
        process.env.ENABLE_CE08_AI = '1';
        process.env.LLM_MOCK_MODE = '1';

        const aiResult = await ce08RealEngine({ character_name: c.name, scenario_text: c.desc });
        console.log(`AI Archetype: ${aiResult.archetype}`);
        console.log(`AI Markers: ${aiResult.progression_markers.join(', ')}`);
        console.log(`AI Description: ${aiResult.description}`);
    }
}

runTest().catch(console.error);
