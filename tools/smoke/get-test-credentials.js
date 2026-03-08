#!/usr/bin/env node
/**
 * 获取测试用的 API_KEY、API_SECRET 和 TEST_PROJECT_ID
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient({});

async function main() {
  try {
    // 1. 查询所有 ACTIVE 的 API Key，然后过滤出有 secretHash 的
    const allApiKeys = await prisma.apiKey.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // 优先使用有 secretHash 的（开发环境通常使用这个）
    let apiKey = allApiKeys.find((k) => k.secretHash) || allApiKeys[0];

    if (!apiKey) {
      console.error('⚠️  未找到可用的 API Key，创建测试用的 API Key...');
      // 创建测试用的 API Key
      const testKey = `ak_test_${Date.now().toString(36)}`;
      const testSecret = require('crypto').randomBytes(32).toString('hex');

      const newApiKey = await prisma.apiKey.create({
        data: {
          key: testKey,
          secretHash: testSecret, // 开发环境：直接存储明文
          name: 'Test API Key for Smoke Test',
          status: 'ACTIVE',
        },
      });

      console.error(`✅ 已创建测试 API Key: ${testKey}`);
      apiKey = newApiKey;
      secret = testSecret;
    }

    // 2. 获取 Secret（优先使用 secretHash，否则需要解密 secretEnc）
    let secret = null;
    if (apiKey.secretHash) {
      secret = apiKey.secretHash;
    } else if (apiKey.secretEnc && apiKey.secretEncIv && apiKey.secretEncTag) {
      // 如果有加密存储，需要解密（这里暂时跳过，使用 secretHash）
      console.error('⚠️  API Key 使用加密存储，需要解密。请使用 secretHash 的 API Key。');
      process.exit(1);
    }

    if (!secret) {
      console.error('❌ 无法获取 API Secret');
      process.exit(1);
    }

    // 3. 查询 Project
    let project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!project) {
      console.error('⚠️  未找到可用的 Project，创建测试用的 Project...');

      // 查找或创建测试用户
      let user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!user) {
        console.error('⚠️  未找到用户，创建测试用户...');
        user = await prisma.user.create({
          data: {
            email: `test_${Date.now()}@example.com`,
            passwordHash: 'test', // 测试环境
          },
        });
        console.error(`✅ 已创建测试用户: ${user.id}`);
      }

      // 查找或创建测试组织
      let org = await prisma.organization.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!org) {
        console.error('⚠️  未找到组织，创建测试组织...');
        org = await prisma.organization.create({
          data: {
            name: 'Test Organization',
            ownerId: user.id,
          },
        });
        console.error(`✅ 已创建测试组织: ${org.id}`);
      }

      // 创建测试 Project
      project = await prisma.project.create({
        data: {
          name: 'Test Project for Smoke Test',
          ownerId: user.id,
          organizationId: org.id,
          status: 'in_progress', // ProjectStatus 枚举值
        },
      });
      console.error(`✅ 已创建测试 Project: ${project.id}`);
    }

    // 输出环境变量
    console.log(`export API_BASE_URL="http://localhost:3000"`);
    console.log(`export API_KEY="${apiKey.key}"`);
    console.log(`export API_SECRET="${secret}"`);
    console.log(`export TEST_PROJECT_ID="${project.id}"`);

    console.error(`\n✅ 找到 API Key: ${apiKey.key}`);
    console.error(`✅ 找到 Project: ${project.id} (${project.name || 'unnamed'})`);
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
