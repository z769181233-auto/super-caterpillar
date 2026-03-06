import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

const ROLES = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
};

const PERMISSIONS = [
  'auth',
  'audit',
  'project.read',
  'project.write',
  'project.generate',
  'project.review',
  'project.publish',
  'project.delete',
  'project.create', // Added
  'model.use',
  'billing',
];

async function seed() {
  console.log('🌱 Seeding Permissions...');

  // 1. Ensure Permissions exist
  const permissionMap = new Map();
  for (const key of PERMISSIONS) {
    // Determine scope based on prefix (Special case: project.create is system scope)
    const scope = key.startsWith('project.') && key !== 'project.create' ? 'project' : 'system';

    const p = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, scope },
    });
    permissionMap.set(key, p.id);
  }

  // 2. Ensure Roles exist
  // OWNER = 100, EDITOR = 50, VIEWER = 10
  // OWNER/ADMIN = 100, EDITOR = 50, VIEWER = 10
  const LEVEL_MAP = {
    [ROLES.OWNER]: 100,
    [ROLES.EDITOR]: 50,
    [ROLES.VIEWER]: 10,
    admin: 100, // Ensure 'admin' role exists with max level
  };

  const allRoles = [...Object.values(ROLES), 'admin'];

  const roleMap = new Map();
  for (const roleName of allRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { level: LEVEL_MAP[roleName] || 0 },
      create: { name: roleName, level: LEVEL_MAP[roleName] || 0 },
    });
    roleMap.set(roleName, role.id);
  }

  // 3. Assign All Permissions to OWNER and ADMIN
  const fullAccessRoles = [ROLES.OWNER, 'admin'];

  for (const roleName of fullAccessRoles) {
    const roleId = roleMap.get(roleName);
    if (roleId) {
      for (const key of PERMISSIONS) {
        const permissionId = permissionMap.get(key);
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleId,
              permissionId: permissionId,
            },
          },
          update: {},
          create: {
            roleId: roleId,
            permissionId: permissionId,
          },
        });
      }
      console.log(`✅ Granted all permissions to ${roleName}`);
    }
  }

  console.log('✅ Permissions seeded successfully.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
