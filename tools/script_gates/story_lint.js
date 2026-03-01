const fs = require('fs');
const path = require('path');

function lintStory(filePath) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [{ ruleId: 'JSON_VALID', message: `Invalid JSON: ${e.message}` }];
  }

  if (!data.goal || typeof data.goal !== 'string' || data.goal.trim() === '') {
    errors.push({ ruleId: 'STORY_GOAL_REQ', message: 'Missing or empty goal' });
  }

  if (!data.obstacles || !Array.isArray(data.obstacles) || data.obstacles.length < 4) {
    errors.push({
      ruleId: 'STORY_OBSTACLES_COUNT',
      message: `Obstacles count ${data.obstacles ? data.obstacles.length : 0} < 4`,
    });
  }

  if (!data.turns || !Array.isArray(data.turns) || data.turns.length < 3 || data.turns.length > 4) {
    errors.push({
      ruleId: 'STORY_TURNS_COUNT',
      message: `Turns count ${data.turns ? data.turns.length : 0} out of range [3, 4]`,
    });
  }

  if (!data.cliffhanger || typeof data.cliffhanger !== 'string' || data.cliffhanger.trim() === '') {
    errors.push({ ruleId: 'STORY_CLIFFHANGER_REQ', message: 'Missing or empty cliffhanger' });
  }

  return errors;
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node story_lint.js <dir>');
  process.exit(1);
}

const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.story.json'));
let hasFail = false;
let totalFiles = 0;

files.forEach((f) => {
  totalFiles++;
  const errs = lintStory(path.join(targetDir, f));
  if (errs.length > 0) {
    console.error(`FAIL: ${f}`);
    errs.forEach((e) => console.error(`  [${e.ruleId}] ${e.message}`));
    hasFail = true;
  } else {
    console.log(`PASS: ${f}`);
  }
});

if (totalFiles === 0) {
  console.warn('No story files found.');
  process.exit(1);
}

if (hasFail) process.exit(1);
process.exit(0);
