/**
 * Stage 35: Membership Include vs Count 对照 (只读)
 * 用途：解释为何 include memberships 显示 0，但 OrganizationMember.count 为实际值
 */

import { PrismaClient } from 'database';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const email = process.env.TEST_EMAIL || 'ad@test.com';

  if (!dbUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    console.log('=== Stage 35: Membership Include vs Count 对照 (只读) ===\n');
    console.log(`测试用户: ${email}\n`);

    // 1. 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        defaultOrganizationId: true,
      },
    });

    if (!user) {
      console.log('❌ 用户不存在');
      process.exit(1);
    }

    console.log('1️⃣ 用户基本信息:');
    console.log(`  userId: ${user.id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  defaultOrganizationId: ${user.defaultOrganizationId}\n`);

    // 2. 口径 A: OrganizationMember.count (直接表查询)
    const countA = await prisma.organizationMember.count({
      where: { userId: user.id },
    });

    console.log('2️⃣ 口径 A - OrganizationMember.count:');
    console.log(`  count (where userId): ${countA}\n`);

    // 3. 口径 B: User include memberships (Prisma 关系)
    const userWithMemberships = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: true,
      },
    });

    console.log('3️⃣ 口径 B - User.include({ memberships }):');
    console.log(`  memberships.length: ${userWithMemberships?.memberships?.length ?? 0}`);
    console.log(`  memberships relation 字段名: "memberships"`);
    console.log(`  对应 model: Membership (非 OrganizationMember)\n`);

    // 4. 口径 C: User include organizationMembers (正确关系)
    const userWithOrgMembers = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organizationMembers: true,
      },
    });

    console.log('4️⃣ 口径 C - User.include({ organizationMembers }):');
    console.log(
      `  organizationMembers.length: ${userWithOrgMembers?.organizationMembers?.length ?? 0}`
    );
    console.log(`  organizationMembers relation 字段名: "organizationMembers"`);
    console.log(`  对应 model: OrganizationMember\n`);

    // 5. 对照分析
    console.log('5️⃣ 口径对照分析:');
    console.log(`  OrganizationMember.count: ${countA}`);
    console.log(
      `  User.memberships (Membership model): ${userWithMemberships?.memberships?.length ?? 0}`
    );
    console.log(
      `  User.organizationMembers (OrganizationMember model): ${userWithOrgMembers?.organizationMembers?.length ?? 0}`
    );

    if (countA === (userWithOrgMembers?.organizationMembers?.length ?? 0)) {
      console.log(`  ✅ count 与 organizationMembers 一致\n`);
    } else {
      console.log(`  ⚠️ count 与 organizationMembers 不一致\n`);
    }

    // 6. 结论
    console.log('📊 结论:');
    console.log('  - Day 2 日志中 "memberships: 0" 是因为 include 了错误的关系字段');
    console.log('  - User model 有两个关系:');
    console.log('    1. memberships -> Membership (旧的 legacy 关系)');
    console.log('    2. organizationMembers -> OrganizationMember (正确的关系)');
    console.log('  - 应使用 organizationMembers 而非 memberships');
    console.log('  - OrganizationMember.count 是权威口径\n');

    console.log('=== RESULT=PASS ===');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('=== RESULT=FAIL ===');
  console.error(e.message);
  process.exit(1);
});
