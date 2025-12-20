/**
 * 验证 Worker 优雅退出逻辑的模拟脚本
 * 模拟一个 Worker 正在处理任务，此时接收到 SIGTERM 信号
 */

let isRunning = true;
let tasksRunning = 0;

// 模拟任务处理
async function simulateJobProcessing() {
    tasksRunning++;
    console.log(`[MockWorker] Started job. Current running: ${tasksRunning}`);

    // 模拟耗时 3 秒的任务
    await new Promise(resolve => setTimeout(resolve, 3000));

    tasksRunning--;
    console.log(`[MockWorker] Finished job. Current running: ${tasksRunning}`);
}

// 模拟 Shutdown 逻辑 (复制自 worker-agent.ts)
const shutdown = async (signal: string) => {
    console.log(`\n[MockWorker] Received ${signal}, shutting down gracefully...`);
    isRunning = false; // 停止领新任务

    // 等待现有任务完成
    let waitCount = 0;
    const maxWait = 10; // 测试缩短为 10 秒
    while (tasksRunning > 0 && waitCount < maxWait) {
        console.log(`[MockWorker] Waiting for ${tasksRunning} tasks to complete... (${waitCount}/${maxWait}s)`);
        await new Promise((resolve) => setTimeout(resolve, 500)); // 检查频率加快
        waitCount++;
    }

    if (tasksRunning > 0) {
        console.warn(`[MockWorker] Shutdown timed out, ${tasksRunning} tasks still running. Forcing exit.`);
        process.exit(1); // Fail
    } else {
        console.log(`[MockWorker] Graceful shutdown completed. Exiting.`);
        process.exit(0); // Success
    }
};

async function main() {
    console.log('[MockWorker] simulaton started.');

    // 启动一个长任务
    simulateJobProcessing();

    // 1 秒后模拟收到 SIGTERM
    setTimeout(() => {
        console.log('[MockWorker] Simulating SIGTERM signal...');
        shutdown('SIGTERM');
    }, 1000);
}

main();
