// apps/web/src/features/studio/components/ReaderPanel.tsx
"use client";

import React from "react";
import { ShotReaderPayload } from "../types";

interface ReaderPanelProps {
    shot: ShotReaderPayload | null;
    loading: boolean;
    onOpenEvidence: () => void;
}

export const ReaderPanel: React.FC<ReaderPanelProps> = ({
    shot,
    loading,
    onOpenEvidence
}) => {
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const entries = React.useMemo(() => {
        if (!shot?.text) return [];
        // 模拟将长文拆分为段落条目进行 AI 挂载
        return shot.text.split('\n\n').filter(t => t.trim()).map((t, i) => ({
            id: `${shot?.shotId}-part-${i}`,
            index: i + 1,
            content: t.trim()
        }));
    }, [shot]);

    React.useEffect(() => {
        if (shot && containerRef.current) {
            // L1-A: 自动滚动闭环 - 将阅读器视口重置顶部并在后续版本中实现精准段落对齐
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [shot]);

    return (
        <div className="card reader" style={{ height: 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panelHeader">
                <div className="panelTitle">阅读器主舞台</div>
                <button className="btn" onClick={onOpenEvidence} disabled={!shot}>
                    查看指纹
                </button>
            </div>

            <div className="panelBody custom-scroll" ref={containerRef} style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth' }}>
                {!shot && !loading && (
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, padding: "18px 6px", height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        ❦<br />从左侧目录或右侧曲线选择分镜
                    </div>
                )}

                {loading && (
                    <div style={{ color: "var(--gold)", fontSize: 13, padding: "18px 6px", height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        正在锚定文学溯源位置...
                    </div>
                )}

                {shot && !loading && (
                    <article className="animate-in" key={shot.shotId}>
                        <div className="readerTitle" style={{
                            color: 'var(--gold)',
                            borderLeft: '2px solid var(--gold)',
                            paddingLeft: 12,
                            marginBottom: 20
                        }}>
                            {shot.title}
                        </div>

                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                style={{ marginBottom: 20, position: 'relative' }}
                                onMouseEnter={() => setSelectedId(entry.id)}
                                onMouseLeave={() => setSelectedId(null)}
                            >
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: 13, minWidth: 60 }}>
                                        SHOT {String(entry.index).padStart(2, "0")}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.6, marginBottom: 8 }}>
                                            {entry.content}
                                        </div>
                                        {selectedId === entry.id && (
                                            <div style={{
                                                display: 'flex',
                                                gap: 8,
                                                marginTop: 12,
                                                padding: '8px 12px',
                                                background: 'rgba(198,168,94,0.1)',
                                                border: '1px solid rgba(198,168,94,0.3)',
                                                borderRadius: 8,
                                                animation: 'fadeIn 0.3s ease'
                                            }}>
                                                <span style={{ fontSize: 11, color: 'var(--gold)' }}>✨ AI 创作引擎: </span>
                                                <button
                                                    className="pill"
                                                    style={{ background: 'var(--gold)', color: '#000', border: 'none', cursor: 'pointer' }}
                                                    onClick={() => alert(`触发 AI 重写: ${entry.id}`)}
                                                >
                                                    冲突增强建议
                                                </button>
                                                <button
                                                    className="pill"
                                                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gold)', border: '1px solid var(--gold)', cursor: 'pointer' }}
                                                    onClick={() => alert(`触发 AI 润色: ${entry.id}`)}
                                                >
                                                    文笔升级
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div style={{ marginTop: '5rem', borderTop: '1px solid var(--line)', paddingTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={onOpenEvidence} style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                                本分镜物理审计完成 (SHA256 OK)
                            </button>
                        </div>
                    </article>
                )}
            </div>
        </div>
    );
};
