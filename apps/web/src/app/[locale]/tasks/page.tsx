'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, getWorkerMonitorStats, getOrchestratorMonitorStats } from '@/lib/apiClient';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { JobDTO, WorkerStatsDTO, OrchestratorStatsDTO } from '@/types/dto';

type StatCard = { label: string; value: string };

function formatNum(n: unknown): string {
    const v = typeof n === 'number' ? n : Number(n);
    if (Number.isFinite(v)) return String(v);
    return '-';
}


function withTimeoutController<T>(ms: number, factory: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), ms);
    const promise = factory(controller.signal).finally(() => window.clearTimeout(t));
    return { promise, controller };
}

export default function TasksPage() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string>('');
    const [jobs, setJobs] = useState<JobDTO[]>([]);
    const [total, setTotal] = useState<number>(0);

    // Filters
    const [status, setStatus] = useState<string>('RUNNING');
    const [type, setType] = useState<string>('ALL');
    const [engineKey, setEngineKey] = useState<string>('');
    const [projectId, setProjectId] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const pageSize = 20;

    // Monitor
    const [workerStats, setWorkerStats] = useState<WorkerStatsDTO | null>(null);
    const [orchStats, setOrchStats] = useState<OrchestratorStatsDTO | null>(null);

    // 防 429：最小化轮询 + 退避
    const [pollMs, setPollMs] = useState<number>(8000);

    // Refs for robust polling
    const inFlightRef = useRef(false);
    const activeAbortRef = useRef<AbortController | null>(null);
    const pendingRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const visibleRef = useRef(true);

    const cards: StatCard[] = useMemo(() => {
        // 这里做“弱依赖”的抽取：不假设后端字段名完全一致
        const w = workerStats || {};
        const o = orchStats || {};

        const wActive = w.activeWorkers ?? w.workers ?? w.active ?? null;

        const qDepth = o.queueDepth ?? o.pending ?? o.queue ?? null;

        const running = jobs.filter((j) => j.status === 'RUNNING').length;

        const failed = jobs.filter((j) => j.status === 'FAILED').length;

        return [
            { label: 'Jobs(当前页)', value: formatNum(jobs.length) },
            { label: 'Total(筛选后)', value: formatNum(total) },
            { label: 'RUNNING(当前页)', value: formatNum(running) },
            { label: 'FAILED(当前页)', value: formatNum(failed) },
            { label: 'Active Workers', value: formatNum(wActive) },
            { label: 'Queue Depth', value: formatNum(qDepth) },
        ];
    }, [jobs, total, workerStats, orchStats]);

    async function loadOnce() {
        if (inFlightRef.current) {
            // 有新筛选/分页触发时：立即中断当前请求，等待 finally 自动补跑最新一次
            pendingRef.current = true;
            activeAbortRef.current?.abort();
            return;
        }
        if (typeof document !== 'undefined' && document.hidden) return;

        inFlightRef.current = true;
        setErr('');
        try {
            activeAbortRef.current?.abort();
            const { promise, controller } = withTimeoutController(15000, (signal) =>
                Promise.all([
                    getWorkerMonitorStats(signal).catch((e) => {
                        console.warn('workerStats failed', e);
                        return null;
                    }),
                    getOrchestratorMonitorStats(signal).catch((e) => {
                        console.warn('orchestratorStats failed', e);
                        return null;
                    }),
                    apiClient.jobs.listJobs({
                        status,
                        type,
                        engineKey: engineKey || undefined,
                        projectId: projectId || undefined,
                        page,
                        pageSize,
                        signal,
                    }),
                ])
            );
            activeAbortRef.current = controller;
            const [w, o, r] = await promise;

            setWorkerStats(w);
            setOrchStats(o);
            setJobs(r.jobs || []);
            setTotal(r.total || 0);

            // 成功后恢复常规轮询
            setPollMs(8000);
        } catch (e: unknown) {
            const errObj = e as { name?: string; message?: string };
            const msg = errObj?.name === 'AbortError'
                ? '请求超时（已自动取消），请稍后重试'
                : (errObj?.message ? String(errObj?.message) : '加载失败');
            setErr(msg);

            if (msg.includes('429') || msg.includes('Too Many Requests')) {
                setPollMs((prev) => Math.min(prev * 2, 60000));
            }
        } finally {
            inFlightRef.current = false;
            activeAbortRef.current = null;
            setLoading(false);

            if (pendingRef.current) {
                pendingRef.current = false;
                // 立刻补跑一次，确保拿到“最新筛选条件”的数据
                queueMicrotask(() => loadOnce());
            }
        }
    }

    useEffect(() => {
        const onVisibility = () => {
            visibleRef.current = !document.hidden;
            if (visibleRef.current) loadOnce(); // 回到前台立即刷新一次
        };

        document.addEventListener('visibilitychange', onVisibility);

        // 先跑一次（filters/page 变化也会触发该 effect）
        loadOnce();

        // 清理旧定时器
        if (timerRef.current) window.clearInterval(timerRef.current);

        // 轮询：仅在可见时触发，且 loadOnce 内部单飞
        timerRef.current = window.setInterval(() => {
            if (!document.hidden) loadOnce();
        }, pollMs);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pollMs, status, type, engineKey, projectId, page]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-semibold">Tasks Dashboard</h1>
                    <div className="text-sm text-muted-foreground">监控 Jobs / Worker / Orchestrator，支持筛选与分页（含 429 退避）。</div>
                </div>
                <button
                    className="px-3 py-2 rounded-md border hover:bg-accent"
                    onClick={() => loadOnce()}
                >
                    手动刷新
                </button>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {cards.map((c) => (
                    <div key={c.label} className="rounded-xl border p-3">
                        <div className="text-xs text-muted-foreground">{c.label}</div>
                        <div className="text-lg font-semibold">{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="rounded-xl border p-4 space-y-3">
                <div className="font-medium">筛选</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <label className="space-y-1">
                        <div className="text-xs text-muted-foreground">Status</div>
                        <select className="w-full border rounded-md px-2 py-2" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
                            <option value="RUNNING">RUNNING</option>
                            <option value="PENDING">PENDING</option>
                            <option value="FAILED">FAILED</option>
                            <option value="SUCCEEDED">SUCCEEDED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="ALL">ALL</option>
                        </select>
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-muted-foreground">Type</div>
                        <select className="w-full border rounded-md px-2 py-2" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
                            <option value="ALL">ALL</option>
                            <option value="IMAGE">IMAGE</option>
                            <option value="VIDEO">VIDEO</option>
                            <option value="STORYBOARD">STORYBOARD</option>
                            <option value="AUDIO">AUDIO</option>
                            <option value="NOVEL_ANALYZE_CHAPTER">NOVEL_ANALYZE_CHAPTER</option>
                        </select>
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-muted-foreground">Engine Key</div>
                        <input className="w-full border rounded-md px-2 py-2" value={engineKey} onChange={(e) => { setPage(1); setEngineKey(e.target.value); }} placeholder="例如: CE06" />
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-muted-foreground">Project ID</div>
                        <input className="w-full border rounded-md px-2 py-2" value={projectId} onChange={(e) => { setPage(1); setProjectId(e.target.value); }} placeholder="可选" />
                    </label>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                    <div className="font-medium">Jobs</div>
                    <div className="text-sm text-muted-foreground">
                        轮询间隔：{Math.round(pollMs / 1000)}s
                    </div>
                </div>

                {err ? (
                    <div className="p-4 text-sm text-red-600">{err}</div>
                ) : null}

                {loading ? (
                    <div className="p-4 text-sm text-muted-foreground">加载中…</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-3">ID</th>
                                    <th className="text-left p-3">Type</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Engine</th>
                                    <th className="text-left p-3">Project</th>
                                    <th className="text-left p-3">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((j) => {
                                    return (
                                        <tr key={j.id} className="border-t">
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 font-mono text-xs">
                                                {j.id.slice(0, 8)}
                                            </td>
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                                                {j.type}
                                            </td>
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                                                <StatusBadge status={j.status} />
                                            </td>
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-sm text-muted-foreground">
                                                {j.engineKey || '-'}
                                            </td>
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 font-mono text-xs">
                                                {j.projectId || '-'}
                                            </td>
                                            <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-sm text-muted-foreground">
                                                {j.createdAt ? new Date(j.createdAt).toLocaleString() : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {jobs.length === 0 ? (
                                    <tr>
                                        <td className="p-4 text-sm text-muted-foreground" colSpan={6}>无数据</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="p-4 flex items-center justify-between border-t">
                    <div className="text-sm text-muted-foreground">
                        Page {page} / {Math.max(1, Math.ceil(total / pageSize))}
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded-md border disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            上一页
                        </button>
                        <button
                            className="px-3 py-2 rounded-md border disabled:opacity-50"
                            disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
