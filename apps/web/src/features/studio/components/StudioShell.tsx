// apps/web/src/features/studio/components/StudioShell.tsx
"use client";

import React from "react";
import "../studio.css";
import { BuildSummary, ScriptNode, ShotReaderPayload, InsightsPayload } from "../types";
import { ScriptTreePanel } from "./ScriptTreePanel";
import { ReaderPanel } from "./ReaderPanel";
import { InsightsPanel } from "./InsightsPanel";
import { EvidenceDrawer, EvidenceState } from "./EvidenceDrawer";

type Props = {
    summary: BuildSummary;
    tree: ScriptNode[];
    insights: InsightsPayload;
    onSelectShot: (shotId: string) => void;

    selectedShot?: ShotReaderPayload | null;
    loadingShot?: boolean;

    // CSV 导出（可先占位）
    onExportCSV?: () => void;
};

export function StudioShell(props: Props) {
    const { summary, tree, insights, selectedShot, loadingShot } = props;

    const [evidence, setEvidence] = React.useState<EvidenceState>({ open: false });

    const openEvidence = () => {
        // 抽屉数据来源：优先分镜 evidence，其次 build summary evidence
        setEvidence({
            open: true,
            build: {
                auditId: summary.auditId,
                hashChainId: summary.hashChainId,
                globalHash: summary.globalHash,
                buildId: summary.buildId,
                auditConfig: summary.auditConfig
            } as any,
            shot: selectedShot?.evidence
                ? {
                    shotId: selectedShot.shotId,
                    title: selectedShot.title,
                    ...selectedShot.evidence,
                }
                : undefined,
        });
    };

    return (
        <div className="studioRoot">
            <div className="topBar">
                <div className="topBarInner">
                    <div className="brand">
                        <span className="brandDot" />
                        <span>Super Caterpillar Studio</span>
                    </div>

                    <div className="titleBlock">
                        <div className="title">《{summary.title}》</div>
                        <div className="subtitle">{summary.subtitle || "结构化完成 · 可导出剧本状态"}</div>
                    </div>

                    <div className="actions">
                        <button className="btn" onClick={openEvidence}>
                            证据
                        </button>
                        <button className="btn btnPrimary" onClick={props.onExportCSV}>
                            导出 CSV
                        </button>
                    </div>
                </div>
            </div>

            <main className="main">
                <section className="kpiRow">
                    <div className="card kpiCard">
                        <div className="kpiLabel">集数</div>
                        <div className="kpiValue">{summary.episodeCount}</div>
                        <div className="kpiHint">按创作语义分集</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">场景</div>
                        <div className="kpiValue">{summary.sceneCount}</div>
                        <div className="kpiHint">剧情推进单元</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">分镜</div>
                        <div className="kpiValue">{summary.shotCount}</div>
                        <div className="kpiHint">可直接交付拍摄</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">角色</div>
                        <div className="kpiValue">{summary.characterCount ?? "—"}</div>
                        <div className="kpiHint">资产库累计</div>
                    </div>
                </section>

                <section className="workspace">
                    <ScriptTreePanel tree={tree} onSelectShot={props.onSelectShot} />
                    <ReaderPanel
                        loading={!!loadingShot}
                        shot={selectedShot || null}
                        onOpenEvidence={openEvidence}
                    />
                    <InsightsPanel
                        insights={insights}
                        onSelectShot={props.onSelectShot}
                        auditConfig={summary.auditConfig}
                    />
                </section>
            </main>

            <EvidenceDrawer state={evidence} onClose={() => setEvidence({ open: false })} />
        </div>
    );
}
