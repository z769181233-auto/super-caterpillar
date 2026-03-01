import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function finalProof() {
    const godFace = path.join(brainDir, "chi_yao_v10_final_perfection.png");

    // Zoom in on the MOUTH and NOSE area to prove it's clean and symmetrical
    await sharp(godFace)
        .extract({ left: 350, top: 400, width: 324, height: 324 })
        .resize(600)
        .toFile(path.join(brainDir, "chi_yao_v11_mouth_audit_proof.png"));

    // Full portrait proof
    await sharp(godFace)
        .resize(512)
        .toFile(path.join(brainDir, "chi_yao_v11_god_face_portrait.png"));
}

finalProof().catch(console.error);
