/**
 * Smoke 测试：初始化 API Key
 * 在数据库中创建或更新 smoke 测试所需的 API Key
 */

import { PrismaClient } from 'database';

// Force smoke test to use correct port (env var takes priority if set by CI)
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5434/scu';

const prisma = new PrismaClient({});

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
        console.log(
          `   Database connection failed, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `   Database connection failed after ${maxRetries} attempts: ${error.message}`
        );
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

  // PRE-REQUISITE: Ensure 'user-gate' exists for downstream gates
  console.log('--- [INIT] Ensuring pre-requisite users exist ---');
  try {
    await prisma.user.upsert({
      where: { id: 'user-gate' },
      update: {},
      create: {
        id: 'user-gate',
        email: 'gate-tester@example.com',
        passwordHash: 'dummy-hash-for-gate',
      },
    });
    console.log('✅ User "user-gate" is ready.');
  } catch (err: any) {
    console.warn('⚠️  Failed to ensure user-gate (might already exist or schema differ):', err.message);
  }

  const apiKey = process.env.API_KEY || 'ak_smoke_test_key_v1';
  const apiSecret = process.env.API_SECRET || 'scu_smoke_secret';

  // Smoke 默认种子数据（可通过环境变量覆盖）
  const smokeUserEmail = process.env.SMOKE_USER_EMAIL || 'smoke@example.com';
  const smokeUserPasswordHash =
    process.env.SMOKE_USER_PASSWORD_HASH ||
    '$2a$10$nqOlsY8A4rwqENUT3ef5ruv4cLoT.vwZKqSu//xTNKoZXOcOu9QNS';
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
        data: { defaultOrganizationId: null },
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
    // 0) Skip RBAC initialization for now as permissions table is unstable in V3.1
    console.log('   Skipping RBAC roles and permissions initialization (V3.1 Compat)...');

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
        credits: 1000000, // [A5 FIX] Ensure enough credits explicitly
      },
      create: {
        name: smokeOrgName,
        slug: smokeOrgSlug,
        ownerId: user.id,
        credits: 1000000,
      },
    });

    // [A5_FIX] Ensure CostCenter exists for BudgetGuard compatibility
    await (prisma as any).costCenter.upsert({
      where: { id: `cc-${organization.id}` },
      update: {
        budget: 1000000,
        currentCost: 0,
      },
      create: {
        id: `cc-${organization.id}`,
        organizationId: organization.id,
        name: 'Default Cost Center',
        budget: 1000000,
        currentCost: 0,
      },
    }).catch((e: any) => console.warn('   [A5] Failed to seed CostCenter (ignoring):', e.message));

    // 3) 保证用户加入该组织
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      update: {
        role: 'OWNER' as any,
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER' as any,
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
      console.log(
        `✅ Updated existing API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`
      );
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
      console.log(
        `✅ Created new API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`
      );
      console.log(
        `✅ Created new API Key: ${apiKey} (bound to ${organization.id}, User Role: admin)`
      );
    }

    // [DETERMINISTIC FIX] Ensure user is actually a member (re-check upsert logic above is enough, but to be 100% sure for existing users):
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    });
    if (!membership) {
      console.log(`[smoke] Repairing membership for ${user.email} in ${organization.slug}...`);
      await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER' as any, // Use OrganizationRole enum typically
        },
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
        ownerId: user.id,
      },
    });
    console.log(`✅ Seeded Smoke Project: ${SMOKE_PROJECT_ID}`);

    // [SEED] Register default engines (Required for industrial binding gates)
    console.log('   Ensuring default engines are registered...');
    const engines = [
      { code: 'default_novel_analysis', name: 'Default Novel Analysis', type: 'local' },
      { code: 'default_shot_render', name: 'Default Shot Render', type: 'local' },
      { code: 'video_merge', name: 'Video Merge (FFmpeg Real)', type: 'local' },
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

    // --- SSOT GUARDRAIL: Verify canonical engine mapping for Gate 4 ---
    console.log('   [GUARD] Verifying SSOT Alignment for VIDEO_RENDER...');
    const CANONICAL_VIDEO_ENGINE = 'video_merge';
    const videoEngine = await prisma.engine.findUnique({
      where: { code: CANONICAL_VIDEO_ENGINE },
    });

    if (!videoEngine || !videoEngine.isActive || !videoEngine.enabled) {
      console.error(`❌ SSOT FAILURE: Canonical engine '${CANONICAL_VIDEO_ENGINE}' is missing or disabled.`);
      console.error(`   API EngineRegistry expects '${CANONICAL_VIDEO_ENGINE}' for VIDEO_RENDER jobs.`);
      process.exit(1);
    }
    console.log(`✅ SSOT ASSERT PASSED: Engine '${CANONICAL_VIDEO_ENGINE}' is ready.`);

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
    console.log(`API_KEY=${apiKey}`);
    console.log(`API_SECRET=${apiSecret}`);
    console.log(`ORG_ID=${organization.id}`);
  } catch (error: any) {
    console.error(`❌ Failed to initialize API Key: ${error.message}`);
    if (error.message?.includes('secretEnc')) {
      console.error(
        `   Hint: Database schema may not be up to date. Run: pnpm --filter database prisma generate`
      );
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
