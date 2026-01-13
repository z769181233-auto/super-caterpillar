'use client';

import React, { useState, useEffect } from 'react';

// --- Types ---

interface EngineChainStep {
    name: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    cost?: string;
    time?: string;
}

interface RunData {
    runId: string;
    traceId: string;
    engineChain: EngineChainStep[];
    totalCost: string;
    previewUrl: string;
    evidencePath: string;
    status: 'DONE' | 'FAILED' | 'QUEUED' | 'EXEC';
    timestamp: string;
}

// --- Dynamic Data Fetcher (Simulated for P3-3, connecting to real endpoints in future) ---
// In a real app, this would use swr or react-query against /api/commercial/runs
const fetchLatestCommercialRun = async (): Promise<RunData | null> => {
    // Simulating fetch delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Returning the Known Golden Sample (In a real app, this comes from DB)
    return {
        runId: 'f60522dc-3492-4a78-b868-054f545153fd',
        traceId: 'trace_7bfd4735d1354c08',
        status: 'DONE',
        timestamp: '2026-01-13 15:32:10',
        totalCost: '0.045 Credits',
        previewUrl: 'previews/proj_seed_1768293088_14292/scene_seed_1768293088_14292/f60522dc-3492-4a78-b868-054f545153fd_preview.mp4',
        evidencePath: 'docs/_evidence/GATE_PHASE3_E2E_1768293087',
        engineChain: [
            { name: 'workflow_ce_dag', status: 'SUCCESS', time: '120ms' },
            { name: 'ce06_novel_parsing', status: 'SUCCESS', cost: '0.01', time: '500ms' },
            { name: 'ce03_visual_density', status: 'SUCCESS', cost: '0.02', time: '340ms' },
            { name: 'ce04_visual_enrichment', status: 'SUCCESS', cost: '0.01', time: '410ms' },
            { name: 'shot_render', status: 'SUCCESS', cost: '0.005', time: '2.1s' },
            { name: 'ce10_timeline_compose', status: 'SUCCESS', time: '100ms' },
            { name: 'ce11_timeline_preview', status: 'SUCCESS', time: '1.5s' },
        ]
    };
};

const fetchMetrics = async () => {
    // Try to fetch from real metrics endpoint, fall back to "Unavailable"
    try {
        const res = await fetch('/api/metrics'); // Assuming proxy or endpoint exists
        if (res.ok) return await res.json();
    } catch (e) {
        return null;
    }
    return null;
};

// --- Components ---

const CommercialReadyBadge = () => (
    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
        COMMERCIAL-READY
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        DONE: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800',
        QUEUED: 'bg-gray-100 text-gray-800',
        EXEC: 'bg-blue-100 text-blue-800',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
};

const RunCard = ({ run }: { run: RunData }) => {
    const [copied, setCopied] = useState(false);

    const copyTrace = () => {
        navigator.clipboard.writeText(run.traceId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Construct secure preview URL (assuming standard static asset path or proxy)
    // For local demo/seal, we assume the path is relative to public or hosted
    const videoUrl = `/${run.previewUrl}`;

    return (
        <div className="bg-white shadow rounded-lg p-6 mb-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center space-x-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">Run ID: {run.runId}</h3>
                        <CommercialReadyBadge />
                    </div>
                    <p className="text-sm text-gray-500 font-mono">Trace: {run.traceId}</p>
                </div>
                <div className="text-right">
                    <StatusBadge status={run.status} />
                    <p className="text-xs text-gray-400 mt-1">{run.timestamp}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Engine Chain Execution</h4>
                    <div className="space-y-2">
                        {run.engineChain.map((step, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                                <div className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${step.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="font-medium text-gray-700">{step.name}</span>
                                </div>
                                <div className="flex items-center space-x-4 text-gray-500 text-xs">
                                    {step.cost && <span>{step.cost} Credits</span>}
                                    <span>{step.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Commercial Summary</h4>
                    <div className="bg-gray-50 rounded p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Cost</span>
                            <span className="font-bold text-gray-900">{run.totalCost}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Assets Generated</span>
                            <span className="font-medium">1 Video, 4 Meta</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Audience</span>
                            <span className="font-medium">Commercial V1</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Evidence</span>
                            <span className="font-mono text-xs overflow-hidden text-ellipsis w-48 block" title={run.evidencePath}>{run.evidencePath}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                        <div className="aspect-video bg-black rounded overflow-hidden">
                            <video controls className="w-full h-full object-contain">
                                <source src={videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex space-x-3 border-t pt-4">
                {/* Invoice Button Hidden per Commercial Req */}
                {/* <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Download Invoice</button> */}

                <a
                    href={`/studio/audit?traceId=${run.traceId}`}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 decoration-0 inline-block"
                >
                    View Audit Logs
                </a>

                <button
                    onClick={copyTrace}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 min-w-[120px]"
                >
                    {copied ? 'Copied!' : 'Copy Trace ID'}
                </button>
            </div>
        </div>
    );
};

const ObservabilityPanel = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics().then(data => {
            setMetrics(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="p-4 bg-white rounded border animate-pulse h-32 mb-8">Loading Metrics...</div>;

    // Render "Unavailable" if no backend metrics endpoint is reachable (which is expected for P3-3 UI-only scope)
    if (!metrics) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200 opacity-70">
                    <div className="text-sm text-gray-500 mb-1">API Metrics</div>
                    <div className="text-sm font-bold text-gray-400">Unavailable (Read-only)</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200 opacity-70">
                    <div className="text-sm text-gray-500 mb-1">System Latency</div>
                    <div className="text-sm font-bold text-gray-400">Unavailable (Read-only)</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200 opacity-70">
                    <div className="text-sm text-gray-500 mb-1">Error Rate</div>
                    <div className="text-sm font-bold text-gray-400">Unavailable (Read-only)</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200 opacity-70">
                    <div className="text-sm text-gray-500 mb-1">Active Workers</div>
                    <div className="text-sm font-bold text-gray-400">Unavailable (Read-only)</div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Real metrics rendering would go here */}
        </div>
    );
};

// --- Page ---

export default function CommercialClosurePage() {
    const [run, setRun] = useState<RunData | null>(null);

    useEffect(() => {
        fetchLatestCommercialRun().then(setRun);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Studio Commercial Center</h1>
                    <p className="text-gray-600">Phase 4 Commercial Closure • Operations & Billing • Hard Sealed</p>
                </header>

                <section>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">System Observability (Read-Only)</h2>
                    <ObservabilityPanel />
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Runs (Golden Sample)</h2>
                    {run ? <RunCard run={run} /> : <div className="p-8 text-center text-gray-500">Loading Run Data...</div>}
                </section>
            </div>
        </div>
    );
}
