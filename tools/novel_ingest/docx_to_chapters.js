const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const crypto = require('crypto');

/**
 * Phase H0: Novel Ingest - Docx to Chapters SSOT
 * Usage: node docx_to_chapters.js <docx_path> [evidence_dir]
 */

const docxPath = process.argv[2];
if (!docxPath) {
  console.error('Usage: node docx_to_chapters.js <docx_path> [evidence_dir]');
  process.exit(1);
}

const eviDir =
  process.argv[3] ||
  path.join(
    __dirname,
    '../../docs/_evidence/phase_h0_ingest_' + new Date().toISOString().replace(/[:.]/g, '-')
  );
fs.mkdirSync(eviDir, { recursive: true });

async function ingest() {
  console.log(`[H0] Ingesting: ${docxPath}`);

  // 1. Audit Source File
  const docxBuf = fs.readFileSync(docxPath);
  const docxSha = crypto.createHash('sha256').update(docxBuf).digest('hex');
  fs.writeFileSync(path.join(eviDir, 'source_docx_sha256.txt'), docxSha);
  console.log(`Source SHA: ${docxSha}`);

  // 2. Extract Text
  const result = await mammoth.extractRawText({ buffer: docxBuf });
  const fullText = result.value; // The raw text
  const warnings = result.messages;
  if (warnings.length > 0) {
    console.warn('Mammoth Warnings:', warnings);
  }

  // 3. Split Chapters
  // Regex: ^第\s*\d+\s*章
  // Clean text: remove \r, unified \n
  const cleanText = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');

  const chapters = [];
  let currentChapter = null;
  let prelogueBuffer = [];

  const chapterRegex = /^\s*第\s*\d+\s*章/;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return; // Skip empty lines

    if (chapterRegex.test(trimmed)) {
      // New Chapter
      if (currentChapter) {
        chapters.push(currentChapter);
      } else if (prelogueBuffer.length > 0) {
        // Handle prologue if any (not expected by spec but good for robustness)
        chapters.push({
          chapterNo: 0,
          title: 'Prologue / Frontmatter',
          lines: prelogueBuffer,
        });
      }

      // Extract chapter number
      const match = trimmed.match(/第\s*(\d+)\s*章/);
      const chapterNo = match ? parseInt(match[1], 10) : chapters.length + 1;

      currentChapter = {
        chapterNo: chapterNo,
        title: trimmed,
        lines: [],
      };
    } else {
      if (currentChapter) {
        currentChapter.lines.push(trimmed);
      } else {
        prelogueBuffer.push(trimmed);
      }
    }
  });
  // Push last chapter
  if (currentChapter) chapters.push(currentChapter);

  console.log(`Extracted ${chapters.length} chapters.`);

  // 4. Transform to SSOT Format
  const ssotChapters = chapters.map((ch) => {
    const text = ch.lines.join('\n');
    return {
      chapterNo: ch.chapterNo,
      title: ch.title,
      text: text,
      charCount: text.length,
      sha256: crypto.createHash('sha256').update(text).digest('hex'),
    };
  });

  // 5. Output SSOT JSON
  const outputPath = path.join(__dirname, '../../docs/novels/ssot/novel_chapters.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const outputData = JSON.stringify(ssotChapters, null, 2);
  fs.writeFileSync(outputPath, outputData);

  const jsonSha = crypto.createHash('sha256').update(outputData).digest('hex');
  fs.writeFileSync(path.join(eviDir, 'novel_chapters.json'), outputData); // Evidence copy
  fs.writeFileSync(path.join(eviDir, 'novel_chapters_sha256.txt'), jsonSha);

  // 6. Generate Sub-Reports
  const charCounts = ssotChapters.map((c) => c.charCount);
  const totalChars = charCounts.reduce((a, b) => a + b, 0);
  const stats = {
    totalChapters: ssotChapters.length,
    totalChars: totalChars,
    avgCharsPerChapter: Math.round(totalChars / ssotChapters.length),
    emptyChapters: ssotChapters.filter((c) => c.charCount === 0).map((c) => c.chapterNo),
    charCountDist: charCounts,
  };
  fs.writeFileSync(path.join(eviDir, 'ingest_stats.json'), JSON.stringify(stats, null, 2));

  console.log(`[Success] Ingest Complete.`);
  console.log(`SSOT: ${outputPath}`);
  console.log(`Evidence: ${eviDir}`);
  console.log(`Stats: ${stats.totalChapters} chapters, ${stats.totalChars} chars.`);
}

ingest().catch((err) => {
  console.error(err);
  process.exit(1);
});
