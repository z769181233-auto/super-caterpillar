import * as fs from 'fs';
import * as path from 'path';
import { ppv64FromImage } from '../../packages/shared/vision/ppv64';

const CHAR_ROOT = path.join(process.cwd(), 'storage', 'characters');
const CHARS = ['zhang_ruochen', 'chi_yao', 'lin_fei', 'eighth_prince'];

async function upgradeActorPacks() {
    for (const charId of CHARS) {
        console.log(`\n=== Upgrading Actor Pack: ${charId} ===`);
        const specPath = path.join(CHAR_ROOT, charId, 'profiles', 'CharacterSpec.json');
        const anchorRoot = path.join(CHAR_ROOT, charId, 'anchors');
        const frontAnchor = path.join(anchorRoot, 'canonical_front.png');

        if (!fs.existsSync(specPath)) {
            console.warn(`[Skip] Spec not found: ${specPath}`);
            continue;
        }

        const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

        // 1. Calculate Identity Embedding from Front Anchor
        let embedding: number[] | null = null;
        if (fs.existsSync(frontAnchor)) {
            console.log(`[Identity] Extracting PPV-64 from ${frontAnchor}...`);
            embedding = await ppv64FromImage(frontAnchor);
        } else {
            console.warn(`[Warn] Front anchor missing: ${frontAnchor}`);
        }

        // 2. Define Style Profile
        const styleProfile = {
            lighting: "Cinematic rim light, subtle subsurface scattering on skin, dramatic shadows",
            material: "Supremely highly detailed fabric, lustrous silk with metallic embroidery, photorealistic texture",
            rendering: "Xuanji-style 3D Donghua CGI, Unreal Engine 5 aesthetic, 8k masterpiece"
        };

        // 3. Map Technical Anchors
        const technicalAnchors = {
            front: "storageKey://characters/" + charId + "/anchors/canonical_front.png",
            triview_sheet: "storageKey://characters/" + charId + "/anchors/guoman_triview_sheet.png"
        };

        // 4. Build Upgraded Spec
        const upgradedSpec = {
            ...spec,
            identity: {
                embedding_v1: embedding,
                algorithm: "ppv64_v1",
                source_anchor: "canonical_front.png"
            },
            style_profile: styleProfile,
            technical_anchors: technicalAnchors,
            last_upgraded: new Date().toISOString()
        };

        fs.writeFileSync(specPath, JSON.stringify(upgradedSpec, null, 4));
        console.log(`[Success] Upgraded ${specPath}`);
    }
}

upgradeActorPacks().catch(console.error);
