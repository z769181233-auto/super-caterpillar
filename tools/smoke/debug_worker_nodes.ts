import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Worker Nodes ---');
  const workers = await prisma.workerNode.findMany({});
  console.log(`Found ${workers.length} workers.`);
  for (const worker of workers) {
    console.log(`Worker ID: ${worker.workerId}`);
    console.log(`  Name: ${worker.name}`);
    console.log(`  Status: ${worker.status}`);
    console.log(`  Last Heartbeat: ${worker.lastHeartbeat}`);
    console.log(`  Capabilities: ${JSON.stringify(worker.capabilities)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
