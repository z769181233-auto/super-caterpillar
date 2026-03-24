import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient({});

async function main() {
    const profiles = await prisma.characterProfile.findMany();
    console.log('--- Current Character Profiles ---');
    profiles.forEach(p => {
        console.log(`- ID: ${p.id}, Name: ${p.name}, NameEn: ${p.nameEn}`);
    });
    console.log('--- End ---');
}

main().finally(() => prisma.$disconnect());
