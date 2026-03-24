/**
 * Stage 34 Day 1: 数据完整性验证脚本
 * 只读查询，不修改任何数据
 */

import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function main() {
  console.log('=== Stage 34 Day 1: 数据完整性检查 ===\n');

  // 1. 验证新用户记录
  console.log('1️⃣ 验证新用户记录 (stage34-day1-test@example.com)');
  const testUser = await prisma.user.findUnique({
    where: { email: 'stage34-day1-test@example.com' },
    include: {
      organizationMembers: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (testUser) {
    console.log(`✅ 用户已创建: ${testUser.email}`);
    console.log(`   - User ID: ${testUser.id}`);
    console.log(`   - Default Org: ${testUser.defaultOrganizationId}`);
    console.log(`   - OrganizationMembers: ${testUser.organizationMembers.length}`);

    testUser.organizationMembers.forEach((m: any) => {
      console.log(`     - Org: ${m.organization.name} (${m.organization.type}) | Role: ${m.role}`);
    });
  } else {
    console.log('❌ 测试用户未找到');
  }

  console.log('\n2️⃣ 检查重复 PERSONAL 组织');
  const duplicateOrgs = await prisma.$queryRaw<Array<{ ownerId: string; org_count: bigint }>>`
    SELECT "ownerId", COUNT(*) as org_count 
    FROM "Organization" 
    WHERE type = 'PERSONAL' 
    GROUP BY "ownerId" 
    HAVING COUNT(*) > 1
  `;

  if (duplicateOrgs.length === 0) {
    console.log('✅ 无重复个人组织');
  } else {
    console.log(`⚠️ 发现 ${duplicateOrgs.length} 个用户有重复个人组织:`);
    duplicateOrgs.forEach((row) => {
      console.log(`   - Owner: ${row.ownerId} (${row.org_count} 个组织)`);
    });
  }

  console.log('\n3️⃣ 检查孤儿 OrganizationMember');
  const orphanMembers = await prisma.$queryRaw<
    Array<{ id: string; userId: string; organizationId: string }>
  >`
    SELECT om.id, om."userId", om."organizationId" 
    FROM "OrganizationMember" om 
    LEFT JOIN "Organization" o ON om."organizationId" = o.id 
    WHERE o.id IS NULL 
    LIMIT 5
  `;

  if (orphanMembers.length === 0) {
    console.log('✅ 无孤儿成员记录');
  } else {
    console.log(`⚠️ 发现 ${orphanMembers.length} 条孤儿成员记录:`);
    orphanMembers.forEach((row) => {
      console.log(`   - Member: ${row.id} (User: ${row.userId}, Org: ${row.organizationId})`);
    });
  }

  console.log('\n4️⃣ 检查脏 defaultOrganizationId');
  const dirtyDefaults = await prisma.$queryRaw<
    Array<{ id: string; email: string; defaultOrganizationId: string }>
  >`
    SELECT u.id, u.email, u."defaultOrganizationId" 
    FROM "User" u 
    LEFT JOIN "Organization" o ON u."defaultOrganizationId" = o.id 
    WHERE u."defaultOrganizationId" IS NOT NULL AND o.id IS NULL 
    LIMIT 5
  `;

  if (dirtyDefaults.length === 0) {
    console.log('✅ 无脏 defaultOrganizationId 引用');
  } else {
    console.log(`⚠️ 发现 ${dirtyDefaults.length} 条脏 defaultOrg 引用:`);
    dirtyDefaults.forEach((row) => {
      console.log(`   - User: ${row.email} (defaultOrg: ${row.defaultOrganizationId})`);
    });
  }

  console.log('\n5️⃣ 统计基线数据');
  const userCount = await prisma.user.count();
  const orgCount = await prisma.organization.count();
  const memberCount = await prisma.organizationMember.count();
  const personalOrgCount = await prisma.organization.count({
    where: { type: 'PERSONAL' },
  });

  console.log(`   - 总用户数: ${userCount}`);
  console.log(`   - 总组织数: ${orgCount}`);
  console.log(`   - 总成员关系: ${memberCount}`);
  console.log(`   - 个人组织数: ${personalOrgCount}`);

  console.log('\n=== 检查完成 ===');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ 检查失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
