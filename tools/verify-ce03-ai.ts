import { ce03RealEngine } from '../packages/engines/ce03/real';
import { CE03Input } from '../packages/engines/ce03/types';

async function runVerification() {
  console.log('=== CE03 AI Upgrade Verification ===');

  const testCases: Array<{ name: string; text: string }> = [
    {
      name: 'Low Density (Abstract)',
      text: '他坐在那里想了很久，觉得人生虚无。',
    },
    {
      name: 'Medium Density (Basic description)',
      text: '屋子里有一张红色的桌子，窗外阳光明亮。',
    },
    {
      name: 'High Density (Rich visual)',
      text: '刺眼的阳光穿过破碎的彩色玻璃窗，洒在布满青苔的暗红色地砖上。空气中漂浮着金色的尘埃，映照出少女脸上细腻的褶皱和晶莹的泪痕。',
    },
  ];

  // 1. Test Fallback Mode (Algorithm only)
  console.log('\n--- Mode: Algorithm Fallback ---');
  process.env.ENABLE_CE03_AI = '0';
  for (const tc of testCases) {
    const output = await ce03RealEngine({ structured_text: tc.text });
    console.log(
      `[Algorithm] ${tc.name}: Score=${output.visual_density_score.toFixed(2)} Engine=${output.audit_trail.engine_version}`
    );
  }

  // 2. Test AI Mode (if API keys are present)
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    console.log('\n--- Mode: AI Enabled ---');
    process.env.ENABLE_CE03_AI = '1';
    for (const tc of testCases) {
      try {
        const output = await ce03RealEngine({ structured_text: tc.text });
        console.log(
          `[AI] ${tc.name}: Score=${output.visual_density_score.toFixed(2)} Engine=${output.audit_trail.engine_version}`
        );
        console.log(`    Indicators: ${JSON.stringify(output.quality_indicators)}`);
      } catch (e: any) {
        console.error(`[AI] ${tc.name} Failed: ${e.message}`);
      }
    }
  } else {
    console.log('\n--- Skipped AI Mode (Keys missing) ---');
  }
}

runVerification();
