
import { PrismaClient } from '@prisma/client';

console.error("DEBUG: Direct Prisma Client...");

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
    console.error("DEBUG: Querying...");
    const count = await prisma.shotJob.count();
    console.error("Job Count:", count);

    const jobs = await prisma.shotJob.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    for (const j of jobs) {
        console.error(`ID: ${j.id} Payload:`, JSON.stringify(j.payload));
    }
}

main().then(() => console.error("Done")).catch(e => console.error("Error:", e));
