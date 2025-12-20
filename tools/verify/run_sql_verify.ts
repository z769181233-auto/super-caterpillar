/**
 * SQL 验证 Runner
 * 使用 Prisma $queryRawUnsafe 执行 SQL 文件内容并输出结果
 */

import { PrismaClient } from 'database';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

const prisma = new PrismaClient();

interface SqlResult {
  sqlFile: string;
  success: boolean;
  results: any[];
  error?: string;
}

// Helper function to serialize BigInt values
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  return obj;
}

export async function runSqlVerify(sqlFiles: string[]): Promise<SqlResult[]> {
  const results: SqlResult[] = [];

  for (const sqlFile of sqlFiles) {
    try {
      const sqlPath = join(rootDir, 'tools/verify/sql', sqlFile);
      const sql = readFileSync(sqlPath, 'utf-8');

      // 执行 SQL（Prisma 的 $queryRawUnsafe 支持多语句）
      // 注意：如果 SQL 包含多个语句，需要分别执行
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      let allResults: any[] = [];

      for (const statement of statements) {
        if (statement.trim()) {
          const result = await prisma.$queryRawUnsafe(statement.trim());
          if (Array.isArray(result)) {
            allResults = allResults.concat(result.map(serializeBigInt));
          } else {
            allResults.push(serializeBigInt(result));
          }
        }
      }

      results.push({
        sqlFile,
        success: true,
        results: allResults,
      });
    } catch (error: any) {
      results.push({
        sqlFile,
        success: false,
        results: [],
        error: error.message,
      });
    }
  }

  return results;
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const sqlFiles = process.argv.slice(2);
  if (sqlFiles.length === 0) {
    // 默认执行所有 SQL 文件
    const defaultFiles = ['audit_recent.sql', 'job_status_agg.sql', 'entity_integrity.sql'];
    runSqlVerify(defaultFiles)
      .then(results => {
        console.log(JSON.stringify(results, null, 2));
        process.exit(results.every(r => r.success) ? 0 : 1);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      })
      .finally(() => {
        prisma.$disconnect();
      });
  } else {
    runSqlVerify(sqlFiles)
      .then(results => {
        console.log(JSON.stringify(results, null, 2));
        process.exit(results.every(r => r.success) ? 0 : 1);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      })
      .finally(() => {
        prisma.$disconnect();
      });
  }
}

