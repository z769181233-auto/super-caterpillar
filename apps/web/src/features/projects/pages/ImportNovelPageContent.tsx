'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { novelImportApi } from '@/lib/apiClient';
import type { JobDTO, ImportNovelResultDTO } from '@/types/dto';
import { buildImportNovelNav } from './import-novel-nav';

type Mode = 'file' | 'text';

function normalizeJobStatus(status?: string) {
  return String(status || '').toUpperCase();
}

function isTerminal(status?: string) {
  const normalized = normalizeJobStatus(status);
  return normalized === 'DONE' || normalized === 'FAILED';
}

export function ImportNovelPageContent() {
  const params = useParams<{ projectId: string; locale: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const locale = params.locale || 'en';
  const nav = useMemo(() => buildImportNovelNav(locale, projectId), [locale, projectId]);

  const [mode, setMode] = useState<Mode>('file');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportNovelResultDTO | null>(null);
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [redirectScheduled, setRedirectScheduled] = useState(false);

  const latestJob = useMemo(() => (jobs.length > 0 ? jobs[0] : null), [jobs]);
  const latestStatus = normalizeJobStatus(latestJob?.status);

  const refreshJobs = useCallback(async () => {
    if (!projectId) return;
    try {
      const nextJobs = await novelImportApi.getNovelJobs(projectId);
      setJobs(nextJobs);
      return nextJobs;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [projectId]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    if (!latestJob || !isTerminal(latestJob.status)) {
      const timer = window.setInterval(() => {
        void refreshJobs();
      }, 3000);
      return () => window.clearInterval(timer);
    }
  }, [latestJob, refreshJobs]);

  useEffect(() => {
    if (latestStatus === 'DONE' && !redirectScheduled) {
      setRedirectScheduled(true);
      const timer = window.setTimeout(() => {
        router.push(nav.structureHref);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [latestStatus, redirectScheduled, router, nav.structureHref]);

  async function handleImport() {
    setSubmitting(true);
    setError('');
    try {
      let next: ImportNovelResultDTO;
      if (mode === 'file') {
        if (!file) throw new Error('请先选择小说文件');
        next = await novelImportApi.importNovelFile(projectId, file, { title, author });
      } else {
        if (!rawText.trim()) throw new Error('请先粘贴小说正文');
        next = await novelImportApi.importNovel(projectId, {
          title,
          novelName: title,
          author,
          rawText,
          content: rawText,
        });
      }
      setResult(next);
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const next = await novelImportApi.analyzeNovel(projectId);
      setResult((prev) => ({ ...(prev || {}), ...next }));
      await refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动分析失败');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Button variant="secondary" onClick={() => router.push(nav.projectHref)}>
            返回项目
          </Button>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>导入小说并生成剧本结构</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          这里已经接通真实导入链路。你可以上传 `txt/docx/epub/md`，或者直接粘贴正文；系统会创建小说源并发起分析任务，完成后跳到项目结构页继续看场次与镜头。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-xl)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant={mode === 'file' ? 'primary' : 'secondary'} onClick={() => setMode('file')}>
              上传文件
            </Button>
            <Button variant={mode === 'text' ? 'primary' : 'secondary'} onClick={() => setMode('text')}>
              粘贴正文
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>作品标题</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：剑来 第一卷" />
            </div>
            <div>
              <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>作者</div>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="例如：烽火戏诸侯" />
            </div>
          </div>

          {mode === 'file' ? (
            <div>
              <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>选择小说文件</div>
              <input
                type="file"
                accept=".txt,.docx,.epub,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--r-md)',
                  border: '1px dashed var(--border-subtle)',
                  background: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                }}
              />
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                支持 `txt / docx / epub / md`，单文件上限 50MB。
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>小说正文</div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="把小说正文直接粘贴到这里"
                style={{
                  width: '100%',
                  minHeight: 320,
                  padding: '1rem',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {error ? <div style={{ color: 'hsl(var(--hsl-error))', fontSize: '0.95rem' }}>{error}</div> : null}
          {latestStatus === 'DONE' ? (
            <div style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>分析完成，正在跳转到结构页...</div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button onClick={handleImport} disabled={submitting || analyzing}>
              {submitting ? '导入中...' : '开始导入'}
            </Button>
            <Button variant="secondary" onClick={handleAnalyze} disabled={analyzing || submitting}>
              {analyzing ? '分析启动中...' : '重新启动分析'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(nav.structureHref)}
              disabled={latestStatus !== 'DONE'}
            >
              前往结构页
            </Button>
          </div>
        </section>

        <aside style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-xl)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>当前状态</h2>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <div>最近任务状态：<strong style={{ color: 'var(--text-primary)' }}>{latestStatus || '无任务'}</strong></div>
            <div>最近任务 ID：<span style={{ color: 'var(--text-primary)' }}>{latestJob?.id || '-'}</span></div>
            <div>小说源 ID：<span style={{ color: 'var(--text-primary)' }}>{result?.novelSourceId || '-'}</span></div>
            <div>章节数：<span style={{ color: 'var(--text-primary)' }}>{String(result?.chapterCount ?? '-')}</span></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>任务历史</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 340, overflow: 'auto' }}>
              {jobs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>还没有任务记录</div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} style={{ padding: '0.9rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', background: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{job.type || 'NOVEL_ANALYSIS'}</strong>
                      <span style={{ color: 'var(--gold)' }}>{normalizeJobStatus(job.status)}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', wordBreak: 'break-all' }}>{job.id}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ImportNovelPageContent;
