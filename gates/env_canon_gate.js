const fs = require('fs');

const CANON_FILE = process.argv[2];

try {
  const canon = JSON.parse(fs.readFileSync(CANON_FILE, 'utf8'));
  let errors = [];

  // 1. Check Forbidden Terms
  const inputStr = JSON.stringify(canon).toLowerCase();
  const fuzzyTerms = ['atmospheric', 'moody', 'cool', 'cinematic', '氛围', '大片']; // checking for subjective filler
  fuzzyTerms.forEach((term) => {
    if (inputStr.includes(term)) errors.push(`FUZZY_TERM_DETECTED: ${term}`);
  });

  // 2. Lighting Rules
  if (!canon.lighting || !canon.lighting.key_light) errors.push('MISSING_LIGHTING_KEY');

  if (errors.length > 0) {
    console.error('⛔ ENV CANON GATE FAIL');
    console.error(errors.join('\n'));
    process.exit(1);
  } else {
    console.log('✅ ENV CANON GATE PASS');
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
