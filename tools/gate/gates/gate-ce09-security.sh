#!/usr/bin/env bash
# CE09 媒体安全合规引擎验证

set -euo pipefail

EVID_DIR="./evidence/ce09_security_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"
mkdir -p tools/p3

echo "=== CE09 媒体安全合规引擎验证 ===" | tee "$EVID_DIR/gate.log"

# 创建测试视频文件
TEST_VIDEO="/tmp/ce09_test.mp4"
ffmpeg -y -f lavfi -i color=c=blue:s=320x240:d=2 -pix_fmt yuv420p "$TEST_VIDEO"

# 这里是关键：更新嵌入的测试脚本，避免使用 EngineInvokeStatus Enum
cat <<'EOF' > tools/p3/test_ce09.ts
import { CE09SecurityLocalAdapter } from '../../apps/api/src/engines/adapters/ce09-security.local.adapter';

async function main() {
    console.log('[Test 1] Security Processing (Embedded V4)');
    const engine = new CE09SecurityLocalAdapter();
    
    const context = {
        projectId: 'ce09-test',
        userId: 'system',
        traceId: 'trace-ce09',
        jobId: 'job-ce09'
    };
    
    const res1 = await (engine as any).invoke({
        jobType: 'PP_RENDER',
        engineKey: 'ce09_security',
        payload: { 
            videoPath: 'ce09_test.mp4', 
            watermarkText: 'SCU_TEST_GATE',
            projectId: 'ce09-test',
            pipelineRunId: 'run-001'
        },
        context
    });

    console.log('[DEBUG] Status:', res1.status);

    if (res1.status === 'SUCCESS') {
        console.log('✓ Secure Storage Key:', res1.output.storageKey);
        console.log('✓ HLS Playlist:', res1.output.hlsPlaylistKey);
        console.log('\n✅ CE09 Verified!');
        process.exit(0);
    } else {
        console.error('❌ CE09 Failed:', res1.error);
        process.exit(1);
    }
}

process.env.STORAGE_ROOT = '/tmp';
main().catch(err => {
    console.error('❌ Test Runner Crash:', err.message);
    process.exit(1);
});
EOF

npx ts-node -r tsconfig-paths/register tools/p3/test_ce09.ts 2>&1 | tee "$EVID_DIR/test_output.log"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ CE09 Gate PASS" | tee -a "$EVID_DIR/gate.log"
    exit 0
else
    echo "❌ CE09 Gate FAIL" | tee -a "$EVID_DIR/gate.log"
    exit 1
fi
