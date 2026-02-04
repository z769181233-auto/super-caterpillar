
import * as fs from 'fs';
import * as path from 'path';

const TARGET_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const OUT_FILE = process.argv[2] || 'test_15m.txt';

const PARAGRAPH = "这是一个测试段落，用于模拟小说内容。This is a test paragraph to simulate novel content. It repeats to fill space.\n";
const CHAPTER_HEADER_PREFIX = "\n\n第";
const CHAPTER_HEADER_SUFFIX = "章 测试章节\n\n";

async function generate() {
    const ws = fs.createWriteStream(OUT_FILE, { encoding: 'utf8' });
    let written = 0;
    let chapterCount = 1;
    let inChapter = 0;

    // Write initial volume
    ws.write("第一卷 测试卷\n\n");
    written += Buffer.byteLength("第一卷 测试卷\n\n");

    while (written < TARGET_SIZE_BYTES) {
        // New Chapter every ~10KB
        if (inChapter > 10000) {
            const header = `${CHAPTER_HEADER_PREFIX}${chapterCount}${CHAPTER_HEADER_SUFFIX}`;
            ws.write(header);
            written += Buffer.byteLength(header);
            chapterCount++;
            inChapter = 0;
        }

        ws.write(PARAGRAPH);
        const len = Buffer.byteLength(PARAGRAPH);
        written += len;
        inChapter += len;

        if (written % (1024 * 1024) < len) {
            process.stdout.write(`\rGenerated ${(written / 1024 / 1024).toFixed(2)} MB...`);
        }
    }

    ws.end();
    console.log(`\nDone. Generated ${OUT_FILE} (${(written / 1024 / 1024).toFixed(2)} MB) with ${chapterCount} chapters.`);
}

generate();
