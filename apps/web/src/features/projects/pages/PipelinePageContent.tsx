'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pipelineApi } from '@/lib/apiClient';

type Node = {
    nodeId: string;
    type: string;
    refId: string;
    index?: number;
    title: string;
    canGenerate?: boolean;
    qaStatus?: string;
    blockingReason?: string | null;
    lastJob?: {
        id: string;
        status?: string;
        type?: string;
        engineKey?: string;
        createdAt?: string;
    } | null;
    children?: Node[];
};

function badge(status?: string) {
    const s = (status || '').toUpperCase();
    const cls =
        s === 'PASS'
            ? 'bg-green-100 text-green-800 border-green-200'
            : s === 'WARN'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                : s === 'FAIL'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : s === 'PENDING'
                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : s === 'FORCED_PASS'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : s === 'SKIPPED'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200';

    const label = s || '-';
    return <span className={`px-2 py-0.5 text-[11px] rounded border ${cls}`}>{label}</span>;
}

function flatten(root?: Node | null): Node[] {
    if (!root) return [];
    const out: Node[] = [];
    const walk = (n: Node) => {
        out.push(n);
        (n.children || []).forEach(walk);
    };
    walk(root);
    return out;
}

export function PipelinePageContent() {
    const params = useParams<{ projectId: string; locale?: string }>();
    const router = useRouter();
    const projectId = params.projectId;
    const locale = params.locale ?? 'en';

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [root, setRoot] = useState<Node | null>(null);
    const [reason, setReason] = useState('');
    const [busyNodeId, setBusyNodeId] = useState<string>('');

    async function refresh() {
        setErr('');
        setLoading(true);
        try {
            const data = await pipelineApi.getPipeline(projectId);
            setRoot((data as any).data || data);
        } catch (e: any) {
            setErr(e?.message || '加载失败');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, [projectId]);

    const rows = useMemo(() => flatten(root), [root]);

    async function act(kind: 'retry' | 'skip' | 'force', nodeId: string) {
        setErr('');
        if ((kind === 'skip' || kind === 'force') && reason.trim().length < 3) {
            setErr('Skip / ForcePass 必须填写原因（≥3字符）');
            return;
        }
        setBusyNodeId(nodeId);
        try {
            if (kind === 'retry') await pipelineApi.retryNode(projectId, nodeId, reason || undefined);
            else if (kind === 'skip') await pipelineApi.skipNode(projectId, nodeId, reason.trim());
            else if (kind === 'force') await pipelineApi.forcePassNode(projectId, nodeId, reason.trim());
            await refresh();
        } catch (e: any) {
            setErr(e?.message || '操作失败');
        } finally {
            setBusyNodeId('');
        }
    }

    return (
        <div className="p-6 space-y-5 bg-[#020617] min-h-screen text-white">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-semibold">Pipeline 控制面</h1>
                    <div className="text-sm text-gray-400">Gate 可解释 / Retry / Skip / ForcePass（所有操作写入审计）</div>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 rounded-md border border-gray-700 hover:bg-gray-800" onClick={() => refresh()}>手动刷新</button>
                    <button className="px-3 py-2 rounded-md border border-gray-700 hover:bg-gray-800" onClick={() => router.push(`/${locale}/tasks?projectId=${encodeURIComponent(projectId)}`)}>打开 Tasks</button>
                </div>
            </div>
            <div className="rounded-xl border border-gray-700 p-4 space-y-2 bg-[#0b1120]">
                <div className="text-sm font-medium">操作原因（Skip / ForcePass 必填）</div>
                <input className="w-full border border-gray-700 bg-transparent rounded-md px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="原因..." />
            </div>
            {err && <div className="text-sm text-red-400">{err}</div>}
            <div className="rounded-xl border border-gray-700 overflow-hidden bg-[#0b1120]">
                <table className="w-full text-sm">
                    <thead className="bg-[#1f2937]">
                        <tr>
                            <th className="text-left p-3">Type</th>
                            <th className="text-left p-3">Title</th>
                            <th className="text-left p-3">Gate</th>
                            <th className="text-left p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((n) => (
                            <tr key={n.nodeId} className="border-t border-gray-700">
                                <td className="p-3 font-mono text-xs">{n.type}</td>
                                <td className="p-3">{n.title}</td>
                                <td className="p-3">{badge(n.qaStatus)}</td>
                                <td className="p-3 flex gap-2">
                                    <button className="px-2 py-1 rounded bg-blue-600 text-xs" onClick={() => act('retry', n.nodeId)} disabled={busyNodeId === n.nodeId}>Retry</button>
                                    <button className="px-2 py-1 rounded bg-yellow-600 text-xs" onClick={() => act('skip', n.nodeId)} disabled={busyNodeId === n.nodeId}>Skip</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
