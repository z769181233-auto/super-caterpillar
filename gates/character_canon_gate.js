const fs = require('fs');

const CANON_FILE = process.argv[2];

try {
  const canon = JSON.parse(fs.readFileSync(CANON_FILE, 'utf8'));
  let errors = [];

  // 1. Check Forbidden Terms
  const inputStr = JSON.stringify(canon).toLowerCase();
  const fuzzyTerms = ['beautiful', 'pretty', 'nice', 'good style', 'maybe', '唯美', '精致', '好看'];
  fuzzyTerms.forEach((term) => {
    if (inputStr.includes(term)) errors.push(`FUZZY_TERM_DETECTED: ${term}`);
  });

  // 2. Face Rules
  if (!canon.face || !canon.face.forbidden) errors.push('MISSING_FACE_RULES');

  // 3. Clothing Rules
  if (!canon.clothing || !canon.clothing.layers) errors.push('MISSING_CLOTHING_LAYERS');

  if (errors.length > 0) {
    console.error('⛔ CHARACTER CANON GATE FAIL');
    console.error(errors.join('\n'));
    process.exit(1);
  } else {
    console.log('✅ CHARACTER CANON GATE PASS');
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
