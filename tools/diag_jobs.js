const { PrismaClient } = require('database');
const prisma = new PrismaClient();

async function main() {
    const jobs = await prisma.shotJob.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
            id: true,
            status: true,
            jobType: true,
            outputSha256: true,
            engineProvider: true,
            engineRunId: true,
            updatedAt: true,
        }
    });
    console.log(JSON.stringify(jobs, null, 2));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());
