// apps/web/src/features/studio/components/InsightsPanel.tsx
"use client";

import React from "react";
import { InsightsPayload } from "../types";

export function InsightsPanel(props: {
    insights: InsightsPayload;
    onSelectShot?: (id: string) => void;
    auditConfig?: any;
}) {
    const top = props.insights.topCharacters || [];
    const curve = props.insights.curve || [];
    const [hoveredShot, setHoveredShot] = React.useState<any>(null);

    const low = props.auditConfig?.tensionLow || 35;
    const high = props.auditConfig?.tensionHigh || 80;

    return (
        <div className="card" style={{ height: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            <div className="panelHeader">
                <div className="panelTitle">剧本洞察 (Insights)</div>
                <div className="pill" style={{ opacity: 0.8 }}>DATA: {props.auditConfig?.dataSource || 'RULES(v0)'}</div>
            </div>

            <div className="panelBody" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* L1: 情绪与冲突曲线可视化 */}
                <section style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>张力趋势 (Tension Curve)</div>
                        <div style={{ fontSize: 9, opacity: 0.4 }}>RULES VERSION: {props.auditConfig?.rulesVersion}</div>
                    </div>

                    <div style={{
                        height: 120,
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 8,
                        position: 'relative',
                        padding: '10px 0',
                        cursor: 'crosshair'
                    }}>
                        <EmotionalCurveView
                            data={curve}
                            low={low}
                            high={high}
                            onPointClick={(d) => props.onSelectShot?.(d.shotId)}
                            onPointHover={setHoveredShot}
                        />

                        {/* 必需件 B: AI 诊断 Tooltip */}
                        {hoveredShot && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                transform: 'translateX(-50%) translateY(-110%)',
                                width: 200,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--gold)',
                                borderRadius: 8,
                                padding: 12,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                zIndex: 100,
                                pointerEvents: 'none'
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>AI 节奏分析: {hoveredShot.tensionScore} pts</div>
                                <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>{hoveredShot.diagnostics?.reasonSummary}</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <DiagPill label="对话" val={`${hoveredShot.diagnostics?.dialogueRatio}%`} />
                                    <DiagPill label="动作" val={`${hoveredShot.diagnostics?.actionVerbDensity}%`} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
                        <span>开场</span>
                        <span style={{ color: curve.some(d => d.tensionScore < low) ? '#ff4d4f' : 'inherit' }}>
                            检测到 {curve.filter(d => d.tensionScore < low).length} 处节奏塌陷区
                        </span>
                        <span>高潮</span>
                    </div>
                </section>

                <section>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>角色权重分布</div>
                    {top.slice(0, 5).map((c) => (
                        <div
                            key={c.name}
                            className="insightItem"
                            style={{
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 12,
                                padding: "8px 12px",
                                background: "rgba(255,255,255,0.015)",
                                marginBottom: 6
                            }}
                        >
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>{c.name}</div>
                            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                                权重评分：{(c.count / 10).toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}

function DiagPill({ label, val }: { label: string; val: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>
            <span style={{ opacity: 0.5 }}>{label}</span> <span style={{ color: 'var(--gold)' }}>{val}</span>
        </div>
    );
}

function EmotionalCurveView({ data, low, high, onPointClick, onPointHover }: { data: any[]; low: number; high: number; onPointClick: (d: any) => void; onPointHover: (d: any | null) => void }) {
    if (!data.length) return null;

    const width = 260;
    const height = 100;

    const points = data.map((d, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - (d.tensionScore / 100) * height,
        data: d
    }));

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <svg
            width="100%" height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            onMouseLeave={() => onPointHover(null)}
        >
            <path
                d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
                fill="url(#curveGradient)"
                opacity="0.2"
            />

            <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
            </defs>

            <path
                d={pathData}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.5"
                opacity="0.6"
            />

            {points.map((p, i) => {
                const isCollapse = p.data.tensionScore < low;
                const isPeak = p.data.tensionScore > high;

                return (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={isCollapse || isPeak ? 4 : 2}
                        fill={isCollapse ? "#ff4d4f" : isPeak ? "var(--gold)" : "rgba(255,255,255,0.3)"}
                        style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                        onClick={() => onPointClick(p.data)}
                        onMouseEnter={() => onPointHover(p.data)}
                    />
                );
            })}
        </svg>
    );
}
