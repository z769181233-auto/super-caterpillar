/**
 * Stage 35: Enum Research Script (只读)
 * 用途：查询数据库中实际的 enum 值，与 Prisma schema 对比
 */

import { PrismaClient } from 'database';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    console.log('=== Stage 35: Enum Research (只读) ===\n');

    // 查询所有 enum 类型
    const enumTypes = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(
      `SELECT DISTINCT t.typname
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       ORDER BY t.typname`
    );

    console.log('数据库中的 Enum 类型：');
    for (const type of enumTypes) {
      console.log(`\n== ${type.typname} ==`);

      const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
        `SELECT e.enumlabel
         FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = $1
         ORDER BY e.enumsortorder`,
        type.typname
      );

      enumValues.forEach((v) => console.log(`  - ${v.enumlabel}`));
    }

    console.log('\n=== 完成 ===');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
