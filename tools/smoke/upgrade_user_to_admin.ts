import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  const email = 'a3@test.com';
  console.log(`Upgrading user ${email} to admin...`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  // Update user role (enum)
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' }, // Using enum value string (Prisma allows this for enums usually, or needs type import)
  });

  console.log(`✅ User ${email} upgraded to admin role.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
