import { ce04RealEngine } from '../packages/engines/ce04/real';
import { CE04Input } from '../packages/engines/ce04/types';

async function runVerification() {
    console.log('=== CE04 AI Upgrade Verification ===');

    const testCases: Array<{ name: string; text: string }> = [
        {
            name: 'Simple Action',
            text: '少年在雨中奔跑。',
        },
        {
            name: 'Emotional Scene',
            text: '她站在空旷的火车站台，眼角噙着泪水，望着远去的列车。',
        },
    ];

    // 1. Test Fallback Mode
    console.log('\n--- Mode: Template Fallback ---');
    process.env.ENABLE_CE04_AI = '0';
    for (const tc of testCases) {
        const output = await ce04RealEngine({ structured_text: tc.text });
        console.log(`[Template] ${tc.name}: Enriched="${output.enriched_prompt.slice(0, 50)}..."`);
    }

    // 2. Test AI Mode
    console.log('\n--- Mode: AI Enabled ---');
    process.env.ENABLE_CE04_AI = '1';
    process.env.OPENAI_API_KEY = 'MOCK_KEY';
    process.env.LLM_MOCK_MODE = '1';

    for (const tc of testCases) {
        try {
            const output = await ce04RealEngine({ structured_text: tc.text });
            console.log(`[AI] ${tc.name}: Enriched="${output.enriched_prompt}"`);
            console.log(`    Parts: ${JSON.stringify(output.prompt_parts)}`);
        } catch (e: any) {
            console.error(`[AI] ${tc.name} Failed: ${e.message}`);
        }
    }
}

runVerification();
