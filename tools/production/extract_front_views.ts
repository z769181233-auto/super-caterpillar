import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const chars = ["zhang_ruochen", "chi_yao", "lin_fei", "eighth_prince"];

async function extractFrontViews() {
    for (const charId of chars) {
        const sheetPath = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'guoman_triview_sheet.png');
        if (!fs.existsSync(sheetPath)) continue;

        // Extract raw front panel (usually left third of 1344px)
        await sharp(sheetPath)
            .extract({ left: 0, top: 0, width: 448, height: 768 })
            .toFile(path.join(repoRoot, `.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/${charId}_source_front.png`));

        // Extract what I actually used as FACE in the previous run
        await sharp(sheetPath)
            .extract({ left: 130, top: 40, width: 220, height: 220 })
            .toFile(path.join(repoRoot, `.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/${charId}_used_face_mask.png`));
    }
}

extractFrontViews().catch(console.error);
