
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking All Jobs ---');
    const jobs = await prisma.shotJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    for (const job of jobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`  Type: ${job.type}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Worker: ${job.workerId}`);
        console.log(`  Output: ${JSON.stringify(job.result)}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
