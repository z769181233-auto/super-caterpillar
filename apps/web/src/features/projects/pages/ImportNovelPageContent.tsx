'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { novelImportApi, engineApi, jobApi } from '@/lib/apiClient';
import { ProjectPermissions } from '@/lib/permissions';
import { getJobStatusText, JobStatus } from '@/lib/status';
import EngineFilter from '@/components/engines/EngineFilter';
import EngineSummaryPanel from '@/components/engines/EngineSummaryPanel';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';
import ProjectStructureTree from '@/components/project/ProjectStructureTree';

type NovelJob = {
    id: string;
    type?: string;
    status: JobStatus;
    createdAt?: string;
    updatedAt?: string;
    engineKey?: string;
    engineVersion?: string | null;
    qualityScore?: {
        score?: number | null;
        confidence?: number | null;
    } | null;
    adapterName?: string;
    payload?: any;
};

interface UserPermissions {
    projectWrite?: boolean;
    projectGenerate?: boolean;
}

function formatFileSize(size: number): string {
    if (!size && size !== 0) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function ImportNovelPageContent() {
    const router = useRouter();
    const params = useParams() as { projectId: string };
    const projectId = params.projectId;

    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    const [novelName, setNovelName] = useState('');
    const [author, setAuthor] = useState('');
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const [savingMeta, setSavingMeta] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    const [jobs, setJobs] = useState<NovelJob[]>([]);
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [polling, setPolling] = useState(false);
    const [selectedEngineKey, setSelectedEngineKey] = useState<string>('default_novel_analysis');
    const [engines, setEngines] = useState<{ engineKey: string; name: string }[]>([]);
    const [historyJobs, setHistoryJobs] = useState<NovelJob[]>([]);

    const [importMode, setImportMode] = useState<'file' | 'text'>('file');
    const [rawText, setRawText] = useState('');

    const [permissions, setPermissions] = useState<UserPermissions>({
        projectWrite: true,
        projectGenerate: true,
    });

    useEffect(() => {
        engineApi
            .listEngines()
            .then((data) => {
                setEngines((data || []) as { engineKey: string; name: string }[]);
                const defaultEngine = data?.find((e: any) => e.engineKey === 'default_novel_analysis');
                if (defaultEngine) {
                    setSelectedEngineKey('default_novel_analysis');
                }
            })
            .catch((err) => {
                console.error('Failed to load engines:', err);
            });
    }, []);

    const canAnalyze = !!novelName.trim() && permissions.projectGenerate;
    const canImport = permissions.projectWrite;

    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const sortedJobs = [...safeJobs].sort((a, b) => {
        const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
    });
    const latestJobId = sortedJobs[0]?.id;

    const loadJobs = useCallback(async () => {
        try {
            const data = await novelImportApi.getNovelJobs(projectId);
            setJobs(data as unknown as NovelJob[]);
        } catch (e: unknown) {
            console.error('loadNovelJobs error', e);
        }
    }, [projectId]);

    const loadHistoryJobs = useCallback(async () => {
        try {
            const result = await jobApi.listJobs({
                projectId,
                type: 'NOVEL_ANALYSIS',
                page: 1,
                pageSize: 10,
            });
            const jobList = result.jobs || [];
            const novelAnalysisJobs = jobList
                .filter((j) => !j.type || j.type.startsWith('NOVEL_ANALYSIS'))
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                .map((j) => ({
                    id: j.id,
                    type: j.type,
                    status: j.status as JobStatus,
                    createdAt: j.createdAt || undefined,
                    updatedAt: undefined,
                    engineKey: j.engineKey || undefined,
                    payload: undefined,
                }))
                .slice(0, 5);

            setHistoryJobs(novelAnalysisJobs);
        } catch (e: unknown) {
            console.error('loadHistoryJobs error', e);
        }
    }, [projectId]);

    useEffect(() => {
        if (!polling) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const data = await novelImportApi.getNovelJobs(projectId);
                if (cancelled) return;
                setJobs(data as NovelJob[]);
                const last = data && (data as NovelJob[])[0];
                const doneStatuses: JobStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];
                if (last && doneStatuses.includes(last.status as JobStatus)) {
                    setPolling(false);
                    setAnalyzing(false);
                    setInfo('分析已完成，请在 Studio 中查看结构结果。');
                } else {
                    setTimeout(tick, 3000);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('poll novel jobs error', e);
                    setPolling(false);
                    setAnalyzing(false);
                }
            }
        };
        tick();
        return () => { cancelled = true; };
    }, [polling, projectId]);

    useEffect(() => {
        loadJobs();
        loadHistoryJobs();
    }, [loadJobs, loadHistoryJobs]);

    const processFile = async (f: File) => {
        const maxSize = 50 * 1024 * 1024;
        if (f.size > maxSize) {
            setError(`文件大小超过限制（最大 ${(maxSize / 1024 / 1024).toFixed(0)}MB）`);
            return;
        }
        setError(null); setInfo(null); setUploadProgress(0); setUploading(true); setFile(f); setFileUrl(null);
        if (importMode === 'file') { setNovelName(''); setAuthor(''); }
        try {
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => { if (prev >= 90) { clearInterval(progressInterval); return 90; } return prev + 10; });
            }, 200);
            const data = await novelImportApi.importNovelFile(projectId, f);
            clearInterval(progressInterval); setUploadProgress(100);
            const backendNovelName = data.novelName || '';
            const backendAuthor = data.author || '';
            const nameFromFile = f.name.replace(/\.[^/.]+$/, '');
            if (backendNovelName) { setNovelName(backendNovelName); }
            else if (importMode === 'file' && nameFromFile) { setNovelName(nameFromFile); }
            else if (importMode === 'text' && !novelName) { setNovelName('Untitiled Imported Text'); }
            setAuthor(backendAuthor || '');
            const url = data.fileUrl || data.url || '';
            setFileUrl(url || null);
            setInfo(url ? '文件上传成功，请确认基本信息后点击「开始分析」。' : '文件上传成功，未返回 fileUrl，依然可以开始分析（将走队列化处理）。');
        } catch (err: any) {
            console.error('文件上传失败:', err);
            let errorMessage = '上传失败';
            if (err instanceof Error) errorMessage = err.message;
            setError(errorMessage); setUploadProgress(0); setFile(null); setFileUrl(null);
        } finally { setUploading(false); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const allowedTypes = ['.txt', '.md', '.markdown', '.doc', '.docx'];
        const fileExt = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!allowedTypes.includes(fileExt)) {
            setError(`不支持的文件格式。支持格式：${allowedTypes.join(', ')}`);
            return;
        }
        await processFile(f);
    };

    const handleTextUpload = async () => {
        if (!rawText.trim()) return;
        const blob = new Blob([rawText], { type: 'text/plain' });
        const f = new File([blob], 'imported_text.txt', { type: 'text/plain' });
        await processFile(f);
    };

    const handleSaveMeta = async () => {
        if (!novelName.trim()) { setError('小说名不能为空。'); return; }
        setError(null); setInfo(null); setSavingMeta(true);
        try {
            await novelImportApi.importNovel(projectId, { novelName: novelName.trim(), author: author.trim(), fileUrl });
            setInfo('基本信息已保存。');
        } catch (err: any) { setError(err.message || '保存基本信息失败'); } finally { setSavingMeta(false); }
    };

    const handleAnalyze = async () => {
        setError(null); setInfo(null); setAnalyzing(true); setPolling(true);
        try {
            await novelImportApi.analyzeNovel(projectId);
            setInfo('分析任务已创建，正在分析中……');
        } catch (err: any) { setError(err.message || '启动分析失败'); setAnalyzing(false); setPolling(false); }
    };

    const handleBack = () => { router.push(`/projects/${projectId}`); };

    return (
        <div style={{ padding: '32px 40px', minHeight: '100vh', backgroundColor: '#020617', color: '#e5e7eb' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#f9fafb' }}>导入小说</h1>
                    <p style={{ marginTop: '8px', color: '#9ca3af' }}>上传小说文件，系统将自动解析并生成 Season / Episode / Scene / Shot 结构。</p>
                </div>
                <button onClick={handleBack} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#333', cursor: 'pointer' }}>返回项目</button>
            </div>

            {error && <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '6px', backgroundColor: '#ffe6e6', color: '#b00020' }}>{error}</div>}
            {info && <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '6px', backgroundColor: '#e6f4ff', color: '#0555aa' }}>{info}</div>}

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ borderRadius: '8px', border: '1px solid #1f2937', padding: '24px', marginBottom: '24px', backgroundColor: '#0b1120' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>导入来源</h2>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid #334155' }}>
                            <button onClick={() => setImportMode('file')} style={{ padding: '8px 0', borderBottom: importMode === 'file' ? '2px solid #1677ff' : 'none', color: importMode === 'file' ? '#1677ff' : '#666', fontWeight: 500, cursor: 'pointer', background: 'none' }}>文件上传</button>
                            <button onClick={() => setImportMode('text')} style={{ padding: '8px 0', borderBottom: importMode === 'text' ? '2px solid #1677ff' : 'none', color: importMode === 'text' ? '#1677ff' : '#666', fontWeight: 500, cursor: 'pointer', background: 'none' }}>直接粘贴文本</button>
                        </div>
                        {importMode === 'file' ? (
                            <>
                                <p style={{ marginBottom: '16px', color: '#9ca3af' }}>支持 TXT / Markdown 等纯文本格式，文件体积建议控制在数 MB 以内。</p>
                                <label style={{ display: canImport ? 'inline-flex' : 'none', alignItems: 'center', padding: '10px 18px', borderRadius: '6px', backgroundColor: '#2563eb', color: '#f9fafb', cursor: 'pointer', fontSize: '14px' }}>
                                    选择文件
                                    <input type="file" accept=".txt,.md,.markdown,.doc,.docx" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading || !canImport} />
                                </label>
                                {file && <div style={{ marginTop: '16px' }}>{file.name}（{formatFileSize(file.size)}）<div style={{ position: 'relative', height: '6px', borderRadius: '999px', backgroundColor: '#f2f2f2', overflow: 'hidden' }}><div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${uploadProgress}%`, backgroundColor: '#1677ff', transition: 'width 0.2s ease-out' }} /></div></div>}
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="请输入小说内容..." style={{ width: '100%', minHeight: '200px', padding: '12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#020617', color: '#fff', fontSize: '14px' }} />
                                <button onClick={handleTextUpload} disabled={!rawText.trim() || uploading} style={{ alignSelf: 'flex-start', padding: '8px 24px', borderRadius: '6px', backgroundColor: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer' }}>确认导入文本</button>
                            </div>
                        )}
                    </div>

                    <div style={{ borderRadius: '8px', border: '1px solid #1f2937', padding: '24px', marginBottom: '24px', backgroundColor: '#020617' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>基本信息</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '12px', columnGap: '16px', alignItems: 'center' }}>
                            <div style={{ textAlign: 'right', color: '#9ca3af' }}>小说名</div>
                            <input type="text" value={novelName} onChange={(e) => setNovelName(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#020617', color: '#fff' }} />
                            <div style={{ textAlign: 'right', color: '#9ca3af' }}>作者</div>
                            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#020617', color: '#fff' }} />
                            <div style={{ textAlign: 'right', color: '#9ca3af' }}>引擎</div>
                            <select value={selectedEngineKey} onChange={(e) => setSelectedEngineKey(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#020617', color: '#fff' }}>
                                {engines.filter((e: any) => e.enabled !== false).map((engine: any) => (<option key={engine.engineKey} value={engine.engineKey}>{engine.engineKey}</option>))}
                            </select>
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                            <button onClick={handleSaveMeta} disabled={!novelName.trim() || savingMeta} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #1677ff', backgroundColor: '#0f172a', color: '#fff', cursor: 'pointer' }}>保存基本信息</button>
                            <button onClick={handleAnalyze} disabled={!canAnalyze || analyzing} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#1677ff', color: '#fff', cursor: 'pointer' }}>开始分析</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
