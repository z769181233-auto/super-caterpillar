// apps/web/src/features/studio/components/StudioShell.tsx
"use client";

import React, { useMemo } from "react";
import "../studio.css";
import "../../../styles/studio-theme.css";
import { BuildSummary, ScriptNode, ShotReaderPayload, InsightsPayload, EvidenceState } from "../types";
import { ScriptTreePanel } from "./ScriptTreePanel";
import { ReaderPanel } from "./ReaderPanel";
import { InsightsPanel } from "./InsightsPanel";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { createT } from "../../../i18n/useT";
import { Locale } from "../../../i18n/dict";
import { UserNav } from "@/components/UserNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useStudioUiStore } from "../state/studioUiStore";
import { resolveAutoFocus } from "../state/autoFocusResolver";
import { Separator } from "@/components/ui/Separator";
import { AuditBadges } from "./AuditBadges";

type Props = {
    summary: BuildSummary;
    tree: ScriptNode[];
    insights: InsightsPayload;
    onSelectShot: (shotId: string) => void;
    selectedShot?: ShotReaderPayload | null;
    loadingShot?: boolean;
    onExportCSV?: () => void;
};

export function StudioShell(props: Props) {
    const { summary, tree, insights, selectedShot, loadingShot } = props;
    const [locale, setLocale] = React.useState<Locale>("zh");
    const t = useMemo(() => createT(locale), [locale]);

    const [evidence, setEvidence] = React.useState<EvidenceState>({ open: false });
    const [searchQuery, setSearchQuery] = React.useState("");

    const applyAutoFocusOnce = useStudioUiStore(s => s.applyAutoFocusOnce);
    const storeSelectedId = useStudioUiStore(s => s.selectedNodeId);

    // Apply autoFocus immediately upon valid data receiving & if criteria are met
    React.useEffect(() => {
        if (!tree || tree.length === 0) return;

        // Count derivation
        let epCount = 0; let scCount = 0; let shCount = 0;
        tree.forEach(ep => {
            if (ep.type === "episode") epCount++;
            if ("children" in ep) {
                ep.children.forEach(sc => {
                    if (sc.type === "scene") scCount++;
                    if ("children" in sc) shCount += sc.children.length;
                });
            }
        });

        // Key identifies uniquely for this specific build/session
        const uniqueKey = `studio:outline:${summary.buildId}`;

        const autoF = resolveAutoFocus(
            tree,
            { episodes: epCount, scenes: scCount, shots: shCount },
            storeSelectedId || selectedShot?.shotId
        );

        if (autoF) {
            applyAutoFocusOnce(uniqueKey, autoF.expandPathIds, autoF.selectNodeId);

            // Wait slightly for DOM expansions and set selected shot.
            if (autoF.selectNodeId) {
                setTimeout(() => {
                    props.onSelectShot(autoF.selectNodeId);
                }, 50);
            }
        }
    }, [tree, summary.buildId, storeSelectedId, selectedShot?.shotId, applyAutoFocusOnce, props]);

    // ... rest of useMemos ...


    const openEvidence = () => {
        setEvidence({
            open: true,
            build: {
                auditId: summary.auditId,
                hashChainId: summary.hashChainId,
                globalHash: summary.globalHash,
                buildId: summary.buildId,
                auditConfig: summary.auditConfig
            },
            shot: selectedShot?.evidence
                ? {
                    shotId: selectedShot.shotId,
                    title: selectedShot.title,
                    ...selectedShot.evidence,
                }
                : undefined,
        });
    };

    const handleExportCSV = () => {
        // Mock CSV Export 逻辑
        const content = "id,title,type\n1,Episode 1,EPISODE\n2,Scene 1,SCENE";
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'studio_script_export.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        alert(t("revisionActive") ? "正在导出修订版..." : "正在导出剧本数据...");
    };

    return (
        <div className="studioRoot">
            <div className="topBar">
                <div className="topBarInner" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '1320px', margin: '0 auto', padding: '14px 18px' }}>
                    <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="brandDot" />
                        <span style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 16 }}>{t("studioBrand")}</span>
                    </div>

                    <div className="actions" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <UserNav />
                        <div style={{ width: 1, height: 24, background: 'var(--line)', margin: '0 8px' }} />
                        <LanguageSwitcher />
                    </div>
                </div>
            </div>

            {/* P6.3.2: TopBar 下方隐形分隔墙 — Token-only 极弱线 */}
            <Separator orientation="horizontal" />

            <main className="main" style={{ paddingTop: 12 }}>
                {/* 标题区与文档级操作 */}
                <div style={{ marginBottom: 24, padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                            {summary.title.replace(/-V2-BYTE-ALIGNED/i, "")}
                        </h1>
                        <div style={{ opacity: 0.5, fontSize: 13 }}>{summary.subtitle || t("enterWorkbench")}</div>
                    </div>
                    {/* P7.2: 审计徽章优先使用后端稳定字段（isStructured/auditStatus），回退到 statusLabel */}
                    <AuditBadges
                        isStructured={summary.isStructured ?? ((summary.episodeCount ?? 0) > 0 ? true : null)}
                        isAudited={summary.auditStatus === 'AUDITED' ? true :
                            summary.auditStatus != null ? false :
                                summary.statusLabel === 'AUDITED' ? true :
                                    summary.statusLabel != null ? false : null}
                        t={t}
                    />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                        <button className="btn" onClick={openEvidence}>
                            {t("evidence")}
                        </button>
                        <button className="btn btnPrimary" onClick={handleExportCSV}>
                            {t("exportCsv")}
                        </button>
                    </div>
                </div>


                <section className="kpiRow">
                    <div className="card kpiCard">
                        <div className="kpiLabel">{t("kpiEpisodes")}</div>
                        <div className="kpiValue">{summary.episodeCount}</div>
                        <div className="kpiHint">{t("kpiEpisodeHint")}</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">{t("kpiScenes")}</div>
                        <div className="kpiValue">{summary.sceneCount}</div>
                        <div className="kpiHint">{t("kpiSceneHint")}</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">{t("kpiShots")}</div>
                        <div className="kpiValue">{summary.shotCount}</div>
                        <div className="kpiHint">{t("kpiShotHint")}</div>
                    </div>
                    <div className="card kpiCard">
                        <div className="kpiLabel">{t("kpiCharacters")}</div>
                        <div className="kpiValue">{summary.characterCount ?? "—"}</div>
                        <div className="kpiHint">{t("kpiCharHint")}</div>
                    </div>
                </section>

                <section className="workspace">
                    <ScriptTreePanel
                        tree={tree}
                        onSelectShot={props.onSelectShot}
                        // To be connected to AutoFocus soon
                        onSelectScene={(id) => { }}
                        t={t}
                        q={searchQuery}
                        onQChange={setSearchQuery}
                    />
                    <ReaderPanel
                        loading={!!loadingShot}
                        shot={selectedShot || null}
                        onOpenEvidence={openEvidence}
                        t={t}
                    />
                    <InsightsPanel
                        insights={insights}
                        onSelectShot={props.onSelectShot}
                        auditConfig={summary.auditConfig}
                        t={t}
                    />
                </section>
            </main>

            <EvidenceDrawer t={t} state={evidence} onClose={() => setEvidence({ open: false })} />
        </div>
    );
}
