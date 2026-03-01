import { PrismaClient } from '../packages/database';

async function main() {
  const prisma = new PrismaClient();
  try {
    const key = await prisma.apiKey.findUnique({ where: { key: 'dev-worker-key' } });
    if (!key || !key.ownerUserId) {
      console.log('No ownerUserId for key!');
      return;
    }
    const userId = key.ownerUserId;
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('No organization found!');
      return;
    }

    // Check if member
    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: org.id },
    });

    if (!member) {
      console.log(`Adding user ${userId} to org ${org.id} as OWNER`);
      await prisma.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'OWNER',
        },
      });
    } else {
      console.log(`User ${userId} is already member of ${org.id}. Updating role to OWNER.`);
      await prisma.organizationMember.update({
        where: { id: member.id },
        data: { role: 'OWNER' },
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
