// apps/web/src/features/studio/components/ScriptTreePanel.tsx
"use client";

import React from "react";
import { ScriptNode } from "../types";

export function ScriptTreePanel(props: {
    tree: ScriptNode[];
    onSelectShot: (shotId: string) => void;
    selectedId?: string;
}) {
    const [q, setQ] = React.useState("");
    const activeShot = props.selectedId || null;

    // 简化：渲染为“可读树”，不展示 UUID
    const renderNode = (n: ScriptNode, depth: number) => {
        const pad = 10 + depth * 12;

        if (n.type === "shot") {
            const hit = q.trim() === "" ? true : (n.title + (n.summary || "")).includes(q.trim());
            if (!hit) return null;

            return (
                <div
                    key={n.id}
                    className={`treeNode shotNode ${activeShot === n.id ? 'active' : ''}`}
                    style={{ paddingLeft: depth * 16 }}
                    onClick={() => props.onSelectShot(n.id)}
                >
                    <span className="dot" />
                    <span className="nodeTitle">{n.title}</span>
                </div>
            );
        }

        const children = "children" in n ? n.children : [];
        const title = n.title || (n.summary ? n.summary.slice(0, 26) : `${n.type}`);
        const label = n.type === "episode" ? `第 ${String(n.index).padStart(2, "0")} 集` : `第 ${String(n.index).padStart(2, "0")} 场`;

        return (
            <div key={n.id}>
                <div className="treeItem" style={{ paddingLeft: pad }}>
                    <div className="treeMeta">{label}</div>
                    <div className="treeTitle">{title}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {children.map((c) => renderNode(c, depth + 1))}
                </div>
            </div>
        );
    };

    return (
        <div className="card" style={{ height: 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panelHeader">
                <div className="panelTitle">剧情大纲</div>
                <div className="pill">黑金 Studio</div>
            </div>
            <div className="panelBody" style={{ flex: 1, overflowY: 'auto' }}>
                <input
                    className="searchInput"
                    placeholder="搜索剧情/人物/冲突…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div style={{ height: 16 }} />
                <div className="treeList">
                    {props.tree.map((n) => renderNode(n, 0))}
                </div>
            </div>
        </div>
    );
}
