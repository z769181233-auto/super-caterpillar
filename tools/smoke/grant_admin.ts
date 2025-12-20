import { prisma } from './_db/prisma';
import { UserRole, UserType, MembershipRole } from 'database';

async function main() {
  const email = process.env.TARGET_EMAIL || 'adam@test.com';

  console.log(`[grant_admin] Elevating user permissions for email=${email}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: 'user_not_found',
          email,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      userType: UserType.admin,
      role: UserRole.admin,
    },
  });

  const memberships = await prisma.membership.updateMany({
    where: { userId: user.id },
    data: {
      role: MembershipRole.Owner,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        userId: updatedUser.id,
        newUserType: updatedUser.userType,
        newUserRole: updatedUser.role,
        membershipsUpdated: memberships.count,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


