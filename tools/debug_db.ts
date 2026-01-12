import { PrismaClient } from '../packages/database';
async function main() {
    console.error("Starting DB Debug...");
    const prisma = new PrismaClient();
    try {
        const shotCount = await prisma.shot.count();
        const sceneCount = await prisma.scene.count();
        console.error(`COUNTS: Shots: ${shotCount}, Scenes: ${sceneCount}`);

        const shots = await prisma.shot.findMany({
            take: 5,
            orderBy: { index: 'desc' }
        });
        console.error('SHOTS:', JSON.stringify(shots, null, 2));

    } catch (e: any) {
        console.error("DB ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
        console.error("DB Debug Finished.");
    }
}

main();
