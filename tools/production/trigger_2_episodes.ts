/**
 * 生产触发脚本：为第1章和第2章创建CE06解析任务
 * 使用已摄取的novel_chapters.json作为SSOT来源
 */

import { ApiClient } from '../../apps/workers/src/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 加载环境变量
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// 配置 API 客户端
const API_KEY = process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET = process.env.WORKER_API_SECRET || 'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

const apiClient = new ApiClient(
    'http://localhost:3000',
    API_KEY,
    API_SECRET,
    'production-trigger'
);

interface Chapter {
    chapterNo: number;
    title: string;
    text: string;
    charCount: number;
    sha256: string;
}

async function loadNovelSSoT(): Promise<Chapter[]> {
    const ssotPath = path.join(process.cwd(), 'docs/novels/ssot/novel_chapters.json');
    if (!fs.existsSync(ssotPath)) {
        throw new Error(`SSOT 文件不存在: ${ssotPath}`);
    }
    const raw = fs.readFileSync(ssotPath, 'utf-8');
    return JSON.parse(raw) as Chapter[];
}

async function main() {
    console.log('🎬 2集视频正式生产 - CE06 Novel Parsing');
    console.log('========================================');

    // 加载 SSOT
    const chapters = await loadNovelSSoT();
    const totalChars = chapters.reduce((sum, c) => sum + c.charCount, 0);
    console.log(`✅ 已加载 SSOT: ${chapters.length} 章, 共 ${totalChars.toLocaleString()} 字符`);

    // 提取前2章作为生产内容
    const episodeChapters = chapters.slice(0, 2);
    console.log(`📖 目标章节: ${episodeChapters.map(c => c.title).join(', ')}`);

    // 使用数据库中已创建的生产项目
    const productionId = 'prod-2-episode';
    const organizationId = 'default-org';  // 使用种子中的默认组织
    console.log(`🏭 生产ID: ${productionId}`);

    // 为每一章创建 CE06 解析任务
    for (const chapter of episodeChapters) {
        console.log(`\n--- 提交第 ${chapter.chapterNo} 章: ${chapter.title} ---`);
        console.log(`   字符数: ${chapter.charCount.toLocaleString()}`);
        console.log(`   内容哈希: ${chapter.sha256.substring(0, 16)}...`);

        try {
            const job = await apiClient.createJob({
                jobType: 'CE06_NOVEL_PARSING',
                projectId: productionId,
                organizationId: organizationId,
                traceId: `ep-${chapter.chapterNo}-${crypto.randomBytes(4).toString('hex')}`,
                payload: {
                    raw_text: chapter.text,
                    chapterNumber: chapter.chapterNo,
                    title: chapter.title,
                    sourceHash: chapter.sha256,
                    productionMode: true,
                },
            });
            console.log(`   ✅ 任务已创建: ${job.id}`);
        } catch (e: any) {
            console.error(`   ❌ 任务创建失败: ${e.message}`);
        }
    }

    console.log('\n========================================');
    console.log('🎬 生产任务已提交！Worker 将自动处理这些任务。');
    console.log(`📊 监视命令: pnpm -w exec tsx tools/smoke/diag_db.ts --sql "SELECT id, type, status FROM shot_jobs WHERE project_id LIKE '${productionId}%';"`);
}

main().catch(err => {
    console.error('❌ 生产触发失败:', err);
    process.exit(1);
});
