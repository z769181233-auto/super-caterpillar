import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local first (override) if exists
if (fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });
}
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient({});

async function main() {
  const orgId = 'org_scale_test';
  console.log(`Topping up credits for organization: ${orgId}`);

  // Ensure org exists first
  const org = await prisma.organization.upsert({
    where: { id: orgId },
    update: { credits: { increment: 1000000 } }, // Add 1M credits
    create: {
      id: orgId,
      name: 'Scale Test Org',
      ownerId: 'user_scale_test_owner', // Assuming owner exists or handled by FK?
      // Wait, owner FK constraint might fail if user doesn't exist.
      // Let's check if we can skip owner or create user.
      // If ownerId is required, we need a user.
      // Let's just update if exists. If not, we might fail on create due to owner.
      type: 'ENTERPRISE',
      credits: 1000000,
    },
  });

  console.log(`Organization ${org.id} now has ${org.credits} credits.`);
  await prisma.$disconnect();
}

// We need a user if we create org.
// Let's wrap in try/catch and try to create user if needed.
// But first simply try update.

main().catch(async (e) => {
  if (e.code === 'P2003' || e.message.includes('Foreign key constraint')) {
    // Create owner user
    console.log('Creating owner user...');
    const prisma2 = new PrismaClient({});
    await prisma2.user.upsert({
      where: { id: 'user_scale_test_owner' },
      create: { id: 'user_scale_test_owner', email: 'scale_test@scu.com', passwordHash: 'mock' },
      update: {},
    });
    // Retry main
    await main();
  } else {
    console.error(e);
    process.exit(1);
  }
});
