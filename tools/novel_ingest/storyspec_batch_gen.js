const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Phase H2: Episode Map to StorySpec (Batch Generator)
 * Usage: node storyspec_batch_gen.js <map_path> <output_dir>
 */

const mapPath = process.argv[2] || path.join(__dirname, '../../docs/novels/ssot/episode_map.json');
const outDir = process.argv[3] || path.join(__dirname, '../../docs/story_bank/season_novel_01');

if (!fs.existsSync(mapPath)) {
  console.error(`Map Not Found: ${mapPath}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function generateSpecs() {
  console.log(`[H2] Generating StorySpecs...`);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  map.episodes.forEach((ep) => {
    // Mock Generation Logic (Template-based)
    // In real world, LLM or Writer Agent would do this based on ep.sources
    // Here we ensure structure compliance (P0) and Ancient Assets usage (P1)

    const spec = {
      id: ep.episodeId,
      title: `Episode ${ep.episodeId}`,
      logline: `The conflict escalates in ${ep.episodeId}`,
      coreEvent: '薛知盈 tries to escape from the Xiao Mansion but is intercepted.',
      goal: 'Escape the Xiao Mansion unnoticed.',
      characters: ['CH_XUE_ZHIYING', 'CH_XIAO_YUNQI', 'CH_CHUNTAO'],
      locations: ['LO_XIAO_MANSION', 'LO_INN_ROOM'],
      episodeMeta: {
        durationSec: ep.targetDurationSec || 360,
      },
      obstacles: [
        'Wang Momo is patrolling the garden (薛知盈 hides behind the rockery)',
        'The side gate is locked (薛知盈 tries to pick the lock)',
        'Xiao Yunqi appears at the gate (He blocks her path)',
      ],
      turns: [
        'Xiao Yunqi reveals he knows her plan',
        '薛知盈 threatens to scream',
        'Xiao Yunqi offers a compromise',
      ],
      cliffhanger: 'A mysterious letter arrives for 薛知盈.',
      sourceShaRef: crypto.createHash('sha256').update(JSON.stringify(ep.sources)).digest('hex'),
    };

    // Output
    const outFile = path.join(outDir, `${ep.episodeId}.story.json`);
    const json = JSON.stringify(spec, null, 2);
    fs.writeFileSync(outFile, json);

    // Checksum
    const sha = crypto.createHash('sha256').update(json).digest('hex');
    fs.writeFileSync(path.join(outDir, `${ep.episodeId}.story.json.sha256`), sha);
  });

  console.log(`Generated ${map.episodes.length} StorySpecs in ${outDir}`);
}

generateSpecs();
