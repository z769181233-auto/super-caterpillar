const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Gate: Real Render Motion Assert (Fixed V2)
 * Asserts: mean(YAVG difference) >= 3.0
 */

const mp4Path = process.argv[2];
const outputFile = process.argv[3];

if (!mp4Path) {
  console.error('Usage: node gate_real_render_motion.js <mp4_path> [output_file]');
  process.exit(1);
}

try {
  console.log(`=== Gate: Real Render Motion Assert ===`);
  console.log(`Analyzing motion intensity for: ${mp4Path}`);

  // Sample 10s and calculate difference signalstats with metadata print
  const ffmpegCmd = `ffmpeg -t 10 -i "${mp4Path}" -vf "tblend=all_mode=difference,signalstats,metadata=mode=print" -f null - 2>&1`;
  const output = execSync(ffmpegCmd).toString();

  const yavgMatches = output.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/g);
  if (!yavgMatches) {
    throw new Error(
      'Could not extract signalstats from FFmpeg output. Ensure FFmpeg is built with signalstats filter.'
    );
  }

  const yavgs = yavgMatches.map((m) => parseFloat(m.split('=')[1]));
  const meanYavg = yavgs.reduce((a, b) => a + b, 0) / yavgs.length;
  const maxYavg = Math.max(...yavgs);

  const result = {
    timestamp: new Date().toISOString(),
    mp4Path,
    samples: yavgs.length,
    meanYavg: parseFloat(meanYavg.toFixed(4)),
    maxYavg: parseFloat(maxYavg.toFixed(4)),
    threshold: 3.0,
    status: meanYavg >= 3.0 ? 'PASS' : 'FAIL',
  };

  console.log(`Motion Mean (YAVG Diff): ${result.meanYavg} (Threshold: ${result.threshold})`);
  console.log(`Motion Peak (YAVG Diff): ${result.maxYavg}`);

  if (result.status === 'PASS') {
    console.log('✅ SUCCESS: Motion intensity identifies active video production.');
  } else {
    console.error('❌ FAIL: Motion intensity too low! Static image detected.');
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  }

  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (err) {
  console.error('❌ Gate Error:', err.message);
  process.exit(1);
}
