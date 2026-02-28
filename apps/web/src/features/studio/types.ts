// apps/web/src/features/studio/types.ts

export type BuildSummary = {
    buildId: string;
    title: string;        // 《万古神帝》
    subtitle?: string;    // 结构化完成 · 可导出剧本状态（可选）
    statusLabel: "AUDITED" | "DRAFT" | "FAILED";
    createdAt: string;

    // KPI
    episodeCount: number;
    sceneCount: number;
    shotCount: number;
    characterCount?: number;

    // Evidence & Audit Config (必需件 D)
    auditId?: string;
    hashChainId?: string;
    globalHash?: string;

    auditConfig?: {
        tensionLow: number;  // 默认 35
        tensionHigh: number; // 默认 80
        rulesVersion: string; // 如 "RULES(v0)"
        dataSource: string;   // 如 "RULE-ENGINE"
    };

    // --- P7.2: 后端稳定审计字段（优先用于 AuditBadges，缺失 = null = unknown）---
    isStructured?: boolean | null;   // 已完成结构化分析（无则 null）
    auditStatus?: 'AUDITED' | 'PENDING' | 'FAILED' | null;   // 审计状态机
    sealStatus?: 'SEALED' | 'UNSEALED' | null;               // 封印/可修改状态
};

export type ScriptNode =
    | { type: "episode"; id: string; index: number; title: string; summary?: string; children: ScriptNode[] }
    | { type: "scene"; id: string; index: number; title: string; summary?: string; children: ScriptNode[] }
    | { type: "shot"; id: string; index: number; title: string; summary?: string; byteStart?: number; byteEnd?: number };

export type ShotRevision = {
    id: string;          // 改为 id 以对齐组件习惯
    parentShotId: string;
    text: string;
    reason?: string;     // 显化修订原因
    type: "TENSION_ENHANCE" | "STYLE_UPGRADE";
    createdAt: string;
    author: "AI-CATERPILLAR";
};

export type ShotReaderPayload = {
    shotId: string;
    title: string;
    summary?: string;
    text: string;
    revisions?: ShotRevision[];
    evidence?: {
        auditId?: string;
        hashChainId?: string;
        sourceHash?: string;
        globalHash?: string;
        byteStart?: number;
        byteEnd?: number;
        fingerprint?: string; // 补全指纹字段
    };
};

export type EmotionalFrame = {
    shotId: string;
    tensionScore: number; // 0-100
    emotionType: "NEUTRAL" | "HIGH_TENSION" | "SAD" | "JOY" | "FEAR" | "ANGER";
    summary?: string;
    diagnostics?: {
        reasonSummary: string;
        dialogueRatio: number;      // 0-100
        actionVerbDensity: number;  // 0-100
    };
};

export type InsightsPayload = {
    topCharacters: Array<{ name: string; count: number }>;
    topLocations?: Array<{ name: string; count: number }>;
    pacing?: { beats: number; intensityHint?: string };

    // L1: 情绪与冲突曲线
    frames?: EmotionalFrame[]; // 重命名为 frames
};

// 显化 UI 状态类型
export type EvidenceState = {
    open: boolean;
    build?: {
        buildId: string;
        auditId?: string;
        hashChainId?: string;
        globalHash?: string;
        auditConfig?: BuildSummary["auditConfig"];
    };
    shot?: {
        shotId: string;
        title: string;
        fingerprint?: string;
        byteStart?: number;
        byteEnd?: number;
    };
};
