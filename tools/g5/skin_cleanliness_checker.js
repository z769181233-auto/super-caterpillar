const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * G5 Skin Cleanliness Checker (V3 - Heatmap & ROI)
 */
async function checkSkinCleanliness(imagePath, roi = null, heatmapPath = null) {
  const probe = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 "${imagePath}"`
  )
    .toString()
    .trim()
    .split('\n');
  const fullW = parseInt(probe[0]);
  const fullH = parseInt(probe[1]);

  const w = roi ? roi.w : fullW;
  const h = roi ? roi.h : fullH;
  const cropFilter = roi ? `crop=${roi.w}:${roi.h}:${roi.x}:${roi.y},` : '';

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      imagePath,
      '-vf',
      `${cropFilter}format=gray`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ]);

    let chunks = [];
    ffmpeg.stdout.on('data', (d) => chunks.push(d));
    ffmpeg.on('close', async (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg failed`));
      const data = Buffer.concat(chunks);
      const spots = detectSpots(new Uint8Array(data), w, h);

      if (heatmapPath) {
        await generateHeatmap(imagePath, spots.rawSpots, w, h, roi, heatmapPath);
      }

      resolve({
        imagePath: path.basename(imagePath),
        spotCount: spots.count,
        maxArea: spots.maxArea,
        status: spots.count > 0 ? 'FAIL' : 'PASS',
        heatmap: heatmapPath ? path.basename(heatmapPath) : null,
      });
    });
  });
}

function detectSpots(data, w, h) {
  const thresh = 70;
  const visited = new Uint8Array(data.length);
  let spotCount = 0;
  let maxArea = 0;
  const rawSpots = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;

      const center = data[idx];
      let sum = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy,
            nx = x + dx;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += data[ny * w + nx];
            n++;
          }
        }
      }
      const avg = sum / n;
      if (Math.abs(center - avg) > thresh) {
        const blob = [];
        const area = bfs(data, visited, x, y, w, h, thresh, blob);
        if (area > 0 && area <= 12) {
          spotCount++;
          if (area > maxArea) maxArea = area;
          rawSpots.push(blob);
        }
      }
      visited[idx] = 1;
    }
  }
  return { count: spotCount, maxArea, rawSpots };
}

function bfs(data, visited, startX, startY, w, h, thresh, blob = null) {
  const queue = [[startX, startY]];
  visited[startY * w + startX] = 1;
  let area = 0;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    area++;
    if (blob) blob.push({ x: cx, y: cy });
    if (area > 20) return area;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nIdx = ny * w + nx;
          if (!visited[nIdx]) {
            const nVal = data[nIdx];
            let nSum = 0,
              nn = 0;
            for (let ddy = -1; ddy <= 1; ddy++) {
              for (let ddx = -1; ddx <= 1; ddx++) {
                const nny = ny + ddy,
                  nnx = nx + ddx;
                if (nnx >= 0 && nnx < w && nny >= 0 && nny < h) {
                  nSum += data[nny * w + nnx];
                  nn++;
                }
              }
            }
            if (Math.abs(nVal - (nSum - nVal) / (nn - 1)) > thresh * 0.7) {
              visited[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }
  return area;
}

async function generateHeatmap(source, spots, w, h, roi, outPath) {
  // We'll use ffmpeg to draw boxes on the image
  let filter = roi ? `crop=${roi.w}:${roi.h}:${roi.x}:${roi.y}` : 'null';
  spots.forEach((blob) => {
    // Just take the first pixel of each blob for simplicity in drawbox (or calculate mean)
    const p = blob[0];
    filter += `,drawbox=x=${p.x - 2}:y=${p.y - 2}:w=5:h=5:c=red:t=fill`;
  });

  execSync(`ffmpeg -y -i "${source}" -vf "${filter}" "${outPath}" -loglevel error`);
}

async function main() {
  const target = process.argv[2];
  const heatmap = process.argv.includes('--heatmap')
    ? process.argv[process.argv.indexOf('--heatmap') + 1]
    : null;
  let roi = null;
  if (process.argv.includes('--roi')) {
    const r = process.argv[process.argv.indexOf('--roi') + 1].split(',').map(Number);
    roi = { x: r[0], y: r[1], w: r[2], h: r[3] };
  }

  if (!target) process.exit(1);
  const report = await checkSkinCleanliness(target, roi, heatmap);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();

module.exports = { checkSkinCleanliness };
