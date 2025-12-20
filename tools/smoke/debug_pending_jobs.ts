
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Pending Jobs ---');
    const jobs = await prisma.shotJob.findMany({
        where: { status: 'PENDING' },
        include: {
            engineBinding: true,
            task: true
        }
    });
    console.log(`Found ${jobs.length} PENDING jobs.`);
    for (const job of jobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`  Type: ${job.type}`);
        console.log(`  Created: ${job.createdAt}`);
        console.log(`  EngineBinding: ${JSON.stringify(job.engineBinding)}`);
    }

    console.log('\n--- Checking Active Engines ---');
    const engines = await prisma.engine.findMany({});
    console.log(`Found ${engines.length} engines.`);
    for (const engine of engines) {
        console.log(`Engine: ${engine.name} (${engine.engineKey}) - Enabled: ${engine.enabled} - Config: ${JSON.stringify(engine.config)}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
