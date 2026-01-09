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

function withTimeout<T>(ms: number, factory: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), ms);
  return factory(controller.signal).finally(() => window.clearTimeout(t));
}

export default function PipelinePage() {
  // 显式定义参数类型，移除 as any
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
      const data = await withTimeout(15000, (signal) => pipelineApi.getPipeline(projectId, signal));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRoot((data as any).data || data);
    } catch (e: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg =
        e?.name === 'AbortError'
          ? '请求超时（已自动取消），请稍后重试'
          : e?.message
            ? String(e.message)
            : '加载失败';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      let actionPromise: Promise<unknown>;
      if (kind === 'retry') {
        actionPromise = withTimeout(15000, (signal) =>
          pipelineApi.retryNode(projectId, nodeId, reason || undefined, signal)
        );
      } else if (kind === 'skip') {
        actionPromise = withTimeout(15000, (signal) =>
          pipelineApi.skipNode(projectId, nodeId, reason.trim(), signal)
        );
      } else if (kind === 'force') {
        actionPromise = withTimeout(15000, (signal) =>
          pipelineApi.forcePassNode(projectId, nodeId, reason.trim(), signal)
        );
      } else {
        throw new Error('Unknown action kind');
      }
      await actionPromise;
      await refresh();
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      const msg =
        err?.name === 'AbortError'
          ? '请求超时（已自动取消），请稍后重试'
          : err?.message
            ? String(err.message)
            : '操作失败';
      setErr(msg);
    } finally {
      setBusyNodeId('');
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline 控制面</h1>
          <div className="text-sm text-muted-foreground">
            Gate 可解释 / Retry / Skip / ForcePass（所有操作写入审计）
          </div>
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-md border hover:bg-accent" onClick={() => refresh()}>
            手动刷新
          </button>
          <button
            className="px-3 py-2 rounded-md border hover:bg-accent"
            onClick={() =>
              router.push(`/${locale}/tasks?projectId=${encodeURIComponent(projectId)}`)
            }
          >
            打开 Tasks（带 projectId）
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-medium">操作原因（Skip / ForcePass 必填）</div>
        <input
          className="w-full border rounded-md px-3 py-2"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：误判；已人工确认；允许继续生成（将写入审计）"
        />
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <div className="rounded-xl border overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="font-medium">Nodes</div>
          <div className="text-sm text-muted-foreground">仅手动刷新（避免轮询打爆后端）</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Gate</th>
                  <th className="text-left p-3">Blocking</th>
                  <th className="text-left p-3">Last Job</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.nodeId} className="border-t">
                    <td className="p-3 font-mono text-xs">{n.type}</td>
                    <td className="p-3">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{n.nodeId}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {badge(n.qaStatus)}
                        <span className="text-[11px] text-muted-foreground">
                          canGenerate: {String(n.canGenerate ?? '-')}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-red-600">
                      {n.blockingReason ? (
                        n.blockingReason
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {n.lastJob ? (
                        <div className="space-y-1">
                          <div className="font-mono">{n.lastJob.id}</div>
                          <div className="text-muted-foreground">
                            {n.lastJob.status || '-'} / {n.lastJob.type || '-'} /{' '}
                            {n.lastJob.engineKey || '-'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-2 py-1 rounded-md border hover:bg-accent disabled:opacity-50"
                          disabled={busyNodeId === n.nodeId}
                          onClick={() => act('retry', n.nodeId)}
                        >
                          Retry
                        </button>
                        <button
                          className="px-2 py-1 rounded-md border hover:bg-accent disabled:opacity-50"
                          disabled={busyNodeId === n.nodeId}
                          onClick={() => act('skip', n.nodeId)}
                        >
                          Skip
                        </button>
                        <button
                          className="px-2 py-1 rounded-md border hover:bg-accent disabled:opacity-50"
                          disabled={busyNodeId === n.nodeId}
                          onClick={() => act('force', n.nodeId)}
                        >
                          ForcePass
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="p-4 text-sm text-muted-foreground" colSpan={6}>
                      无数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
