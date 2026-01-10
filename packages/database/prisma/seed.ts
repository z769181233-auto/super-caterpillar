import { PrismaClient } from '../src/generated/prisma';
import * as util from "util";

const prisma = new PrismaClient();

async function main() {
  process.stdout.write(util.format('🌱 Seeding Engine data...') + "\n");

  const engines = [
    {
      code: 'default_novel_analysis',
      name: 'Default Novel Analysis',
      type: 'local',
      isActive: true,
      engineKey: 'default_novel_analysis',
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {},
      enabled: true,
    },
    {
      code: 'default_shot_render',
      name: 'Default Shot Render',
      type: 'local',
      isActive: true,
      engineKey: 'default_shot_render',
      adapterName: 'default_shot_render',
      adapterType: 'local',
      config: {},
      enabled: true,
    },
    // HTTP 引擎（如果后续要用就先建好）
    {
      code: 'http_real_novel_analysis',
      name: 'HTTP Novel Analysis',
      type: 'http',
      isActive: true,
      engineKey: 'http_real_novel_analysis',
      adapterName: 'http',
      adapterType: 'http',
      config: {},
      enabled: true,
    },
    {
      code: 'http_real_shot_render',
      name: 'HTTP Shot Render',
      type: 'http',
      isActive: true,
      engineKey: 'http_real_shot_render',
      adapterName: 'http',
      adapterType: 'http',
      config: {},
      enabled: true,
    },
    // P1-5 / P2 Engines (Aliased to default_novel_analysis for now)
    {
      code: 'ce03_visual_density',
      name: 'CE03 Visual Density',
      type: 'local',
      isActive: true,
      engineKey: 'ce03_visual_density',
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {},
      enabled: true,
    },
    {
      code: 'ce04_visual_enrichment',
      name: 'CE04 Visual Enrichment',
      type: 'local',
      isActive: true,
      engineKey: 'ce04_visual_enrichment',
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {},
      enabled: true,
    },
    {
      code: 'ce06_novel_parsing',
      name: 'CE06 Novel Parsing',
      type: 'local',
      isActive: true,
      engineKey: 'ce06_novel_parsing',
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {},
      enabled: true,
    },
    {
      code: 'character_visual',
      name: 'Character Visual (Mother Engine)',
      type: 'local',
      isActive: true,
      engineKey: 'character_visual',
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {
        template: 'reference_sheet_v1',
        capabilities: ['parameterized_instantiation', 'artifact_binding'],
      },
      enabled: true,
    },
  ];

  for (const e of engines) {
    // 先尝试用 engineKey 查找
    let engine = await prisma.engine.findUnique({
      where: { engineKey: e.engineKey },
    });

    if (engine) {
      // 如果存在，更新字段（包括新增的 code, name, type, isActive）
      engine = await prisma.engine.update({
        where: { engineKey: e.engineKey },
        data: {
          code: e.code,
          name: e.name,
          type: e.type,
          isActive: e.isActive,
          adapterName: e.adapterName,
          adapterType: e.adapterType,
          config: e.config,
          enabled: e.enabled,
        },
      });
      process.stdout.write(util.format(`✅ Updated engine: ${engine.engineKey} -> code: ${e.code} (${e.name})`) + "\n");
    } else {
      // 如果不存在，创建新记录
      engine = await prisma.engine.create({
        data: e,
      });
      process.stdout.write(util.format(`✅ Created engine: ${engine.engineKey} -> code: ${e.code} (${e.name})`) + "\n");
    }

    // PHASE 2B Supplement: Ensure at least one EngineVersion exists for character_visual
    if (e.engineKey === 'character_visual') {
      await prisma.engineVersion.upsert({
        where: {
          engineId_versionName: {
            engineId: engine.id,
            versionName: 'default',
          },
        },
        update: {
          enabled: true,
          config: e.config,
        },
        create: {
          engineId: engine.id,
          versionName: 'default',
          config: e.config,
          enabled: true,
        },
      });
      process.stdout.write(util.format(`✅ Seeded default version for character_visual`) + "\n");
    }
  }

  process.stdout.write(util.format('✅ Engine seeding completed!') + "\n");

  // ========== RBAC Seed: Roles, Permissions, RolePermissions ==========
  process.stdout.write(util.format('🌱 Seeding RBAC data...') + "\n");

  // 1. 创建 Roles (只保留标准全大写角色)
  const roles = [
    { name: 'OWNER', level: 100 }, // 对齐计划中的 level
    { name: 'ADMIN', level: 80 },
    { name: 'CREATOR', level: 60 },
    { name: 'EDITOR', level: 50 },
    { name: 'VIEWER', level: 20 },
  ];

  // 清理非标角色 (强制收敛)
  const standardRoleNames = roles.map((r) => r.name);
  await prisma.role.deleteMany({
    where: {
      name: { notIn: standardRoleNames },
    },
  });
  process.stdout.write(util.format('🧹 Cleaned non-standard roles') + "\n");

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { level: roleData.level },
      create: roleData,
    });
  }
  process.stdout.write(util.format('✅ Created/Updated roles:', roles.map((r) => r.name).join(', ')) + "\n");

  // 2. 创建 Permissions (system scope)
  const permissions = [
    { key: 'auth', scope: 'system' },
    { key: 'project.create', scope: 'system' },
    { key: 'project.read', scope: 'system' },
    { key: 'project.write', scope: 'system' },
    { key: 'project.update', scope: 'system' },
    { key: 'project.generate', scope: 'system' },
    { key: 'project.review', scope: 'system' },
    { key: 'project.publish', scope: 'system' },
    { key: 'project.delete', scope: 'system' },
    { key: 'user.manage', scope: 'system' },
    { key: 'billing.view', scope: 'system' },
    { key: 'billing.manage', scope: 'system' },
    { key: 'model.use.base', scope: 'system' },
    { key: 'novel.upload', scope: 'system' },
    { key: 'novel.read', scope: 'system' },
    { key: 'novel.update', scope: 'system' },
    { key: 'structure.read', scope: 'system' },
    { key: 'project.manage', scope: 'system' },
  ];

  for (const permData of permissions) {
    await prisma.permission.upsert({
      where: { key: permData.key },
      update: { scope: permData.scope },
      create: permData,
    });
  }
  process.stdout.write(util.format('✅ Created/Updated permissions:', permissions.map((p) => p.key).join(', ')) + "\n");

  // 3. 创建 RolePermissions (关联 Role 和 Permission)
  const rolePermissions = [
    {
      roleName: 'VIEWER',
      permKeys: ['auth', 'project.read', 'novel.read', 'structure.read', 'billing.view'],
    },
    {
      roleName: 'EDITOR',
      permKeys: [
        'auth',
        'project.read',
        'project.write',
        'project.update',
        'project.generate',
        'project.review',
        'novel.read',
        'novel.update',
        'structure.read',
        'billing.view',
      ],
    },
    {
      roleName: 'CREATOR',
      permKeys: [
        'auth',
        'project.create',
        'project.read',
        'project.write',
        'project.update',
        'project.generate',
        'project.review',
        'novel.upload',
        'novel.read',
        'novel.update',
        'structure.read',
        'billing.view',
        'model.use.base',
      ],
    },
    {
      roleName: 'ADMIN',
      permKeys: [
        'auth',
        'project.create',
        'project.read',
        'project.write',
        'project.update',
        'project.generate',
        'project.review',
        'project.publish',
        'project.delete',
        'project.manage',
        'user.manage',
        'billing.view',
        'billing.manage',
        'novel.upload',
        'novel.read',
        'novel.update',
        'structure.read',
        'model.use.base',
      ],
    },
    {
      roleName: 'OWNER',
      permKeys: [
        'auth',
        'project.create',
        'project.read',
        'project.write',
        'project.update',
        'project.generate',
        'project.review',
        'project.publish',
        'project.delete',
        'project.manage',
        'user.manage',
        'billing.view',
        'billing.manage',
        'novel.upload',
        'novel.read',
        'novel.update',
        'structure.read',
        'model.use.base',
      ],
    },
  ];

  for (const { roleName, permKeys } of rolePermissions) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      process.stdout.write(util.format(`⚠️  Role ${roleName} not found, skipping permissions`) + "\n");
      continue;
    }

    for (const permKey of permKeys) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!permission) {
        process.stdout.write(util.format(`⚠️  Permission ${permKey} not found, skipping`) + "\n");
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
    process.stdout.write(util.format(`✅ Assigned ${permKeys.length} permissions to role: ${roleName}`) + "\n");
  }

  process.stdout.write(util.format('✅ RBAC seeding completed!') + "\n");

  // ========== API Keys Seed: Worker Key ==========
  process.stdout.write(util.format('🌱 Seeding API Keys...') + "\n");
  const workerApiKey = 'ak_worker_dev_0000000000000000';
  const workerApiSecret =
    'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

  await prisma.apiKey.upsert({
    where: { key: workerApiKey },
    update: {
      secretHash: workerApiSecret, // Dev env fallback allows plain secret in secretHash
      status: 'ACTIVE',
    },
    create: {
      key: workerApiKey,
      secretHash: workerApiSecret,
      name: 'Dev Worker Key',
      status: 'ACTIVE',
    },
  });
  process.stdout.write(util.format('✅ API Key seeding completed!') + "\n");

  // ========== System User Seed ==========
  process.stdout.write(util.format('🌱 Seeding System User...') + "\n");
  await prisma.user.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      email: 'system@supercaterpillar.com',
      passwordHash: 'system_reserved_do_not_use',
      role: 'admin',
    },
  });
  process.stdout.write(util.format('✅ System User seeding completed!') + "\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    process.stderr.write(util.format('❌ Seeding failed:', e) + "\n");
    await prisma.$disconnect();
    process.exit(1);
  });
