/**
 * CE02 Identity Lock Engine - 类型定义
 * 
 * 功能：角色一致性锁定（Identity Lock）
 * 定位：确保场景中的角色描述与项目角色库一致，在 SHOT_RENDER 前调用
 * 重要：CE02 不是母引擎，是业务引擎之一
 */

/**
 * 计费使用量（所有引擎必须输出）
 */
export interface EngineBillingUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
    gpuSeconds?: number;
}

/**
 * 审计追踪（所有引擎必须输出）
 */
export interface EngineAuditTrail {
    engineKey: string;
    engineVersion: string;
    timestamp: string;
    paramsHash: string;
    traceId?: string;
}

/**
 * CE02 输入
 */
export interface CE02IdentityLockInput {
    /** 场景文本（enriched_text） */
    sceneText: string;
    /** 项目 ID */
    projectId: string;
    /** 链路追踪 ID */
    traceId: string;
    /** 已知的角色 ID 列表（可选） */
    characterIds?: string[];
    /** 扩展字段 */
    [key: string]: any;
}

/**
 * 锁定的角色信息
 */
export interface LockedCharacter {
    id: string;
    name: string;
    description: string;
    visualTraits?: string; // 视觉特征描述
}

/**
 * CE02 输出
 */
export interface CE02IdentityLockOutput {
    /** 身份锁定令牌（用于后续审计追踪） */
    identity_lock_token: string;
    /** 角色一致性分数 (0-1) */
    character_consistency_score: number;
    /** 锁定的角色列表 */
    locked_characters: LockedCharacter[];
    /** 计费使用量 */
    billing_usage: EngineBillingUsage;
    /** 审计追踪 */
    audit_trail: EngineAuditTrail;
    /** 扩展字段 */
    [key: string]: any;
}
