const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Phase H1: Chapter to Episode Map
 * Usage: node chapter_to_episode_map.js [evi_dir]
 */

const chaptersPath = path.join(__dirname, '../../docs/novels/ssot/novel_chapters.json');
const eviDir =
  process.argv[2] ||
  path.join(
    __dirname,
    '../../docs/_evidence/phase_h1_map_' + new Date().toISOString().replace(/[:.]/g, '-')
  );

const TARGET_DURATION_SEC = 360;
const MIN_CHARS = 3200;
const MAX_CHARS = 5200;

if (!fs.existsSync(chaptersPath)) {
  console.error(`SSOT Not Found: ${chaptersPath}`);
  process.exit(1);
}

fs.mkdirSync(eviDir, { recursive: true });

function mapEpisodes() {
  console.log(`[H1] Mapping Episodes...`);
  const chapters = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));

  const episodes = [];
  let currentEpisode = null;
  let episodeCounter = 1;

  function startNewEpisode() {
    const id = `E${String(episodeCounter).padStart(4, '0')}`;
    episodeCounter++;
    return {
      episodeId: id,
      targetDurationSec: TARGET_DURATION_SEC,
      charSum: 0,
      sources: [],
    };
  }

  currentEpisode = startNewEpisode();

  chapters.forEach((ch) => {
    // Simple logic: Append whole chapters until threshold met.
    // In real world, we might split chapters. Here we assume chapters are atomic units for mapping
    // UNLESS a single chapter is huge (which we generated mock specs for).
    // Let's implement line-based splitting for better granularity.

    const lines = ch.text.split('\n');

    lines.forEach((line, idx) => {
      const lineLen = line.length;
      if (lineLen === 0) return;

      // Add source ref
      currentEpisode.sources.push({
        chapterNo: ch.chapterNo,
        chapterTitle: ch.title,
        lineIdx: idx,
        text: line,
        charCount: lineLen,
      });
      currentEpisode.charSum += lineLen;

      // Check if full
      if (currentEpisode.charSum >= MIN_CHARS) {
        // If we exceed MAX significantly, we might want to split earlier, but let's stick to simple accumulation.
        episodes.push(currentEpisode);
        currentEpisode = startNewEpisode();
      }
    });
  });

  // Push last partial
  if (currentEpisode.charSum > 0) {
    // Mark as underfilled if necessary, but keep it.
    if (currentEpisode.charSum < MIN_CHARS) {
      currentEpisode.underfilled = true;
    }
    episodes.push(currentEpisode);
  }

  // Generate Report
  console.log(`Mapped ${episodes.length} episodes.`);

  const map = {
    generatedAt: new Date().toISOString(),
    totalEpisodes: episodes.length,
    episodes: episodes,
  };

  const mapPath = path.join(__dirname, '../../docs/novels/ssot/episode_map.json');
  const mapData = JSON.stringify(map, null, 2);

  fs.writeFileSync(mapPath, mapData);
  const mapSha = crypto.createHash('sha256').update(mapData).digest('hex');

  fs.writeFileSync(path.join(eviDir, 'episode_map.json'), mapData);
  fs.writeFileSync(path.join(eviDir, 'episode_map_sha256.txt'), mapSha);

  // Stats Report
  const stats = {
    totalEpisodes: episodes.length,
    avgChars: Math.round(episodes.reduce((a, b) => a + b.charSum, 0) / episodes.length),
    underfilledCount: episodes.filter((e) => e.underfilled).length,
    minChars: Math.min(...episodes.map((e) => e.charSum)),
    maxChars: Math.max(...episodes.map((e) => e.charSum)),
  };
  fs.writeFileSync(path.join(eviDir, 'map_stats.json'), JSON.stringify(stats, null, 2));
  console.log(`Stats:`, stats);
  console.log(`SSOT: ${mapPath}`);
  console.log(`Evidence: ${eviDir}`);
}

mapEpisodes();
