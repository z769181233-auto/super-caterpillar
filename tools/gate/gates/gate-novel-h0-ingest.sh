#!/bin/bash
IFS=$'
	'
set -e

# Gate: Novel Ingest Audit (Phase H0)
# Usage: ./gate-novel-h0-ingest.sh [docx_path]

DOCX_PATH=${1:-"docs/novels/source/BOOK.docx"}
TS=$(date +%Y%m%d_%H%M%S)
EVI_DIR="docs/_evidence/phase_h0_ingest_$TS"

echo "=== Gate: Novel Ingest (H0) Started ==="
echo "Input: $DOCX_PATH"
echo "Evidence: $EVI_DIR"

if [ ! -f "$DOCX_PATH" ]; then
    echo "❌ FAIL: Source Docx not found: $DOCX_PATH"
    exit 1
fi

# 1. Run Ingest Tool
node tools/novel_ingest/docx_to_chapters.js "$DOCX_PATH" "$EVI_DIR"

# 2. Verify Evidence
echo "--- Verifying Artifacts ---"

function verify_exist() {
    if [ ! -f "$1" ]; then
        echo "❌ FAIL: Missing artifact: $1"
        exit 1
    else
         echo "✅ Found: $1"
    fi
}

verify_exist "$EVI_DIR/source_docx_sha256.txt"
verify_exist "$EVI_DIR/novel_chapters.json"
verify_exist "$EVI_DIR/novel_chapters_sha256.txt"
verify_exist "$EVI_DIR/ingest_stats.json"

# 3. Assert Stats
echo "--- Auditing Content Stats ---"
node -e "
const fs = require('fs');
const stats = JSON.parse(fs.readFileSync('$EVI_DIR/ingest_stats.json', 'utf8'));
const chapters = JSON.parse(fs.readFileSync('$EVI_DIR/novel_chapters.json', 'utf8'));

console.log('Total Chapters:', stats.totalChapters);
console.log('Total Chars:', stats.totalChars);

// Rule: Must verify > 0 chapters
if (stats.totalChapters <= 0) {
    console.error('❌ FAIL: No chapters extracted');
    process.exit(1);
}

// Rule: No Empty Chapters (Char Count > 0)
// Except maybe 0 if Prologue allowed, but spec says no empty.
const empty = stats.emptyChapters;
if (empty.length > 0) {
    console.error('❌ FAIL: Empty chapters detected:', empty);
    process.exit(1);
}

// Rule: Check Titles
const badTitles = chapters.filter(c => !c.title || c.title.trim().length === 0);
if (badTitles.length > 0) {
    console.error('❌ FAIL: Chapters with missing titles found');
    process.exit(1);
}

console.log('✅ Content Audit Passed');
"

echo "=== Gate H0 Passed Successfully ==="
