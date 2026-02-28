// apps/web/src/features/studio/components/ScriptTreePanel.tsx
"use client";

import React from "react";
import { ScriptNode } from "../types";
import { dict } from "../../../i18n/dict";
import { useStudioUiStore } from "../state/studioUiStore";

type TTable = typeof dict["zh"];
type TFunc = <K extends keyof TTable>(key: K, vars?: Record<string, string | number>) => string;

export type ScriptTreePanelProps = {
    tree: ScriptNode[];
    onSelectShot: (shotId: string) => void;
    onSelectScene: (sceneId: string) => void;
    t: TFunc;
    q: string;
    onQChange: (val: string) => void;
};

export function ScriptTreePanel({
    tree,
    onSelectScene,
    onSelectShot,
    t,
    q,
    onQChange
}: ScriptTreePanelProps) {

    const expandedIds = useStudioUiStore(s => s.expandedNodeIds);
    const selectedId = useStudioUiStore(s => s.selectedNodeId);
    const activeNodeId = useStudioUiStore(s => s.activeNodeId);  // P6.4
    const toggleExpand = useStudioUiStore(s => s.toggleExpanded);
    const setExpanded = useStudioUiStore(s => s.setExpanded);
    const markInteracted = useStudioUiStore(s => s.markInteracted);
    const setActiveShot = useStudioUiStore(s => s.setActiveShot);
    const setActiveNode = useStudioUiStore(s => s.setActiveNode);  // P6.4

    const renderNode = (n: ScriptNode, depth: number) => {
        const isEpisode = n.type === "episode";
        const isScene = n.type === "scene";
        const isShot = n.type === "shot";

        const children = "children" in n ? n.children : [];
        const isExpanded = !!expandedIds[n.id];

        // 深度搜索匹配逻辑
        const hasMatch = (node: ScriptNode): boolean => {
            const query = q.trim().toLowerCase();
            if ((node.title || "").toLowerCase().includes(query)) return true;
            if ((node.summary || "").toLowerCase().includes(query)) return true;
            if ("children" in node && node.children) {
                return node.children.some(c => hasMatch(c));
            }
            return false;
        };

        if (q.trim() !== "" && !hasMatch(n)) {
            return null;
        }

        const label = isEpisode
            ? t("episode", { n: String(n.index).padStart(2, "0") })
            : t("scene", { n: String(n.index).padStart(2, "0") });

        const forceExpand = q.trim() !== "" && hasMatch(n);

        const handleNodeClick = () => {
            markInteracted();
            if (isEpisode) {
                toggleExpand(n.id);
                setActiveNode(n.id, 'outline');  // P6.4: Episode 点击 → activeNodeId
            } else if (isScene) {
                setExpanded([n.id]);
                setActiveNode(n.id, 'outline');  // P6.4: Scene 点击 → activeNodeId
                if (children.length > 0 && children[0].id) {
                    // P6.2.3: Scene 直达 Shot → 同步曲线激活点（setActiveShot 内联 activeNodeId=shotId）
                    setActiveShot(children[0].id, 'outline');
                    onSelectShot(children[0].id);
                } else {
                    onSelectScene(n.id);
                }
            } else if (isShot) {
                // P6.2.3: Shot 点击 → 同步曲线激活点
                setActiveShot(n.id, 'outline');
                onSelectShot(n.id);
            }
        };

        // P6.4: 常驻激活态 — 左侧金色高亮线 + 背景轻提亮
        const isActiveNode = n.id === activeNodeId;

        return (
            <div key={n.id} className="treeGroup">
                <div
                    className={`treeItem ${(n.id === selectedId || isActiveNode) ? "treeItemActive" : ""}`}
                    style={{
                        paddingLeft: 12 + depth * 16,
                        // P6.4: 常驻高亮：激活节点左侧金色竖线
                        borderLeft: isActiveNode ? '2px solid var(--gold-weak)' : '2px solid transparent',
                        background: isActiveNode ? 'var(--gold-tint-05)' : undefined,
                        transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onClick={handleNodeClick}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(isEpisode || isScene) && (
                            <span style={{
                                fontSize: 10,
                                opacity: 0.5,
                                transform: (isExpanded || forceExpand) ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.2s',
                                visibility: children.length === 0 ? 'hidden' : 'visible'
                            }}>▶</span>
                        )}
                        {!isShot && <div className="treeMeta">{label}</div>}
                        <div className="treeTitle" style={{ fontWeight: isEpisode ? 600 : 400 }}>
                            {n.title || n.summary?.slice(0, 20)}
                            {isShot && <span style={{ opacity: 0.5, fontSize: '0.9em', marginLeft: 6 }}>Shot {String(n.index).padStart(2, "0")}</span>}
                        </div>
                    </div>
                </div>

                {(isEpisode || isScene) && (isExpanded || forceExpand) && (
                    <div className="treeChildren">
                        {children.map((c) => renderNode(c, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="card studio-panel" style={{ height: 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panelHeader">
                <div className="panelTitle">{t("outline")}</div>
            </div>
            <div className="panelBody scroll-thin" style={{ flex: 1, overflowY: 'auto' }}>
                <input
                    className="searchInput"
                    placeholder="搜索分镜..."
                    value={q}
                    onChange={(e) => onQChange(e.target.value)}
                />
                <div style={{ height: 16 }} />
                <div className="treeList">
                    {tree.map((n) => renderNode(n, 0))}
                </div>
            </div>
        </div>
    );
}
