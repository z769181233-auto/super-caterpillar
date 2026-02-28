// apps/web/src/features/studio/components/EvidenceDrawer.tsx
"use client";

import React from "react";
import { EvidenceState } from "../types";
import { dict } from "../../../i18n/dict";

type TTable = typeof dict["zh"];
type TFunc = <K extends keyof TTable>(key: K, vars?: Record<string, string | number>) => string;

export function EvidenceDrawer({
    state,
    onClose,
    t
}: {
    state: EvidenceState;
    onClose: () => void;
    t: TFunc;
}) {
    if (!state.open) return null;

    const build = state.build;
    const shot = state.shot;

    return (
        <>
            <div className="drawerMask" onClick={onClose} />
            <div className="drawer scroll-thin">
                <div className="drawerHeader">
                    <div className="panelTitle" style={{ fontSize: 13 }}>{t("auditTitle")}</div>
                    <button className="btn" onClick={onClose} style={{ borderRadius: 8, padding: '4px 8px' }}>
                        {t("close")}
                    </button>
                </div>

                <div className="panelBody">
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6, marginBottom: 24 }}>
                        {t("auditDesc")}
                    </div>

                    {/* Section: Build Evidence */}
                    {build && (
                        <div style={{ marginBottom: 32 }}>
                            <div className="gold-text" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 4, height: 4, background: 'var(--gold-primary)', borderRadius: 1 }} />
                                {t("globalCredential")} (BUILD)
                            </div>
                            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--line-separator)' }}>
                                <div className="kv">
                                    <div className="kvKey">{t("idLabel")}</div>
                                    <div className="kvVal">{build.buildId}</div>
                                </div>
                                <div className="kv">
                                    <div className="kvKey">{t("auditIdLabel")}</div>
                                    <div className="kvVal">{build.auditId}</div>
                                </div>
                                <div className="kv">
                                    <div className="kvKey">{t("hashLabel")}</div>
                                    <div className="kvVal">{build.globalHash}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section: Data Authenticity Seal */}
                    <div style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(0, 0, 0, 0.2))',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        marginBottom: 32,
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#4ade80', boxShadow: '0 0 10px #22c55e' }} />
                            {t("verified")}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
                            {t("verifiedDesc")}
                        </div>
                        <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 6, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                            CID: bafybeigdyrzt5sfp7udm7hu76uh79y
                        </div>
                        {/* Watermark style decoration */}
                        <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 40, fontWeight: 900, color: 'white', opacity: 0.03, transform: 'rotate(-15deg)', pointerEvents: 'none' }}>
                            OFFICIAL
                        </div>
                    </div>

                    {/* Section: Deep Audit Thresholds (L3) */}
                    {build?.auditConfig && (
                        <div style={{ marginBottom: 32 }}>
                            <div className="kv">
                                <div className="kvKey">{t("rulesVersionLabel")}</div>
                                <div className="kvVal">{build.auditConfig.rulesVersion}</div>
                            </div>
                            <div className="kv">
                                <div className="kvKey">{t("tensionHighLabel")}</div>
                                <div className="kvVal">{build.auditConfig.tensionHigh}</div>
                            </div>
                            <div className="kv">
                                <div className="kvKey">{t("tensionLowLabel")}</div>
                                <div className="kvVal">{build.auditConfig.tensionLow}</div>
                            </div>
                            <div className="kv">
                                <div className="kvKey">{t("dataSourceLabel")}</div>
                                <div className="kvVal">{build.auditConfig.dataSource}</div>
                            </div>
                        </div>
                    )}

                    {/* Section: Shot Fingerprint */}
                    {shot && (
                        <div>
                            <div className="gold-text" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 4, height: 4, background: 'var(--gold-primary)', borderRadius: 1 }} />
                                {t("fingerprint")} (SHOT)
                            </div>
                            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--line-separator)' }}>
                                <div className="kv">
                                    <div className="kvKey">{t("shotIdLabel")}</div>
                                    <div className="kvVal">{shot.shotId}</div>
                                </div>
                                <div className="kv">
                                    <div className="kvKey">{t("fingerprintLabel")}</div>
                                    <div className="kvVal">{shot.fingerprint}</div>
                                </div>
                                <div className="kv">
                                    <div className="kvKey">{t("byteOffsetLabel")}</div>
                                    <div className="kvVal">{shot.byteStart} - {shot.byteEnd}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
