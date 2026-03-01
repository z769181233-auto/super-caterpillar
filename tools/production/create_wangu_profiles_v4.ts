import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient();

async function main() {
    console.log('--- Initializing God-Tier Production Entities ---');

    // 1. Ensure Organization exists
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');

    // 2. Create Project if not exists
    const projectId = 'wangu_ep1_peak_v4';
    let project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
        project = await prisma.project.create({
            data: {
                id: projectId,
                name: '萬古神帝 - 旗艦美學 V4.0',
                organizationId: org.id,
                ownerId: org.ownerId,
                status: 'in_progress',
                styleGuide: 'Peak Guoman V4.0 - Peerless Aesthetic',
            }
        });
        console.log(`Created Project: ${project.name}`);
    }

    const characters = [
        {
            name: '張若塵',
            nameEn: 'Zhang Ruochen',
            loraModelId: 'sdxl_zhang_ruochen_v32.safetensors',
            attributes: {
                preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
                fixed_seed: '2026021932',
                visual_dna: 'God-tier handsome, imperial majesty, flowing silk robes, soul-piercing eyes, perfect golden ratio face',
                v4_aesthetic_locked: true,
            }
        },
        {
            name: '林妃',
            nameEn: 'Lin Fei',
            loraModelId: 'sdxl_lin_fei_goddess_v32.safetensors',
            attributes: {
                preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
                fixed_seed: '2026021918',
                visual_dna: 'Goddess beauty, ethereal grace, flawless jade skin, intricate noble hairstyle, captivating presence',
                v4_aesthetic_locked: true,
            }
        },
        {
            name: '八皇子',
            nameEn: 'Eighth Prince',
            loraModelId: 'sdxl_eighth_prince_villain_v25.safetensors',
            attributes: {
                preferred_checkpoint: 'sdxl_guoman_v4_aesthetic.safetensors',
                fixed_seed: '1771498269',
                visual_dna: 'Peerless handsome villain, sharp features, charismatic evil smirk, black and gold royal armor',
                v4_aesthetic_locked: true,
            }
        }
    ];

    for (const char of characters) {
        const profile = await prisma.characterProfile.upsert({
            where: {
                projectId_name: {
                    projectId: project.id,
                    name: char.name
                }
            },
            update: {
                nameEn: char.nameEn,
                loraModelId: char.loraModelId,
                attributes: char.attributes,
            },
            create: {
                projectId: project.id,
                name: char.name,
                nameEn: char.nameEn,
                loraModelId: char.loraModelId,
                attributes: char.attributes,
            }
        });
        console.log(`Initialized/Updated Profile: ${profile.name} (ID: ${profile.id})`);
    }

    console.log('--- Initialization Complete ---');
}

main().finally(() => prisma.$disconnect());
