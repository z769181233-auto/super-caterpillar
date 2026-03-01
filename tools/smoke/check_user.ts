import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to DB...');
  try {
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${users.length} users:`);
    users.forEach((u) => console.log(`- ${u.email} (ID: ${u.id}, Role: ${u.role})`));

    const targetEmail = 'ad@test.com';
    const targetUser = users.find((u) => u.email === targetEmail);

    if (!targetUser) {
      console.log(`\nChecking specifically for ${targetEmail}...`);
      const specific = await prisma.user.findUnique({ where: { email: targetEmail } });
      console.log('Specific find result:', specific);
    }
  } catch (err) {
    console.error('Error querying users:', err);
  }
}

main()
  .catch((e) => console.error('Main error:', e))
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Disconnected.');
  });
