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
};

export type ScriptNode =
    | { type: "episode"; id: string; index: number; title: string; summary?: string; children: ScriptNode[] }
    | { type: "scene"; id: string; index: number; title: string; summary?: string; children: ScriptNode[] }
    | { type: "shot"; id: string; index: number; title: string; summary?: string; byteStart?: number; byteEnd?: number };

export type ShotReaderPayload = {
    shotId: string;
    title: string;
    summary?: string;

    // 阅读器正文（给创作者看）
    text: string;

    // 证据字段（进抽屉）
    evidence?: {
        auditId?: string;
        hashChainId?: string;
        sourceHash?: string;
        globalHash?: string;
        byteStart?: number;
        byteEnd?: number;
    };
};

export type EmotionalFrame = {
    shotId: string;
    tensionScore: number; // 0-100
    emotionType: "NEUTRAL" | "HIGH_TENSION" | "SAD" | "JOY" | "FEAR" | "ANGER";
    summary?: string;
};

export type InsightsPayload = {
    topCharacters: Array<{ name: string; count: number }>;
    topLocations?: Array<{ name: string; count: number }>;
    pacing?: { beats: number; intensityHint?: string };

    // L1: 情绪与冲突曲线
    curve?: EmotionalFrame[];
};
