// apps/web/src/features/studio/components/InsightsPanel.tsx
"use client";

import React, { useCallback } from "react";
import { InsightsPayload } from "../types";
import { dict } from "../../../i18n/dict";
import { useStudioUiStore } from "../state/studioUiStore";
import { mapFramesToCurvePoints } from "../state/tensionCurveMapper";

type TTable = typeof dict["zh"];
type TFunc = <K extends keyof TTable>(key: K, vars?: Record<string, string | number>) => string;

export type InsightsPanelProps = {
    insights: InsightsPayload;
    onSelectShot: (shotId: string) => void;
    auditConfig: {
        tensionLow: number;
        tensionHigh: number;
        rulesVersion: string;
        dataSource: string;
    };
    t: TFunc;
};

export function InsightsPanel({ insights, onSelectShot, auditConfig, t }: InsightsPanelProps) {
    // P6.2: subscribe to store for activeShotId + action
    const activeShotId = useStudioUiStore(s => s.activeShotId);
    const setActiveShot = useStudioUiStore(s => s.setActiveShot);
    const clearSyncSource = useStudioUiStore(s => s.clearSyncSource);

    // P6.2.1: Curve click → Primary path (强制定位)
    const handleCurvePointClick = useCallback((shotId: string) => {
        // 1. 设置来源为 'curve'，激活闸门防止 Reader 滚动反向回调
        setActiveShot(shotId, 'curve');
        // 2. 通知上层（StudioShell）加载该 Shot 的内容
        onSelectShot(shotId);
        // 3. 释放闸门（让下次滚动可以正常响应）
        setTimeout(() => clearSyncSource(), 120);
    }, [setActiveShot, onSelectShot, clearSyncSource]);

    const renderTension = () => {
        const frames = insights.frames;
        if (!frames || frames.length === 0) return null;

        // P6.2.4: 使用 mapper 建立显式 shotId 绑定，不用数组下标
        const curvePoints = mapFramesToCurvePoints(frames, 12);
        const collapseCount = curvePoints.filter(p => p.isCollapse).length;

        return (
            <div className="card studio-panel" style={{ padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div className="panelTitle" style={{ fontSize: 11, opacity: 0.8 }}>{t("tensionCurve").split(" (")[0]}</div>
                </div>

                <div
                    style={{
                        height: 100,
                        position: 'relative',
                        padding: '10px 4px',
                        background: 'rgba(0,0,0,0.15)',
                        borderRadius: 8,
                        overflow: 'hidden'
                    }}
                >
                    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
                        <defs>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {/* Area Fill */}
                        <path
                            d={`M 0 100 ${curvePoints.map(p => `L ${p.x} ${p.y}`).join(' ')} L 100 100 Z`}
                            fill="url(#lineGrad)"
                        />
                        {/* Main Line */}
                        <path
                            d={`M ${curvePoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                            fill="none"
                            stroke="var(--gold-primary)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Interaction Dots — P6.2: activeShotId 高亮 */}
                        {curvePoints.map((point) => {
                            const isActive = point.shotId === activeShotId;
                            return (
                                <circle
                                    key={point.shotId}  // 使用 shotId 作为 key，而不是 array index
                                    cx={`${point.x}`}
                                    cy={`${point.y}`}
                                    r={isActive ? "3" : (point.isCollapse ? "1.5" : "1")}
                                    fill={isActive ? "var(--gold-primary)" : (point.isCollapse ? "#ef4444" : "var(--gold-primary)")}
                                    stroke={isActive ? "rgba(255,255,255,0.8)" : "none"}
                                    strokeWidth={isActive ? "0.5" : "0"}
                                    opacity={isActive ? 1 : (point.isCollapse ? 1 : 0.7)}
                                    onClick={() => handleCurvePointClick(point.shotId)}
                                    style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
                                />
                            );
                        })}
                    </svg>
                </div>

                {collapseCount > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 9, background: '#ef4444' }} />
                        <span>{t("collapseCount", { n: collapseCount })}</span>
                    </div>
                )}
            </div>
        );
    };

    // P6.3.1: Roles Collapse - 订阅 store，支持自动策略 + 手动 override
    const rolesCollapsed = useStudioUiStore(s => s.rolesCollapsed);
    const rolesCollapseMode = useStudioUiStore(s => s.rolesCollapseMode);
    const setRolesCollapsed = useStudioUiStore(s => s.setRolesCollapsed);

    // 角色权重数据（实际项目中来自 insights.topCharacters，此处使用模拟数据结构）
    const characters = insights.topCharacters && insights.topCharacters.length > 0
        ? insights.topCharacters.map(c => ({ name: c.name, pct: Math.min(100, Math.round((c.count / (insights.topCharacters[0]?.count || 1)) * 65)) }))
        : [
            { name: "张若尘", pct: 65 },
            { name: "池瑶", pct: 25 },
            { name: "小黑", pct: 10 }
        ];

    // 自动折叠策略：角色数 > 6 且用户未手动干预时自动折叠
    React.useEffect(() => {
        if (rolesCollapseMode === 'auto') {
            setRolesCollapsed(characters.length > 6, 'auto');
        }
    }, [characters.length, rolesCollapseMode, setRolesCollapsed]);

    const handleToggleRoles = () => {
        // 用户手动 toggle，置为 manual 模式，后续不再被自动策略覆盖
        setRolesCollapsed(!rolesCollapsed, 'manual');
    };

    const renderRoles = () => {
        const top2 = characters.slice(0, 2);
        const extraCount = characters.length - 2;

        return (
            <div className="card studio-panel" style={{ padding: 12 }}>
                {/* 折叠头：标题 + 展开/收起按钮 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: rolesCollapsed ? 0 : 16 }}>
                    <div className="panelTitle" style={{ fontSize: 11, opacity: 0.8 }}>
                        {t("rolesTitle")}
                    </div>
                    <button
                        onClick={handleToggleRoles}
                        style={{
                            background: 'none',
                            border: '1px solid var(--line-separator)',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--gold-primary)'; (e.target as HTMLElement).style.color = 'var(--gold-primary)'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--line-separator)'; (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                        {rolesCollapsed ? t("showMore") : t("showLess")}
                    </button>
                </div>

                {/* 折叠态：Top2 + +N 汇总 */}
                {rolesCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
                        {top2.map(c => (
                            <span key={c.name} style={{
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 10,
                                background: 'var(--gold-tint-10)',
                                border: '1px solid var(--gold-primary)',
                                color: 'var(--gold-primary)',
                            }}>
                                {c.name} <span style={{ opacity: 0.7 }}>{c.pct}%</span>
                            </span>
                        ))}
                        {extraCount > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>
                                +{extraCount}
                            </span>
                        )}
                    </div>
                )}

                {/* 展开态：完整列表 */}
                {!rolesCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {characters.map(char => (
                            <div key={char.name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                    <span>{char.name}</span>
                                    <span className="gold-text">{char.pct}%</span>
                                </div>
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${char.pct}%`, background: 'var(--gold-primary)', transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ height: 'calc(100vh - 350px)', overflowY: 'auto' }} className="scroll-thin">
            {renderTension()}
            {renderRoles()}
        </div>
    );
}
