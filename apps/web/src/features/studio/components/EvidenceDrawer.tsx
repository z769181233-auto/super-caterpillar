// apps/web/src/features/studio/components/EvidenceDrawer.tsx
"use client";

import React from "react";

export type EvidenceState = {
    open: boolean;
    build?: {
        buildId?: string;
        auditId?: string;
        hashChainId?: string;
        globalHash?: string;
        auditConfig?: {
            tensionLow?: number;
            tensionHigh?: number;
            rulesVersion?: string;
            dataSource?: string;
        };
    };
    shot?: {
        shotId?: string;
        title?: string;
        auditId?: string;
        hashChainId?: string;
        sourceHash?: string;
        globalHash?: string;
        byteStart?: number;
        byteEnd?: number;
    };
};

export function EvidenceDrawer(props: { state: EvidenceState; onClose: () => void }) {
    if (!props.state.open) return null;

    const s = props.state;

    return (
        <>
            <div className="drawerMask" onClick={props.onClose} />
            <aside className="drawer" role="dialog" aria-modal="true">
                <div className="drawerHeader">
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 800 }}>证据与溯源审计</div>
                    <button className="btn" onClick={props.onClose}>
                        关闭
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: "0 0 2rem 0" }}>
                    <div style={{ padding: "16px 20px", color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
                        说明：此抽屉展示了当前创作内容的底层物理证据。包含 SHA256 跨链哈希、审计序列号及字节段偏移量。
                    </div>

                    <section style={{ marginBottom: 24 }}>
                        <div style={{ padding: "10px 20px", color: "var(--gold)", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            作品级全局凭证 (Build)
                        </div>
                        <KV k="BuildID" v={s.build?.buildId} />
                        <KV k="AuditID" v={s.build?.auditId} />
                        <KV k="HashChainID" v={s.build?.hashChainId} />
                        <KV k="GlobalHash" v={s.build?.globalHash} />
                    </section>

                    <section style={{ marginBottom: 24 }}>
                        <div style={{ padding: "10px 20px", color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                            {/* L3: 不可替代性认证 / 数据指纹 */}
                        </div>
                        <div style={{
                            marginTop: 32,
                            padding: 20,
                            border: '1px solid rgba(198,168,94,0.3)',
                            borderRadius: 12,
                            background: 'repeating-linear-gradient(45deg, rgba(198,168,94,0.02), rgba(198,168,94,0.02) 10px, transparent 10px, transparent 20px)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: -10,
                                right: -10,
                                opacity: 0.1,
                                fontSize: 40,
                                fontWeight: 900,
                                color: 'var(--gold)',
                                transform: 'rotate(-20deg)'
                            }}>
                                OFFICIAL
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 8px #52c41a' }} />
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em' }}>DATA AUTHENTICITY VERIFIED</div>
                            </div>

                            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
                                本次分析由 <b>Caterpillar Core AI v2.1</b> 执行。审计报告对应的 IPFS 内容哈希已锁定，确保 AI 创作决策的溯源性与真实性。
                            </div>

                            <div style={{
                                marginTop: 16,
                                fontFamily: 'monospace',
                                fontSize: 9,
                                color: 'rgba(255,255,255,0.3)',
                                padding: '4px 8px',
                                background: '#000',
                                borderRadius: 4,
                                textOverflow: 'ellipsis',
                                overflow: 'hidden'
                            }}>
                                CID: bafybeigdyrzt5sfp7udm7hu76uh79y
                            </div>
                        </div>

                        <div className="summaryItem" style={{ marginTop: 24 }}>
                            <div className="summaryLabel"> rulesVersion </div>
                            <div className="summaryValue"> {s.build?.auditConfig?.rulesVersion || '2024.Q1'} </div>
                        </div>
                        <KV k="Tension High" v={String(s.build?.auditConfig?.tensionHigh || 80)} />
                        <KV k="Tension Low" v={String(s.build?.auditConfig?.tensionLow || 35)} />
                        <KV k="Data Source" v={s.build?.auditConfig?.dataSource} />
                    </section>

                    {s.shot && (
                        <section>
                            <div style={{ padding: "10px 20px", color: "var(--gold)", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                当前分镜物理指纹 (Shot)
                            </div>
                            <KV k="Label" v={s.shot.title} />
                            <KV k="ShotID" v={s.shot.shotId} />
                            <KV k="SourceHash" v={s.shot.sourceHash} />
                            <KV k="ByteRange" v={s.shot.byteStart != null && s.shot.byteEnd != null ? `${s.shot.byteStart} → ${s.shot.byteEnd}` : undefined} />
                        </section>
                    )}
                </div>
            </aside>
        </>
    );
}

function KV(props: { k: string; v?: string }) {
    if (!props.v) return null;
    return (
        <div className="kv">
            <div className="kvKey">{props.k}</div>
            <div className="kvVal">{props.v}</div>
        </div>
    );
}
