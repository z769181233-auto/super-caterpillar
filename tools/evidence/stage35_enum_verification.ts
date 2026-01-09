/**
 * Stage 35: Enum Verification (只读)
 * 用途：验证修复后 Prisma 可正常查询包含 admin 值的用户
 */

import { PrismaClient } from 'database';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    console.log('=== Stage 35: Enum Verification (只读) ===\n');

    // 1. 测试基础查询（不带 include）
    console.log('1️⃣ 测试基础 User 查询...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        userType: true,
        defaultOrganizationId: true,
      },
      take: 10,
    });

    console.log(`✅ 查询成功，返回 ${users.length} 个用户`);

    // 统计各 role/type
    const roleStats = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const typeStats = users.reduce(
      (acc, u) => {
        acc[u.userType] = (acc[u.userType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('Role 分布:', roleStats);
    console.log('UserType 分布:', typeStats);

    // 2. 测试 include 查询（关键测试）
    console.log('\n2️⃣ 测试 User + OrganizationMember include 查询...');

    const usersWithMembers = await prisma.user.findMany({
      where: {
        defaultOrganizationId: { not: null },
      },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
      take: 5,
    });

    console.log(`✅ Include 查询成功，返回 ${usersWithMembers.length} 个用户`);

    for (const user of usersWithMembers) {
      console.log(
        `  - ${user.email}: role=${user.role}, userType=${user.userType}, memberships=${user.memberships.length}`
      );
    }

    // 3. 统计总数
    console.log('\n3️⃣ 统计总数...');
    const userCount = await prisma.user.count();
    const memberCount = await prisma.organizationMember.count();

    console.log(`user_count= ${userCount}`);
    console.log(`organization_member_count= ${memberCount}`);

    console.log('\n=== RESULT=PASS ===');
  } catch (error: any) {
    console.error('\n=== RESULT=FAIL ===');
    console.error('错误信息:', error.message);

    if (error.message.includes('not found in enum')) {
      console.error('\n⚠️ Enum 解码错误，说明修复未生效');
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  process.exit(1);
});
