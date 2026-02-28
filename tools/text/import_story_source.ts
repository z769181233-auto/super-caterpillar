import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

const prisma = new PrismaClient();

const STORY_PATH = '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_specs/万古神帝.txt';
const PROJECT_ID = 'proj_15m_seal_001';
const CHUNK_SIZE = 12000;
const OVERLAP = 400;

function calculateHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
    console.log(`Starting import of ${STORY_PATH}...`);
    const content = fs.readFileSync(STORY_PATH, 'utf8');
    const stats = fs.statSync(STORY_PATH);
    const globalHash = calculateHash(content);

    console.log(`File size: ${stats.size} bytes, Chars: ${content.length}`);

    // 1. Create StorySource
    // Note: We use the existing proj_15m_seal_001 project.
    const source = await prisma.storySource.create({
        data: {
            projectId: PROJECT_ID,
            title: '万古神帝',
            path: STORY_PATH,
            size: stats.size,
            globalHash: globalHash,
        }
    });

    console.log(`Created StorySource: ${source.id}`);

    // 2. Split and Create StoryChunks
    let offset = 0;
    let chunkIndex = 0;
    let prevHash: string | null = null;
    const totalChars = content.length;

    while (offset < totalChars) {
        const end = Math.min(offset + CHUNK_SIZE, totalChars);
        const chunkText = content.substring(offset, end);
        const textHash = calculateHash(chunkText);
        const contentPreview = chunkText.substring(0, 100).replace(/\n/g, ' ');

        await prisma.storyChunk.create({
            data: {
                sourceId: source.id,
                chunkIndex: chunkIndex,
                offsetStart: offset,
                offsetEnd: end,
                textHash: textHash,
                prevHash: prevHash,
                contentPreview: contentPreview,
            }
        });

        if (chunkIndex % 50 === 0) {
            console.log(`Imported Chunk ${chunkIndex}: offset ${offset}-${end}, hash ${textHash.substring(0, 8)}...`);
        }

        prevHash = textHash;
        chunkIndex++;

        if (end === totalChars) break;
        // Advance by CHUNK_SIZE - OVERLAP
        const advance = CHUNK_SIZE - OVERLAP;
        if (advance <= 0) {
            throw new Error('CHUNK_SIZE must be greater than OVERLAP');
        }
        offset += advance;
    }

    console.log(`Import completed. Total chunks: ${chunkIndex}`);

    // 3. Generate Evidence
    const evidenceDir = '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_evidence/p5c0_source_index';
    if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
    }

    const summary = {
        sourceId: source.id,
        totalChars: totalChars,
        totalChunks: chunkIndex,
        globalHash: globalHash,
        chunkSize: CHUNK_SIZE,
        overlap: OVERLAP,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(path.join(evidenceDir, 'source_index_summary.json'), JSON.stringify(summary, null, 2));
    console.log(`Summary evidence saved to ${evidenceDir}/source_index_summary.json`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
