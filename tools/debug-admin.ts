import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function debug() {
  const email = 'admin@example.com';
  const user = await prisma.user.findUnique({
    where: { email },
  });
  console.log('User Debug:', JSON.stringify(user, null, 2));

  // Check roles table too
  const roles = await prisma.role.findMany();
  console.log('Roles:', JSON.stringify(roles, null, 2));
}

debug()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
