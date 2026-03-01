import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";
const assetPath = path.join(brainDir, "chi_yao_v7_frontal_anchor.png");

async function probeMidline() {
    // Generate 5 versions with different vertical crop lines to find the center
    const centers = [220, 222, 224, 226, 228];
    for (const x of centers) {
        const leftSide = await sharp(assetPath)
            .extract({ left: 0, top: 0, width: x, height: 768 })
            .toBuffer();

        const mirrored = await sharp(leftSide)
            .flip()
            .flop() // Mirror horizontally
            .toBuffer();

        await sharp({
            create: { width: x * 2, height: 768, channels: 3, background: { r: 0, g: 0, b: 0 } }
        })
            .composite([
                { input: leftSide, left: 0, top: 0 },
                { input: mirrored, left: x, top: 0 }
            ])
            .resize(448)
            .toFile(path.join(brainDir, `chi_yao_mirror_test_x${x}.png`));
    }
}

probeMidline().catch(console.error);
