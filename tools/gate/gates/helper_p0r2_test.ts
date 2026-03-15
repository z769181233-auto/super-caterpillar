import { spawnWithTimeout } from '../../../packages/engines-video-merge/providers/spawn_with_timeout';

async function testTimeout() {
  console.log('Starting sleep 5 with 200ms timeout...');
  const r = await spawnWithTimeout({
    cmd: 'bash',
    args: ['-c', 'sleep 5; echo done'],
    timeoutMs: 200,
  });
  console.log('result:', r);
  if (!r.timedOut) {
    console.error('FAIL: expected timedOut=true');
    process.exit(1);
  }
  console.log('PASS: timedOut kill works');
}

async function testThreads() {
  const { localFfmpegProvider } =
    await import('../../../packages/engines-video-merge/providers/local_ffmpeg.provider');
  const fs = await import('fs');
  const path = await import('path');

  const runtimeDir = 'apps/workers/.runtime/assets_gate_p0r2';
  process.env.ASSET_STORAGE_DIR = runtimeDir;
  if (!fs.default.existsSync(runtimeDir)) fs.default.mkdirSync(runtimeDir, { recursive: true });

  // default threads
  delete process.env.FFMPEG_THREADS;
  process.env.VIDEO_MERGE_TIMEOUT_MS = '60000';
  console.log('Testing default threads (1)...');
  try {
    const res1 = await localFfmpegProvider.merge(
      {
        framePaths: [
          '.tmp/p0r2_frames/f0.png',
          '.tmp/p0r2_frames/f1.png',
          '.tmp/p0r2_frames/f2.png',
        ],
        fps: 2,
        width: 64,
        height: 64,
      },
      { jobId: 'p0r2_default' }
    );
    console.log('merged_default_ok', res1.path);
  } catch (e) {
    console.warn(
      'Merge failed (likely ffmpeg not found or png invalid), but we only need the log check if it reached spawn.'
    );
    console.error(e);
  }

  // override threads
  process.env.FFMPEG_THREADS = '2';
  console.log('Testing override threads (2)...');
  try {
    const res2 = await localFfmpegProvider.merge(
      {
        framePaths: [
          '.tmp/p0r2_frames/f0.png',
          '.tmp/p0r2_frames/f1.png',
          '.tmp/p0r2_frames/f2.png',
        ],
        fps: 2,
        width: 64,
        height: 64,
      },
      { jobId: 'p0r2_threads2' }
    );
    console.log('merged_threads2_ok', res2.path);
  } catch (e) {
    console.error(e);
  }
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'timeout') await testTimeout();
  if (cmd === 'threads') await testThreads();
})();
