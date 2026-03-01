import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function diag() {
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    // Extract a precise 300x300 face central region
    await sharp(sheetPath)
        .extract({ left: 100, top: 30, width: 300, height: 350 })
        .toFile(path.join(brainDir, "chi_yao_face_close_up.png"));
}

diag().catch(console.error);
