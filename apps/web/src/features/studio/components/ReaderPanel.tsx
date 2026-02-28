// apps/web/src/features/studio/components/ReaderPanel.tsx
"use client";

import React from "react";
import { ShotReaderPayload } from "../types";
import { dict } from "../../../i18n/dict";
import { useStudioUiStore } from "../state/studioUiStore";

type TTable = typeof dict["zh"];
type TFunc = <K extends keyof TTable>(key: K, vars?: Record<string, string | number>) => string;

export type ReaderPanelProps = {
    shot: ShotReaderPayload | null;
    loading: boolean;
    onOpenEvidence: () => void;
    t: TFunc;
};

export function ReaderPanel({ shot, loading, onOpenEvidence, t }: ReaderPanelProps) {
    const [selectedRevisionId, setSelectedRevisionId] = React.useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // P6.2: Store actions for reader -> curve sync
    const setPendingShot = useStudioUiStore(s => s.setPendingShot);
    const commitPendingShot = useStudioUiStore(s => s.commitPendingShot);

    // 当选中的 shot 改变时，重置修订选择，并平滑滚动到视野区域
    React.useEffect(() => {
        setSelectedRevisionId(null);
        if (shot?.shotId) {
            const el = document.getElementById(`shot-anchor-${shot.shotId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }
    }, [shot?.shotId]);

    // P6.2.2: IntersectionObserver 监听唐第内容匹配，去抖后提交候选 shotId
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container || !shot?.shotId) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const mostVisible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (mostVisible) {
                    const candidateId = (mostVisible.target as HTMLElement).dataset.shotId;
                    if (candidateId) {
                        setPendingShot(candidateId);
                        // 去抖 100ms 后提交，满足“停止滚动/稳定态”后更新
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                            commitPendingShot('reader');
                        }, 100);
                    }
                }
            },
            { root: container, threshold: [0.3, 0.6, 1.0] }
        );

        // Observe the shot anchor element
        const anchor = container.querySelector(`[data-shot-id="${shot.shotId}"]`);
        if (anchor) observer.observe(anchor);

        return () => {
            observer.disconnect();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [shot?.shotId, setPendingShot, commitPendingShot]);

    const activeText = React.useMemo(() => {
        if (!shot) return "";
        if (!selectedRevisionId) return shot.text;
        const rev = shot.revisions?.find(r => r.id === selectedRevisionId);
        return rev ? rev.text : shot.text;
    }, [shot, selectedRevisionId]);

    if (loading) {
        return (
            <div className="card studio-panel" style={{ height: 'calc(100vh - 350px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="gold-text" style={{ opacity: 0.5 }}>Loading...</span>
            </div>
        );
    }

    if (!shot) {
        return (
            <div className="card studio-panel" style={{ height: 'calc(100vh - 350px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <div style={{ marginBottom: 12 }}>🖋️</div>
                    {t("emptyHint")}
                </div>
            </div>
        );
    }

    return (
        <div className="card studio-panel" style={{ height: 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panelHeader">
                <div className="panelTitle">{t("readerStage")}</div>
            </div>

            <div
                id={shot ? `shot-anchor-${shot.shotId}` : undefined}
                className="panelBody scroll-thin reader-stage"
                style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div className="readerTitle gold-text" style={{ fontSize: 18 }}>
                        {t("shot", { n: shot.title })}
                    </div>
                    {shot.revisions && shot.revisions.length > 0 && (
                        <div className="pill" style={{ borderColor: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', fontSize: 10 }}>
                            {t("revisionActive")}
                        </div>
                    )}
                </div>

                <div className="readerText">
                    {activeText}
                </div>

                {/* AI Revision Portal */}
                {shot.revisions && shot.revisions.length > 0 && (
                    <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px dashed var(--line-separator)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{t("aiEngine")}</span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            <button
                                onClick={() => setSelectedRevisionId(null)}
                                className={`btn ${!selectedRevisionId ? 'btnPrimary' : ''}`}
                                style={{ fontSize: 12, borderRadius: 8 }}
                            >
                                {t("original")}
                            </button>
                            {shot.revisions.map(rev => (
                                <button
                                    key={rev.id}
                                    onClick={() => setSelectedRevisionId(rev.id)}
                                    className={`btn ${selectedRevisionId === rev.id ? 'btnPrimary' : ''}`}
                                    style={{ fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <span>{t("revision")}</span>
                                    <span style={{ fontSize: 10, opacity: 0.6 }}>#{rev.id.slice(0, 4)}</span>
                                </button>
                            ))}
                        </div>

                        {selectedRevisionId && (
                            <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--line-separator)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t("tensionEnhance")}</div>
                                <div style={{ fontSize: 13, color: 'var(--gold-primary)' }}>
                                    {shot.revisions.find(r => r.id === selectedRevisionId)?.reason || "Tension balanced."}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
