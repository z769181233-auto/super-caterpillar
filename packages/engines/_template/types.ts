/**
 * 引擎母版 - 类型定义
 * 
 * 使用方法:
 * 1. 复制此文件到新引擎目录
 * 2. 将 __ENGINE__ 替换为实际引擎名（如 CE07）
 * 3. 根据业务需求修改 Input/Output 接口
 * 
 * SSOT: 所有引擎必须包含 billing_usage 和 audit_trail
 */

/**
 * 计费使用量（所有引擎必须输出）
 */
export interface EngineBillingUsage {
    /** Prompt 消耗的 token 数 */
    promptTokens: number;
    /** Completion 消耗的 token 数 */
    completionTokens: number;
    /** 总 token 数 */
    totalTokens: number;
    /** 使用的模型（用于价格表查价） */
    model: string;
    /** GPU 使用秒数（可选，用于渲染类引擎） */
    gpuSeconds?: number;
}

/**
 * 审计追踪（所有引擎必须输出）
 */
export interface EngineAuditTrail {
    /** 引擎标识 */
    engineKey: string;
    /** 引擎版本 */
    engineVersion: string;
    /** 执行时间戳 */
    timestamp: string;
    /** 输入参数哈希（用于幂等性检测） */
    paramsHash: string;
    /** 链路追踪 ID */
    traceId?: string;
}

/**
 * 引擎输入（根据实际业务修改）
 */
export interface __ENGINE__Input {
    // === 必填字段 ===
    /** 链路追踪 ID */
    traceId: string;
    /** 项目 ID */
    projectId: string;

    // === 业务字段（根据实际需求添加） ===
    // 示例: prompt: string;
    // 示例: config: { model: string; temperature: number; };

    // === 扩展字段 ===
    [key: string]: any;
}

/**
 * 引擎输出（根据实际业务修改）
 */
export interface __ENGINE__Output {
    // === 业务字段（根据实际需求添加） ===
    // 示例: result: { ... };
    // 示例: asset: { uri: string; sha256: string; };

    // === 必填字段（SSOT 强制） ===
    /** 计费使用量 */
    billing_usage: EngineBillingUsage;
    /** 审计追踪（可选但推荐） */
    audit_trail?: EngineAuditTrail;

    // === 扩展字段 ===
    [key: string]: any;
}
