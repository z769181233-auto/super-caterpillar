import { PrismaClient } from '../../packages/database/src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.TARGET_EMAIL || 'okadam@test.com';

  console.log(`[fix_access] locating user ${email}`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User ${email} not found`);
    process.exit(1);
  }

  // If TARGET_PROJECT_ID provided, use it; otherwise pick latest project
  const targetProjectId = process.env.TARGET_PROJECT_ID;

  let project;
  if (targetProjectId) {
    project = await prisma.project.findUnique({ where: { id: targetProjectId } });
    if (!project) {
      console.error(`Project ${targetProjectId} not found`);
      process.exit(2);
    }
  } else {
    project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!project) {
      console.error('No projects found in database');
      process.exit(2);
    }
  }

  console.log(
    `[fix_access] using project ${project.id} (name=${project.name}, org=${project.organizationId})`,
  );

  // Ensure user is admin
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      userType: 'admin' as any,
      role: 'admin' as any,
      defaultOrganizationId: project.organizationId,
    },
  });

  // Ensure membership as Owner in the project's organization
  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: project.organizationId,
      },
    },
    update: {
      role: 'Owner' as any,
    },
    create: {
      userId: user.id,
      organizationId: project.organizationId,
      role: 'Owner' as any,
    },
  });

  // Ensure project owner is this user
  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: {
      ownerId: user.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: updatedUser.id,
        email,
        userType: updatedUser.userType,
        role: updatedUser.role,
        defaultOrganizationId: updatedUser.defaultOrganizationId,
        membership: {
          id: membership.id,
          role: membership.role,
          organizationId: membership.organizationId,
        },
        project: {
          id: updatedProject.id,
          name: updatedProject.name,
          ownerId: updatedProject.ownerId,
          organizationId: updatedProject.organizationId,
        },
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



