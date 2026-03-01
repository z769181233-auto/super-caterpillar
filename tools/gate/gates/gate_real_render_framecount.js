const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Gate: Real Render Frame Count Alignment
 * Asserts: nb_frames == expected_frames
 */

const mp4Path = process.argv[2];
const expectedDurationSec = parseFloat(process.argv[3]);
const outputFile = process.argv[4];

if (!mp4Path || isNaN(expectedDurationSec)) {
  console.error(
    'Usage: node gate_real_render_framecount.js <mp4_path> <expected_duration_sec> [output_file]'
  );
  process.exit(1);
}

const expectedFrames = Math.round(expectedDurationSec * 24);

try {
  const ffprobeCmd = `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "${mp4Path}"`;
  const actualFrames = parseInt(execSync(ffprobeCmd).toString().trim());

  const result = {
    timestamp: new Date().toISOString(),
    mp4Path,
    expectedDurationSec,
    expectedFrames,
    actualFrames,
    diff: actualFrames - expectedFrames,
    status: Math.abs(actualFrames - expectedFrames) === 0 ? 'PASS' : 'FAIL',
  };

  console.log(`=== Gate: Render Frame Count ===`);
  console.log(`Expected: ${expectedFrames} frames (${expectedDurationSec}s @ 24fps)`);
  console.log(`Actual:   ${actualFrames} frames`);

  if (result.status === 'PASS') {
    console.log('✅ SUCCESS: Frame count is byte-exact.');
  } else {
    console.error(`❌ FAIL: Frame count mismatch! Diff: ${result.diff}`);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  }

  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (err) {
  console.error('❌ Gate Error:', err.message);
  process.exit(1);
}
