import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient({});

async function main() {
    console.log('--- Lock Character Aesthetics: God-Tier V4.0 ---');

    const characters = [
        {
            name: '張若塵',
            loraModelId: 'sdxl_zhang_ruochen_v32.safetensors',
            preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
            fixed_seed: '2026021932',
            visual_dna: 'God-tier handsome, imperial majesty, flowing silk robes, soul-piercing eyes, perfect golden ratio face',
        },
        {
            name: '林妃',
            loraModelId: 'sdxl_lin_fei_goddess_v32.safetensors',
            preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
            fixed_seed: '2026021918',
            visual_dna: 'Goddess beauty, ethereal grace, flawless jade skin, intricate noble hairstyle, captivating presence',
        },
        {
            name: '八皇子',
            loraModelId: 'sdxl_eighth_prince_villain_v25.safetensors',
            preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
            fixed_seed: '1771498269',
            visual_dna: 'Peerless handsome villain, sharp features, charismatic evil smirk, black and gold royal armor',
        },
        {
            name: '雲兒',
            loraModelId: 'sdxl_yun_er_cute_v20.safetensors',
            preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
            fixed_seed: '123456789',
            visual_dna: 'Flagship level cute beauty, innocent large eyes, vibrant hanfu, glowing youthful skin',
        }
    ];

    for (const char of characters) {
        console.log(`Locking ${char.name}...`);

        // Find character profile (assumes project exists)
        const profiles = await prisma.characterProfile.findMany({
            where: { name: char.name }
        });

        if (profiles.length === 0) {
            console.warn(`[WARNING] Character profile for ${char.name} not found. Skipping.`);
            continue;
        }

        for (const profile of profiles) {
            const updatedAttributes = {
                ...(profile.attributes as any || {}),
                preferred_checkpoint: char.preferred_checkpoint,
                fixed_seed: char.fixed_seed,
                visual_dna: char.visual_dna,
                v4_aesthetic_locked: true,
            };

            await prisma.characterProfile.update({
                where: { id: profile.id },
                data: {
                    loraModelId: char.loraModelId,
                    attributes: updatedAttributes,
                    updatedAt: new Date(),
                }
            });
            console.log(`[SUCCESS] Locked ${char.name} (ID: ${profile.id})`);
        }
    }

    console.log('--- Lock Complete ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
