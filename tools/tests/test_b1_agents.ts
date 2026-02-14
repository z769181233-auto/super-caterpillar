import { runMultiAgentAnalysis, AgentRole } from '../../apps/workers/src/agents';

async function test() {
  console.log('=== B1 Multi-Agent Test ===');

  process.env.MOCK_LLM = '1';

  const context: any = {
    projectId: 'test-proj',
    traceId: 'test-trace',
    rawText: '李傲天走进幽静的山谷，四周寂静无声。',
    chapterTitle: '第一章：初入禁地',
    chapterIndex: 1,
    previousResults: {},
    organizationId: 'test-org',
    memories: {
      longTerm: '山谷中有隐藏的阵法。',
      shortTerm: '李傲天刚刚摆脱了追兵。',
      entityStates: '李傲天：状态良好，持有短剑。',
    },
  };

  try {
    const result = await runMultiAgentAnalysis(context);
    console.log('Result from Multi-Agent Chain:');
    console.log(JSON.stringify(result, null, 2));

    if (result.scenes && result.scenes[0].shots[0].visualParams) {
      console.log('\n[PASS] Multi-Agent chain produced visualParams!');
    } else {
      console.log('\n[FAIL] Missing visualParams in output.');
    }
  } catch (e) {
    console.error('Test failed with error:', e);
  }
}

test();
