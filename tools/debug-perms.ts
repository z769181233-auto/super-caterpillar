import { PrismaClient } from 'database';
require('dotenv').config();

const prisma = new PrismaClient({});

async function main() {
  const ownerId = 'f95b0304-58d7-4b75-b65e-7899b2c0dc51'; // Admin User

  // Find LATEST project
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!project) {
    console.error('❌ No projects found!');
    return;
  }

  const projectId = project.id;
  console.log(`Checking Latest Project: ${project.name} (${projectId})`);

  const member = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: ownerId,
        projectId: projectId,
      },
    },
    include: { role: true },
  });

  if (!member) {
    console.error('❌ ProjectMember NOT FOUND!');
  } else {
    console.log('✅ ProjectMember Found. Role:', member.role.name);
  }

  // List ALL Roles
  const roles = await prisma.role.findMany();
  console.log('--- ALL ROLES ---');
  console.table(roles);

  // Check Role OWNER specific
  const ownerRole = await prisma.role.findFirst({ where: { name: 'OWNER' } });
  console.log('Role search "OWNER":', ownerRole);

  await prisma.$disconnect();
}

main().catch(console.error);
