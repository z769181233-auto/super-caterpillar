
import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const CHARACTER_DNA: Record<string, string> = {
    "Zhang Ruochen": "Zhang Ruochen (Perfect World aesthetic), Masterpiece 3D CGI character, Unreal Engine 5.4 High-fidelity render, peak Xianxia aesthetic. Extremely sharp and cold facial geometry, high-caliber 3D modeling, deep realistic eyes with 8k iris reflections. Wearing exquisite silver-white silk Hanfu with intricate pearl-white dragon embroidery (Subsurface Scattering fabric). Holding a jade-hilt celestial sword. Cinematic Rim Lighting, Sharp silhouette, volumetric atmosphere, hyper-detailed skin texture (SSS), peak aesthetic status.",
    "Lin Fei": "Imperial Consort Lin Fei (Top-tier Guoman 3D style), Elder yet divine noble female model, Unreal Engine 5 cinema-grade render. Elegant and regal facial structure with realistic skin translucency (SSS). Wearing high-end multilayered imperial white silk robes with complex gold-thread peony embroidery. Regal gold and jade hair ornaments with physics-based dangling jewels. Majestic lighting, majestic aura, masterpiece quality, 16k raw photo detail.",
    "Yun'er": "Yun'er (Production-grade 3D maiden), 16-year-old high-fidelity 3D anime model, clean and flawless facial geometry. Light green Xianxia robes with intricate lace details. Professional 3D asset quality, soft cinematic lighting, studio-grade 3D character render.",
    "Eighth Prince": "Eighth Prince Zhang Ji (Arrogant Villainous Royal), Top-tier 3D antagonist model, sharp and aggressive facial features. Extravagant deep purple dragon robes with 3D embossed gold embroidery. Sharp ray-traced shadows, dramatic low-angle cinematic lighting, Unreal Engine 5 high-end render, muscular and regal proportion.",
    "张若尘": "Zhang Ruochen (Perfect World aesthetic), Masterpiece 3D CGI character, Unreal Engine 5.4 High-fidelity render, peak Xianxia aesthetic. Extremely sharp and cold facial geometry. Silver-white silk robes, SSS skin texture, 8k iris reflection.",
    "林妃": "Imperial Consort Lin Fei (Top-tier Guoman 3D style), Elder yet divine noble female model, Unreal Engine 5 cinema-grade render. Elegant and regal facial structure, SSS skin texture."
};

async function main() {
    console.log('[Sync] Starting Character DNA Synchronization...');

    for (const [name, dna] of Object.entries(CHARACTER_DNA)) {
        const profiles = await prisma.characterProfile.findMany({
            where: {
                name: {
                    contains: name
                }
            }
        });

        if (profiles.length === 0) {
            console.log(`[Sync] No profiles found for ${name}. Skipping.`);
            continue;
        }

        for (const profile of profiles) {
            console.log(`[Sync] Updating profile ${profile.id} (${profile.name}) with DNA.`);
            await prisma.characterProfile.update({
                where: { id: profile.id },
                data: {
                    description: dna,
                    attributes: {
                        visual_dna: dna,
                        style: "guoman_3d_high_end"
                    }
                }
            });
        }
    }

    console.log('[Sync] Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
