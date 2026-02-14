import { ce13RealEngine } from '../packages/engines/ce13/real';
import { CE13Input } from '../packages/engines/ce13/types';

async function runVerification() {
  console.log('=== CE13 AI Implementation Verification ===');

  const testCases: Array<{ name: string; text: string }> = [
    {
      name: 'Fast Pacing (Action)',
      text: '他冲了过去！挥拳！闪躲！',
    },
    {
      name: 'Slow Pacing (Descriptive)',
      text: '窗外的柳树随风轻轻摇曳，湖面上泛起阵阵涟漪，夕阳的余晖洒在静默的古桥上，显得格外宁静悠远。',
    },
  ];

  // 1. Test Fallback Mode
  console.log('\n--- Mode: Rule Fallback ---');
  process.env.ENABLE_CE13_AI = '0';
  for (const tc of testCases) {
    const output = await ce13RealEngine({ structured_text: tc.text });
    console.log(
      `[Rule] ${tc.name}: Pacing=${output.pacing_score.toFixed(2)} Tension=${output.tension_level}`
    );
  }

  // 2. Test AI Mode
  console.log('\n--- Mode: AI Enabled ---');
  process.env.ENABLE_CE13_AI = '1';
  process.env.OPENAI_API_KEY = 'MOCK_KEY';
  process.env.LLM_MOCK_MODE = '1';

  for (const tc of testCases) {
    try {
      const output = await ce13RealEngine({ structured_text: tc.text });
      console.log(
        `[AI] ${tc.name}: Pacing=${output.pacing_score.toFixed(2)} Tension=${output.tension_level}`
      );
      console.log(
        `    Emotional: ${output.emotional_intensity.toFixed(2)} Indicators: ${JSON.stringify(output.indicators)}`
      );
    } catch (e: any) {
      console.error(`[AI] ${tc.name} Failed: ${e.message}`);
    }
  }
}

runVerification();
