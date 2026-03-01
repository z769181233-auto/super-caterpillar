import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DEBUG DATA START ---');
  try {
    const users = await prisma.user.findMany();
    console.log(`Users (${users.length}):`);
    users.forEach((u) => console.log(`  - ${u.id}: role=${u.role} (Enum)`));

    const roles = await prisma.role.findMany();
    console.log(`Roles (${roles.length}):`);
    roles.forEach((r) => console.log(`  - ${r.id}: name=${r.name}`));

    const perms = await prisma.permission.findMany();
    console.log(`Permissions (${perms.length}):`);
    perms.forEach((p) => console.log(`  - ${p.id}: key=${p.key} scope=${p.scope}`));

    const rp = await prisma.rolePermission.findMany({
      include: { role: true, permission: true },
    });
    console.log(`RolePermissions (${rp.length}):`);
    rp.forEach((x) =>
      console.log(
        `  - Role[${x.role.name}] -> Perm[${x.permission.key}] (scope=${x.permission.scope})`
      )
    );
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
    console.log('--- DEBUG DATA END ---');
  }
}

main();
