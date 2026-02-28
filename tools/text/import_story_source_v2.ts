import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { UsageMeter } from '../../packages/metering/src/usage-meter';

const prisma = new PrismaClient();

const STORY_PATH = '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_specs/万古神帝.txt';
const PROJECT_ID = 'proj_15m_seal_001';
const ORG_ID = 'org_seal_test_001';
const CHUNK_SIZE_BYTES = 12000; // Byte-aligned
const OVERLAP_BYTES = 400;

function calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function main() {
    console.log(`Starting INDUSTRIAL IMPORT (Byte-Aligned) of ${STORY_PATH}...`);
    const stats = fs.statSync(STORY_PATH);
    const totalBytes = stats.size;

    // Calculate global hash using stream to avoid OOM
    const globalHash = await new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(STORY_PATH);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });

    // 1. Create StorySource (Unique title for v2)
    const source = await prisma.storySource.create({
        data: {
            projectId: PROJECT_ID,
            title: '万古神帝-V2-BYTE-ALIGNED',
            path: STORY_PATH,
            size: totalBytes,
            globalHash: globalHash,
        }
    });

    console.log(`Created StorySource: ${source.id}, Total Bytes: ${totalBytes}`);

    const fd = fs.openSync(STORY_PATH, 'r');
    let offset = 0;
    let chunkIndex = 0;
    let prevHash: string | null = null;

    while (offset < totalBytes) {
        const length = Math.min(CHUNK_SIZE_BYTES, totalBytes - offset);
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, offset);

        const textHash = calculateHash(buffer);
        // Preview: Take valid UTF-8 start (approximate)
        const contentPreview = buffer.toString('utf8', 0, Math.min(length, 200)).replace(/\n/g, ' ');

        await prisma.storyChunk.create({
            data: {
                sourceId: source.id,
                chunkIndex: chunkIndex,
                offsetStart: offset,
                offsetEnd: offset + length,
                textHash: textHash,
                prevHash: prevHash,
                contentPreview: contentPreview,
            }
        });

        if (chunkIndex % 100 === 0) {
            console.log(`Imported Chunk ${chunkIndex}: byte-offset ${offset}-${offset + length}`);
        }

        prevHash = textHash;
        chunkIndex++;

        if (offset + length >= totalBytes) break;
        offset += (CHUNK_SIZE_BYTES - OVERLAP_BYTES);
    }

    fs.closeSync(fd);
    console.log(`\n✅ Industrial Import Completed. Title: ${source.title}, Chunks: ${chunkIndex}`);

    // P5-A: Soft Metering - Record the import
    await UsageMeter.recordImport(ORG_ID, totalBytes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
