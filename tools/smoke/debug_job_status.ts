const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
    const jobId = process.argv[2];
    if (!jobId) {
        console.error('Usage: ts-node debug_job_status.ts <jobId>');
        process.exit(1);
    }

    console.log(`Querying Job ID: ${jobId}`);
    const job = await prisma.shotJob.findUnique({
        where: { id: jobId },
        include: {
            engineBinding: true,
            worker: true,
            task: true
        }
    });

    console.log(JSON.stringify(job, null, 2));

    // Also query TaskType enum to verify schema
    // (Optional, just to be sure)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
