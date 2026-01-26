
import * as fs from 'fs';

async function main() {
    const args = process.argv.slice(2);
    const targetWords = parseInt(args.find(a => a.startsWith('--words='))?.split('=')[1] || '10000');
    const outPath = args.find(a => a.startsWith('--out='))?.split('=')[1] || 'novel.txt';
    const seed = args.find(a => a.startsWith('--seed='))?.split('=')[1] || 'default';

    console.log(`[GEN] Starting generation: Target=${targetWords} Seed=${seed}`);

    // Simple deterministic word generator to avoid massive memory usage
    const words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "hero", "quest", "magic", "sword", "dragon", "king", "queen", "castle", "dark", "forest"];

    const writeStream = fs.createWriteStream(outPath);
    let currentWords = 0;
    let chapters = 1;

    // Write TOC line
    writeStream.write(`BOOK_START: SEED_${seed}\n`);

    while (currentWords < targetWords) {
        writeStream.write(`\nCHAPTER ${chapters}: The Beginning of Part ${chapters}\n`);
        for (let i = 0; i < 300; i++) { // ~300 words per chapter chunk
            const word = words[(currentWords + i) % words.length];
            writeStream.write(word + " ");
        }
        currentWords += 300;
        chapters++;
        if (chapters % 100 === 0) {
            console.log(`[GEN] Progress: ${currentWords} words (${chapters} chapters)...`);
        }
    }

    writeStream.write(`\nBOOK_END\n`);
    writeStream.end();
    console.log(`[GEN] Success: ${outPath} (${currentWords} words)`);
}

main().catch(console.error);
