'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function AuditPage() {
    const { novelSourceId } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!novelSourceId) return;

        const fetchData = async () => {
            try {
                // S3-P1B: Using the hardened aggregated full audit API
                const res = await fetch(`/api/audit/novel/${novelSourceId}/full`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [novelSourceId]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white">
            <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 border-4 border-t-purple-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-medium tracking-widest text-gray-400">LOADING AUDIT SNAPSHOT</div>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white p-8">
            <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl max-w-md w-full">
                <div className="text-red-400 font-bold mb-2">CRITICAL_AUDIT_ERROR</div>
                <div className="text-sm text-red-200/80">{error}</div>
                <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold uppercase tracking-widest bg-red-500 hover:bg-red-400 transition-colors px-4 py-2 rounded">Retry Sync</button>
            </div>
        </div>
    );

    const { metrics, latestJobs, director, dag } = data;

    return (
        <div className="p-4 md:p-8 space-y-8 bg-[#0a0a0c] min-h-screen text-white/90 selection:bg-purple-500/30">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="text-xs font-bold text-purple-400 uppercase tracking-[0.2em] mb-1">Commercial-Grade Visibility</div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-blue-200 to-purple-400 bg-clip-text text-transparent">
                        Web Audit Terminal
                    </h1>
                </div>
                <div className="flex gap-4 text-[10px] font-mono text-gray-500 uppercase">
                    <div className="bg-white/5 px-2 py-1 rounded">SID: {novelSourceId}</div>
                    <div className="bg-white/5 px-2 py-1 rounded">PID: {data.projectId}</div>
                </div>
            </div>

            {/* Stage 1: Overview Score Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 bg-gradient-to-br from-purple-900/40 to-blue-900/40 p-6 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col justify-between">
                    <div>
                        <div className="text-xs font-bold text-white/40 uppercase mb-4">Core Quality Index</div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="text-3xl font-black text-white">{metrics.ce03Score.toFixed(1)}</div>
                                <div className="text-[10px] font-bold text-blue-400 uppercase">CE03 Visual Density</div>
                            </div>
                            <div>
                                <div className="text-3xl font-black text-white">{metrics.ce04Score.toFixed(1)}</div>
                                <div className="text-[10px] font-bold text-purple-400 uppercase">CE04 Enrichment</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="text-[10px] text-gray-500 font-mono">TRACE_ID: {dag.traceId}</div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${dag.missingPhases.length === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {dag.missingPhases.length === 0 ? 'COMPLETE_PIPELINE' : 'FRAGMENTED_DATA'}
                        </div>
                    </div>
                </div>

                {/* Director Solver Summary */}
                <div className={`p-6 rounded-2xl border ${director.isValid ? 'bg-green-950/10 border-green-500/20' : 'bg-orange-950/10 border-orange-500/20'} backdrop-blur-md`}>
                    <div className="text-xs font-bold text-white/40 uppercase mb-4">Director Solver (V1)</div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className={`w-3 h-3 rounded-full ${director.isValid ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                        <div className="font-bold text-sm tracking-wide">{director.isValid ? 'STANDARDS_MET' : 'VIOLATIONS_FOUND'}</div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Violations:</span>
                            <span className={`font-mono ${director.violationsCount > 0 ? 'text-orange-400' : 'text-gray-400'}`}>{director.violationsCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Suggestions:</span>
                            <span className="font-mono text-blue-400">{director.suggestionsCount}</span>
                        </div>
                    </div>
                </div>

                {/* DAG Health Pulse */}
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="text-xs font-bold text-white/40 uppercase mb-4">Pipeline Health</div>
                    <div className="text-3xl font-black mb-2">{(100 - (dag.missingPhases.length / 3) * 100).toFixed(0)}%</div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full" style={{ width: `${(100 - (dag.missingPhases.length / 3) * 100)}%` }}></div>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                        Latency: Minimal
                    </div>
                </div>
            </div>

            {/* Stage 2: DAG Pipeline Timeline */}
            <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold flex items-center gap-2 italic">
                        <span className="w-1.5 h-6 bg-blue-500 skew-x-[-15deg]"></span>
                        DAG_WORKFLOW_TIMELINE
                    </h2>
                    <div className="text-[10px] font-mono text-gray-600">SOURCE: {dag.builtFrom}</div>
                </div>

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-0 px-4">
                    {/* Background Line */}
                    <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2 z-0"></div>

                    {dag.timeline.map((phase: any, idx: number) => (
                        <div key={phase.phase} className="relative z-10 flex flex-col items-center group">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 mb-3 bg-[#0a0a0c] transition-all duration-300 ${phase.status === 'SUCCEEDED' ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : (phase.status === 'MISSING' ? 'border-red-500/50 grayscale' : 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]')}`}>
                                {phase.status === 'SUCCEEDED' ? '✓' : idx + 1}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1">{phase.phase}</div>
                            <div className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${phase.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                                {phase.status}
                            </div>
                            <div className="absolute top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 p-2 rounded text-[8px] font-mono whitespace-nowrap z-20 pointer-events-none">
                                JOB_ID: {phase.jobId}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Director Violations Panel */}
                <section className="lg:col-span-2 bg-white/[0.02] p-8 rounded-2xl border border-white/10 h-[500px] flex flex-col">
                    <h2 className="text-lg font-bold mb-6 border-b border-white/5 pb-4 flex items-center gap-2">
                        <span className="text-orange-400">⚡</span> Violation & Optimization Audit
                        <span className="ml-auto text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-gray-400 uppercase">Real-time Check (50 Shots)</span>
                    </h2>
                    <div className="flex-1 overflow-auto space-y-4 pr-4 custom-scrollbar">
                        {director.violationsCount === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <div className="text-4xl mb-4">✨</div>
                                <div className="text-sm font-bold uppercase tracking-widest">No Violations Found</div>
                                <div className="text-[10px] mt-2 italic px-8 text-center">Cinematographic standards are being respected by current generation.</div>
                            </div>
                        ) : (
                            director.violationsSample.map((v: any, idx: number) => (
                                <div key={idx} className="bg-white/5 rounded-xl p-4 border-l-4 border-orange-500 group hover:bg-white/[0.07] transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[10px] font-black font-mono text-orange-400 tracking-tighter">[{v.ruleId}] {v.severity}</div>
                                        <div className="text-[8px] font-mono text-gray-600">INDEX: 0{idx + 1}</div>
                                    </div>
                                    <div className="text-sm leading-relaxed text-gray-200">{v.message}</div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Latest Jobs Sidebar */}
                <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/10 flex flex-col">
                    <h2 className="text-lg font-bold mb-6 italic items-center flex gap-2">
                        <span className="w-1.5 h-6 bg-purple-500 skew-x-[-15deg]"></span>
                        SYSTEM_ADAPTERS
                    </h2>
                    <div className="space-y-4 overflow-auto flex-1 pr-2 custom-scrollbar">
                        {Object.entries(latestJobs).map(([key, job]: [string, any]) => (
                            <div key={key} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{key}</div>
                                    <div className={`w-1.5 h-1.5 rounded-full ${job?.status === 'SUCCEEDED' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-gray-700'}`}></div>
                                </div>
                                {job ? (
                                    <>
                                        <div className="text-[9px] font-mono text-gray-500 mb-2 truncate">ID: {job.jobId}</div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-[8px] font-mono text-gray-700">{new Date(job.createdAtIso).toLocaleString()}</div>
                                            <div className="text-[10px] font-bold text-white/60">{job.status}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-[10px] text-gray-600 italic">No job recorded</div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}

