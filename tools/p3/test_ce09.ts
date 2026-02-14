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
