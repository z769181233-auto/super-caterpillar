const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Gate: Real Render Physical Assertion (V3)
 * Usage: node gate_real_render_assert.js <mp4_path> <report_json>
 */

const mp4Path = process.argv[2];
const reportPath = process.argv[3];

if (!mp4Path) {
  console.error('Usage: node gate_real_render_assert.js <mp4_path> <report_json>');
  process.exit(1);
}

console.log(`=== Gate: Real Render Physical Assert ===`);
console.log(`Target: ${mp4Path}`);

try {
  // 1. FFprobe Metadata
  const ffprobeOut = execSync(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${mp4Path}"`
  ).toString();
  const ffprobe = JSON.parse(ffprobeOut);
  const videoStream = ffprobe.streams.find((s) => s.codec_type === 'video');

  const width = videoStream.width;
  const height = videoStream.height;
  const fps = videoStream.r_frame_rate;
  const duration = parseFloat(ffprobe.format.duration);

  console.log(`Metadata: ${width}x${height}, ${fps} fps, ${duration}s`);

  const assertions = [
    { name: 'Resolution >= 720p', passed: width >= 1280 && height >= 720 },
    { name: 'FPS == 24', passed: fps === '24/1' },
    { name: 'Duration non-zero', passed: duration > 0 },
  ];

  // 2. Pixel Analysis (Non-empty screen check)
  // We use signalstats + metadata print to get YAVG and YMAX
  const statsCmd = `ffmpeg -i "${mp4Path}" -vf "signalstats,metadata=mode=print" -frames:v 1 -f null - 2>&1`;
  const statsOut = execSync(statsCmd).toString();

  // Extract YAVG and YMAX
  const yAvgMatch = statsOut.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
  const yMaxMatch = statsOut.match(/lavfi\.signalstats\.YMAX=([0-9.]+)/);

  const yAvg = yAvgMatch ? parseFloat(yAvgMatch[1]) : 0;
  const yMax = yMaxMatch ? parseFloat(yMaxMatch[1]) : 0;

  console.log(`Luminance Analysis: YAVG=${yAvg}, YMAX=${yMax}`);

  // Asserts: YAVG > 1 (not pitch black) AND YMAX > 10 (has some bright pixels)
  const visualContentPassed = yAvg > 1.0 && yMax > 10.0;
  assertions.push({ name: 'Visual Content Present (Non-Black)', passed: visualContentPassed });

  const failed = assertions.filter((a) => !a.passed);
  const report = {
    timestamp: new Date().toISOString(),
    mp4: mp4Path,
    metadata: { width, height, fps, duration, yAvg, yMax },
    assertions: assertions,
    status: failed.length === 0 ? 'PASS' : 'FAIL',
  };

  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    console.error(`❌ FAILED assertions:`);
    failed.forEach((f) => console.error(` - ${f.name}`));
    process.exit(1);
  } else {
    console.log('✅ SUCCESS: Physical Authenticity Verified.');
  }
} catch (err) {
  console.error(`❌ FATAL: ${err.message}`);
  process.exit(1);
}
