import sharp from 'sharp';
import * as path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";
const v6_path = path.join(brainDir, "chi_yao_v7_cand_2_face_zoom_v2.png"); // The flawed one with philtrum red
const v7_path = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/storage/videos/v7_prod_s01_shot01_v7/v7_final_shot.png";

async function createComparison() {
    const v6_img = await sharp(v6_path).resize(512, 512).toBuffer();

    // Extract face from v7 to match zoom
    const v7_img = await sharp(v7_path)
        .extract({ left: 352, top: 180, width: 320, height: 320 })
        .resize(512, 512)
        .toBuffer();

    await sharp({
        create: { width: 1024, height: 512, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([
            { input: v6_img, left: 0, top: 0 },
            { input: v7_img, left: 512, top: 0 }
        ])
        .png()
        .toFile(path.join(brainDir, "stitching_before_after.png"));

    console.log("Comparison generated at brainDir/stitching_before_after.png");
}

createComparison().catch(console.error);
