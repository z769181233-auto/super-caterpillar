const { PrismaClient } = require('@prisma/client');
async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  try {
    const jobs = await prisma.shot_jobs.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('--- RECENT JOBS ---');
    console.log(JSON.stringify(jobs, null, 2));

    const projects = await prisma.projects.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('--- RECENT PROJECTS ---');
    console.log(JSON.stringify(projects, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
