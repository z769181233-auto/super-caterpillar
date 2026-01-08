export interface RuntimeConfig {
    jobMaxInFlight: number;
    nodeMaxOldSpaceMb: number;
}

/**
 * 运行时 Profile 管理
 * 根据 SAFE_MODE 环境变量决定稳定性策略，而非全局锁死。
 */
export function getRuntimeConfig(): RuntimeConfig {
    const isSafeMode = process.env.SAFE_MODE === '1';

    // 默认值从 env 读取 (config.jobMaxInFlight 已处理默认 10)
    const defaultMaxInFlight = parseInt(process.env.JOB_MAX_IN_FLIGHT || '10', 10);

    return {
        // SAFE_MODE 下限制为 2，否则保持生产/环境默认值
        jobMaxInFlight: isSafeMode ? 2 : defaultMaxInFlight,

        // SAFE_MODE 下显式建议内存限额（主要用于日志增强或 Gate 脚本 NODE_OPTIONS）
        nodeMaxOldSpaceMb: isSafeMode ? 4096 : 8192,
    };
}
