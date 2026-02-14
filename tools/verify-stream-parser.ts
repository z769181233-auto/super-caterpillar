import * as fs from 'fs';
import * as path from 'path';
import { parseNovelStream } from '../apps/workers/src/processors/stream-parser';

// Config
const TARGET_SIZE_MB = 20;
const OUTPUT_FILE = path.join(__dirname, 'temp_big_novel.txt');

// Helper to log memory
function logMemory(label: string) {
    const used = process.memoryUsage();
    console.log(`[MEM] ${label}: RSS=${(used.rss / 1024 / 1024).toFixed(2)}MB, HeapUsed=${(used.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}

// 1. Generate Big Novel
function generateBigNovel(): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`Generating ${TARGET_SIZE_MB}MB novel file...`);
        const writeStream = fs.createWriteStream(OUTPUT_FILE);

        writeStream.write('第1卷 开端\n');
        writeStream.write('第1章 起源\n');

        let size = 0;
        const chunk = '这是一个非常长的段落，用于测试内存压力。薛知盈看着窗外，心中充满了忧虑。萧昀祈走过来，低声说道：“不要怕，有我在。”\n'.repeat(10);

        let chapterCount = 1;
        while (size < TARGET_SIZE_MB * 1024 * 1024) {
            if (size % (1024 * 1024) === 0) {
                chapterCount++;
                writeStream.write(`\n第${chapterCount}章 漫长的旅途\n`);
            }
            writeStream.write(chunk);
            size += chunk.length;
        }

        writeStream.end(() => {
            console.log(`Generated ${OUTPUT_FILE} (${(size / 1024 / 1024).toFixed(2)} MB)`);
            resolve();
        });
        writeStream.on('error', reject);
    });
}

// 2. Run Parser
async function runParser() {
    // Always regenerate to be sure
    await generateBigNovel();

    logMemory('Before Stream');

    const readStream = fs.createReadStream(OUTPUT_FILE, { encoding: 'utf8', highWaterMark: 64 * 1024 });

    const start = Date.now();
    const structure = await parseNovelStream(readStream, 'test-project-id');
    const duration = Date.now() - start;

    logMemory('After Stream');

    console.log('--- Stats ---');
    console.log('Seasons:', structure.stats.seasonsCount);
    console.log('Episodes:', structure.stats.episodesCount);
    console.log('Scenes:', structure.stats.scenesCount);
    console.log('Shots:', structure.stats.shotsCount);
    console.log(`Duration: ${duration}ms`);

    // Cleanup
    // fs.unlinkSync(OUTPUT_FILE);
}

runParser().catch(err => console.error(err));
