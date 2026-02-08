#!/bin/bash
set -e

##############################################
#  0) 自动进入项目目录（解决空格和中文路径问题）
##############################################
PROJECT_DIR=""
echo "�� 切换目录: $PROJECT_DIR"
cd "$PROJECT_DIR"

##############################################
#  1) 安装依赖
##############################################
echo "📦 安装依赖..."
pnpm install

##############################################
#  2) 启动 Mock HTTP Engine（后台模式）
##############################################
echo "⚙️ 启动 Mock HTTP 引擎..."
pnpm mock:http-engine > logs_mock_http_engine.txt 2>&1 &
MOCK_PID=$!
echo "    Mock HTTP 引擎 PID = $MOCK_PID"

# 等待端口 19000 启动
echo "⏳ 等待 Mock HTTP 引擎启动..."
sleep 3

##############################################
#  3) 启动 API（后台模式）
##############################################
echo "🚀 启动 API 服务..."
pnpm --filter api dev > logs_api.txt 2>&1 &
API_PID=$!
echo "    API PID = $API_PID"
sleep 5

##############################################
#  4) 启动 Worker（后台模式）
##############################################
echo "🛠 启动 Worker..."
pnpm --filter @scu/worker dev > logs_worker.txt 2>&1 &
WORKER_PID=$!
echo "    Worker PID = $WORKER_PID"
sleep 5

##############################################
#  5) 创建 3 条 HTTP 测试 Job（SUCCESS/FAILED/RETRYABLE）
##############################################
echo "📝 创建测试任务..."
pnpm --filter api create:http-jobs

echo "⏳ 等待 Worker 处理任务..."
sleep 8

##############################################
#  6) 自动检查数据库中 3 条 Job 的执行结果
##############################################
echo "🔍 自动检查 Job 执行结果..."

node << 'EOS' > job_results.json
const { PrismaClient } = require('database');
const prisma = new PrismaClient();

(async () => {
  const jobs = await prisma.job.findMany({
    where: { type: 'NOVEL_ANALYSIS_HTTP' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
})();
EOS

echo "📄 Job 结果已保存到 job_results.json"
cat job_results.json || true

##############################################
#  7) 输出总结
##############################################
echo
echo "🎉 验证完成："
echo "   SUCCESS   → 应看到 status = SUCCEEDED"
echo "   FAILED    → 应看到 status = FAILED（业务错误）"
echo "   RETRYABLE → 应看到 status = FAILED 且 retryable=true（会触发重试链路）"
echo
echo "🔧 如需手动停止服务："
echo "   kill $MOCK_PID $API_PID $WORKER_PID"
echo
