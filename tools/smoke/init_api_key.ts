/**
 * Smoke 测试：初始化 API Key
 * 在数据库中创建或更新 smoke 测试所需的 API Key
 */

import { PrismaClient } from 'database';

const prisma = new PrismaClient();

// NOTE: dev/test smoke only: we store raw secret into secretHash to match dev/test resolver behavior.
// Do NOT use this approach in production.

/**
 * 测试数据库连接（带重试）
 */
async function testConnection(maxRetries = 5, delay = 1000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error: any) {
      if (i < maxRetries - 1) {
        console.log(`   Database connection failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`   Database connection failed after ${maxRetries} attempts: ${error.message}`);
        return false;
      }
    }
  }
  return false;
}

async function main() {
  // 测试数据库连接（带重试）
  if (!(await testConnection())) {
    console.error('❌ Database not ready, cannot initialize API Key');
    process.exit(1);
  }
  const apiKey = process.env.API_KEY || 'scu_smoke_key';
  const apiSecret = process.env.API_SECRET || 'scu_smoke_secret';

  // Smoke 默认种子数据（可通过环境变量覆盖）
  const smokeUserEmail = process.env.SMOKE_USER_EMAIL || 'smoke@local';
  const smokeUserPasswordHash = process.env.SMOKE_USER_PASSWORD_HASH || '$2a$10$nqOlsY8A4rwqENUT3ef5ruv4cLoT.vwZKqSu//xTNKoZXOcOu9QNS';
  const smokeOrgSlug = process.env.SMOKE_ORG_SLUG || 'smoke-org';
  const smokeOrgName = process.env.SMOKE_ORG_NAME || 'Smoke Org';

  const SMOKE_RESET = process.env.SMOKE_RESET === '1';

  if (SMOKE_RESET) {
    console.log('🧨 SMOKE_RESET=1: removing existing smoke data...');

    try {
      // 1. Remove API Key
      await prisma.apiKey.deleteMany({ where: { key: apiKey } });
      // 2. Remove Membership for smoke user
      await prisma.organizationMember.deleteMany({ where: { user: { email: smokeUserEmail } } });
      // 3. Update User to remove defaultOrg (break circular dep if strictly required)
      await prisma.user.updateMany({
        where: { email: smokeUserEmail },
        data: { defaultOrganizationId: null }
      });
      // 4. Try delete Org (might fail if projects exist, so wrap in try-catch or safe delete)
      try {
        await prisma.organization.deleteMany({ where: { slug: smokeOrgSlug } });
      } catch (e) {
        console.warn('   [RESET] Could not delete organization (projects exist?), continuing...');
      }
      // 5. Delete User
      await prisma.user.deleteMany({ where: { email: smokeUserEmail } });

      console.log('🧨 SMOKE_RESET done (cleaned key/user/membership).');
    } catch (e) {
      console.error('❌ SMOKE_RESET failed:', e);
      // Don't exit, try to proceed with upsert
    }
  }

  console.log(`🔑 Initializing API Key for smoke tests...`);
  console.log(`   Key: ${apiKey}`);
  console.log(`   Secret: ${apiSecret.substring(0, 8)}...`);

  try {
    // 0) Ensure System Permissions & Roles exist (Self-healing for smoke environment)
    console.log('   Ensuring RBAC roles and permissions...');

    // Ensure 'auth' permission exists (Required by PermissionService.assertCanManageProject via SystemPermissions.AUTH)
    const accessPerm = await prisma.permission.upsert({
      where: { key: 'auth' },
      update: { scope: 'system' },
      create: { key: 'auth', scope: 'system' },
    });

    // Ensure 'project.create' permission exists
    await prisma.permission.upsert({
      where: { key: 'project.create' },
      update: { scope: 'system' },
      create: { key: 'project.create', scope: 'system' },
    });

    // Ensure 'admin' role exists
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', level: 999 },
    });

    // Bind 'auth' to 'admin' role
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: accessPerm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: accessPerm.id,
      },
    });

    // 1) upsert User with ADMIN role
    const user = await prisma.user.upsert({
      where: { email: smokeUserEmail },
      update: {
        role: 'admin', // Matches UserRole.admin
        passwordHash: smokeUserPasswordHash,
      },
      create: {
        email: smokeUserEmail,
        passwordHash: smokeUserPasswordHash,
        defaultOrganizationId: null,
        role: 'admin', // Matches UserRole.admin
        userType: 'admin', // Matches UserType.admin
      },
    });

    // 2) upsert Organization（使用 slug 作为唯一键）
    const organization = await prisma.organization.upsert({
      where: { slug: smokeOrgSlug },
      update: {
        name: smokeOrgName,
        ownerId: user.id,
      },
      create: {
        name: smokeOrgName,
        slug: smokeOrgSlug,
        ownerId: user.id,
      },
    });

    // 3) 保证用户加入该组织
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: {
        role: 'Owner' as any,
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: 'Owner' as any,
      },
    });

    // 4) 如果用户默认组织未设置，则更新
    if (!user.defaultOrganizationId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { defaultOrganizationId: organization.id },
      });
    }

    // 5) 查找或创建 ApiKey，并绑定到 user/org
    const existing = await prisma.apiKey.findUnique({ where: { key: apiKey } });

    if (existing) {
      await prisma.apiKey.update({
        where: { key: apiKey },
        data: {
          secretHash: apiSecret,
          status: 'ACTIVE',
          expiresAt: null,
          ownerUserId: user.id,
          ownerOrgId: organization.id,
          name: 'Smoke Test API Key',
        },
      });
      console.log(`✅ Updated existing API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`);
    } else {
      await prisma.apiKey.create({
        data: {
          key: apiKey,
          secretHash: apiSecret,
          status: 'ACTIVE',
          expiresAt: null,
          name: 'Smoke Test API Key',
          ownerUserId: user.id,
          ownerOrgId: organization.id,
        },
      });
      console.log(`✅ Created new API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`);
      console.log(`✅ Created new API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`);
    }

    // [DETERMINISTIC FIX] Ensure user is actually a member (re-check upsert logic above is enough, but to be 100% sure for existing users):
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } }
    });
    if (!membership) {
      console.log(`[smoke] Repairing membership for ${user.email} in ${organization.slug}...`);
      await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER' as any // Use OrganizationRole enum typically
        }
      });
    }

    // [SEED] Ensure a Smoke Project exists (for verify_seasons_route.sh immediately after reset)
    const SMOKE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
    await prisma.project.upsert({
      where: { id: SMOKE_PROJECT_ID },
      update: {},
      create: {
        id: SMOKE_PROJECT_ID,
        name: 'Smoke Verification Project',
        organizationId: organization.id,
        ownerId: user.id
      }
    });
    console.log(`✅ Seeded Smoke Project: ${SMOKE_PROJECT_ID}`);

    // [SEED] Register default engines (Required for industrial binding gates)
    console.log('   Ensuring default engines are registered...');
    const engines = [
      { code: 'default_novel_analysis', name: 'Default Novel Analysis', type: 'local' },
      { code: 'default_shot_render', name: 'Default Shot Render', type: 'local' },
      { code: 'default_video_render', name: 'Default Video Render', type: 'local' },
    ];

    for (const eng of engines) {
      await (prisma.engine as any).upsert({
        where: { code: eng.code },
        update: { isActive: true, enabled: true },
        create: {
          code: eng.code,
          name: eng.name,
          type: eng.type,
          isActive: true,
          enabled: true,
          engineKey: eng.code,
          adapterName: eng.name,
          adapterType: eng.type,
          config: {},
        },
      });
    }
    console.log('✅ Default engines seeded.');

    // --- HARD ASSERT: verify binding in DB is exactly what we expect ---
    const check = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      select: { key: true, ownerUserId: true, ownerOrgId: true, status: true },
    });

    if (!check) {
      throw new Error(`[smoke] apiKey not found after upsert: ${apiKey}`);
    }
    if (check.ownerUserId !== user.id || check.ownerOrgId !== organization.id) {
      throw new Error(
        `[smoke] apiKey binding mismatch. expected user=${user.id} org=${organization.id} but got user=${check.ownerUserId} org=${check.ownerOrgId}. ` +
        `This almost always indicates DATABASE_URL mismatch between API and init script, or stale DB state.`
      );
    }
    console.log(`✅ Verified apiKey binding: ${apiKey} -> user=${user.id} org=${organization.id}`);

  } catch (error: any) {
    console.error(`❌ Failed to initialize API Key: ${error.message}`);
    if (error.message?.includes('secretEnc')) {
      console.error(`   Hint: Database schema may not be up to date. Run: pnpm --filter database prisma generate`);
    }
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
