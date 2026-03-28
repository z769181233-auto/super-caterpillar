'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAssetItem,
  createImportJob,
  createPreviewVideoJob,
  createRenderJob,
  createUploadSession,
  finalizeUploadSession,
  generateEpisodePackage,
  getProject,
  importNovel,
  uploadStoredFile,
  uploadSessionChunk
} from '../lib/api';
import type {
  AssetLibraryItem,
  EpisodePackage,
  ImportJob,
  NovelUploadSession,
  PreviewVideoJob,
  ProjectSnapshot,
  RenderJob,
  StoredFile
} from '../lib/types';

export function ProjectActionPanel({
  projectId,
  hasNovel,
  canPreparePreview,
  canRender,
  storedFiles
}: {
  projectId: string;
  hasNovel: boolean;
  canPreparePreview: boolean;
  canRender: boolean;
  storedFiles: Pick<StoredFile, 'id' | 'name' | 'kind' | 'mimeType'>[];
}) {
  const router = useRouter();
  const [controlTab, setControlTab] = useState<ControlTab>('import');
  const [importMode, setImportMode] = useState<'text' | 'file'>('file');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [episodeNo, setEpisodeNo] = useState(1);
  const [objective, setObjective] = useState('生成导演可直接交给视频模型的预演包');
  const [renderProvider, setRenderProvider] = useState<'mock_video' | 'sora' | 'jimeng'>('mock_video');
  const [qualityPreset, setQualityPreset] = useState<'draft' | 'preview' | 'final'>('preview');
  const [assetName, setAssetName] = useState('主角立绘设定');
  const [assetType, setAssetType] = useState<'character_sheet' | 'location_board' | 'prop_sheet' | 'reference_frame' | 'music_brief' | 'style_bible'>('character_sheet');
  const [assetDescription, setAssetDescription] = useState('用于统一角色服装、轮廓和表演风格。');
  const [assetTags, setAssetTags] = useState('主角,设定,角色');
  const [assetPromptHint, setAssetPromptHint] = useState('保持青蓝色主色、少年感、克制表演。');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<'novel_source' | 'asset_attachment'>('novel_source');
  const [storedFileId, setStoredFileId] = useState(storedFiles.find((file) => file.kind === 'novel_source')?.id || '');
  const [sourceFileId, setSourceFileId] = useState(storedFiles.find((file) => file.kind === 'asset_attachment')?.id || '');
  const [submitting, setSubmitting] = useState<'import' | 'chunked-import' | 'file-upload' | 'import-job' | 'package' | 'preview' | 'render' | 'asset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [latestImportResult, setLatestImportResult] = useState<ImportResultSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedFileLabel = useMemo(() => {
    if (!selectedFile) {
      return '未选择文件';
    }

    return `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`;
  }, [selectedFile]);
  const uploadButtonLabel =
    fileKind === 'novel_source'
      ? submitting === 'file-upload'
        ? '上传并分析中...'
        : '上传并开始分析'
      : submitting === 'file-upload'
        ? '上传中...'
        : '上传文件';

  function stopProgressTimer() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startProgressTimer(limit: number) {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setWorkflowProgress((current) => {
        if (!current || current.percent >= limit) {
          return current;
        }

        const step = Math.max(1, Math.ceil((limit - current.percent) / 5));
        return {
          ...current,
          percent: Math.min(limit, current.percent + step)
        };
      });
    }, 180);
  }

  function updateWorkflow(next: WorkflowProgress) {
    setWorkflowProgress(next);
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError('书名和正文不能为空');
      return;
    }
    const startedAt = Date.now();

    setSubmitting('import');
    setError(null);
    setSuccess(null);
    setLatestImportResult(null);
    updateWorkflow({
      title: '正文导入分析',
      detail: '正在提交正文并切分章节结构…',
      percent: 14,
      tone: 'active',
      steps: buildWorkflowSteps(1, 'text')
    });
    startProgressTimer(84);

    try {
      const snapshot = await importNovel<ProjectSnapshot>(projectId, {
        title: title.trim(),
        author: author.trim() || undefined,
        text: text.trim()
      });
      const importResult = buildImportResultSummary(snapshot);
      await ensureMinimumProgressTime(startedAt);
      stopProgressTimer();
      updateWorkflow({
        title: '正文导入分析',
        detail: `小说正文已完成导入，已生成 ${importResult.sceneCount} 个分场与 ${importResult.shotCount} 个镜头。`,
        percent: 100,
        tone: 'success',
        steps: buildWorkflowSteps(4, 'text')
      });
      setLatestImportResult(importResult);
      setSuccess(`小说已导入，已生成 ${importResult.chapterCount} 章、${importResult.sceneCount} 场、${importResult.shotCount} 镜`);
      router.refresh();
    } catch (submissionError) {
      stopProgressTimer();
      updateWorkflow({
        title: '正文导入分析',
        detail: submissionError instanceof Error ? submissionError.message : '导入失败',
        percent: 100,
        tone: 'error',
        steps: buildWorkflowSteps(2, 'text', true)
      });
      setError(submissionError instanceof Error ? submissionError.message : '导入失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGenerate() {
    setSubmitting('package');
    setError(null);
    setSuccess(null);

    try {
      await generateEpisodePackage<EpisodePackage>(projectId, {
        episodeNo,
        adaptationMode: 'faithful',
        estimatedMinutes: 24
      });
      setSuccess(`第 ${episodeNo} 集整包已生成`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '生成失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleChunkedImport() {
    if (!title.trim() || !text.trim()) {
      setError('书名和正文不能为空');
      return;
    }

    const chunkSize = 120_000;
    const chunks = splitTextIntoChunks(text.trim(), chunkSize);
    setSubmitting('chunked-import');
    setError(null);
    setSuccess(null);
    setLatestImportResult(null);
    setProgress(`准备上传 ${chunks.length} 个分片`);
    updateWorkflow({
      title: '长篇分片导入',
      detail: `已拆成 ${chunks.length} 个分片，准备上传。`,
      percent: 8,
      tone: 'active',
      steps: buildWorkflowSteps(1, 'chunk')
    });

    try {
      const session = await createUploadSession<NovelUploadSession>(projectId, {
        title: title.trim(),
        author: author.trim() || undefined,
        totalChunks: chunks.length
      });

      for (const [index, chunk] of chunks.entries()) {
        setProgress(`上传分片 ${index + 1} / ${chunks.length}`);
        updateWorkflow({
          title: '长篇分片导入',
          detail: `正在上传第 ${index + 1} / ${chunks.length} 个分片…`,
          percent: Math.min(70, 10 + Math.round(((index + 1) / chunks.length) * 60)),
          tone: 'active',
          steps: buildWorkflowSteps(2, 'chunk')
        });
        await uploadSessionChunk<NovelUploadSession>(session.id, {
          index,
          content: chunk
        });
      }

      setProgress('组装分片并完成导入');
      updateWorkflow({
        title: '长篇分片导入',
        detail: '分片已上传完成，正在组装并执行小说分析…',
        percent: 82,
        tone: 'active',
        steps: buildWorkflowSteps(3, 'chunk')
      });
      const snapshot = await finalizeUploadSession<ProjectSnapshot>(session.id);
      const importResult = buildImportResultSummary(snapshot);
      updateWorkflow({
        title: '长篇分片导入',
        detail: `长篇小说已完成导入，共 ${chunks.length} 个分片，并生成 ${importResult.sceneCount} 个分场。`,
        percent: 100,
        tone: 'success',
        steps: buildWorkflowSteps(4, 'chunk')
      });
      setLatestImportResult(importResult);
      setSuccess(`大体量小说已通过 ${chunks.length} 个分片完成导入，并已生成基础剧本产物`);
      router.refresh();
    } catch (submissionError) {
      updateWorkflow({
        title: '长篇分片导入',
        detail: submissionError instanceof Error ? submissionError.message : '分片导入失败',
        percent: 100,
        tone: 'error',
        steps: buildWorkflowSteps(2, 'chunk', true)
      });
      setError(submissionError instanceof Error ? submissionError.message : '分片导入失败');
    } finally {
      setSubmitting(null);
      setProgress(null);
    }
  }

  async function handleFileUpload() {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }
    const startedAt = Date.now();

    setSubmitting('file-upload');
    setError(null);
    setSuccess(null);
    setLatestImportResult(null);
    setProgress(`正在上传 ${selectedFile.name}（${formatFileSize(selectedFile.size)}）`);
    updateWorkflow({
      title: fileKind === 'novel_source' ? '源文件上传分析' : '素材文件上传',
      detail:
        fileKind === 'novel_source'
          ? `正在上传 ${selectedFile.name}，稍后自动开始小说分析…`
          : `正在上传素材文件 ${selectedFile.name}…`,
      percent: 12,
      tone: 'active',
      steps: buildWorkflowSteps(2, fileKind === 'novel_source' ? 'file' : 'asset')
    });
    startProgressTimer(fileKind === 'novel_source' ? 54 : 82);

    try {
      const storedFile = await uploadStoredFile<StoredFile>(projectId, {
        file: selectedFile,
        kind: fileKind
      });
      if (storedFile.kind === 'novel_source') {
        stopProgressTimer();
        setStoredFileId(storedFile.id);
        const autoDerivedTitle = deriveTitleFromFilename(selectedFile.name || storedFile.name);
        const importTitle = title.trim() || autoDerivedTitle || deriveTitleFromFilename(storedFile.name);
        if (!titleTouched && importTitle) {
          setTitle(importTitle);
        }
        setProgress(`文件已上传，开始分析《${importTitle}》`);
        updateWorkflow({
          title: '源文件上传分析',
          detail: `文件已上传，正在解析《${importTitle}》的章节和角色…`,
          percent: 62,
          tone: 'active',
          steps: buildWorkflowSteps(3, 'file')
        });
        startProgressTimer(92);
        const job = await createImportJob<ImportJob>(projectId, {
          fileId: storedFile.id,
          title: importTitle,
          author: author.trim() || undefined
        });
        if (job.status === 'failed') {
          throw new Error(job.errorMessage || '源文件分析失败');
        }
        const snapshot = await waitForProjectImportOutputs(projectId, importTitle);
        const importResult = buildImportResultSummary(snapshot);
        await ensureMinimumProgressTime(startedAt);
        stopProgressTimer();
        updateWorkflow({
          title: '源文件上传分析',
          detail: `《${importTitle}》已完成导入分析，生成 ${importResult.chapterCount} 章、${importResult.sceneCount} 场、${importResult.shotCount} 镜。`,
          percent: 100,
          tone: 'success',
          steps: buildWorkflowSteps(4, 'file')
        });
        setLatestImportResult(importResult);
        setSuccess(`文件「${storedFile.name}」已上传，并已生成基础剧本产物`);
      } else {
        await ensureMinimumProgressTime(startedAt, 450);
        stopProgressTimer();
        setSourceFileId(storedFile.id);
        updateWorkflow({
          title: '素材文件上传',
          detail: `素材附件 ${storedFile.name} 已上传入库。`,
          percent: 100,
          tone: 'success',
          steps: buildWorkflowSteps(3, 'asset')
        });
        setSuccess(`素材附件「${storedFile.name}」已上传`);
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.refresh();
    } catch (submissionError) {
      stopProgressTimer();
      updateWorkflow({
        title: fileKind === 'novel_source' ? '源文件上传分析' : '素材文件上传',
        detail: submissionError instanceof Error ? submissionError.message : '文件上传失败',
        percent: 100,
        tone: 'error',
        steps: buildWorkflowSteps(2, fileKind === 'novel_source' ? 'file' : 'asset', true)
      });
      setError(submissionError instanceof Error ? submissionError.message : '文件上传失败');
    } finally {
      setSubmitting(null);
      setProgress(null);
    }
  }

  async function handleImportJob() {
    const selectedStoredFile = storedFiles.find((file) => file.id === storedFileId);
    const resolvedTitle = title.trim() || deriveTitleFromFilename(selectedStoredFile?.name || '');
    if (!storedFileId || !resolvedTitle) {
      setError('请选择源文件并填写书名');
      return;
    }
    const startedAt = Date.now();

    setSubmitting('import-job');
    setError(null);
    setSuccess(null);
    setLatestImportResult(null);
    updateWorkflow({
      title: '重新执行源文件分析',
      detail: `正在基于已上传源文件重新解析《${resolvedTitle}》…`,
      percent: 24,
      tone: 'active',
      steps: buildWorkflowSteps(3, 'file')
    });
    startProgressTimer(90);

    try {
      const job = await createImportJob<ImportJob>(projectId, {
        fileId: storedFileId,
        title: resolvedTitle,
        author: author.trim() || undefined
      });
      if (job.status === 'failed') {
        throw new Error(job.errorMessage || '导入任务失败');
      }
      const snapshot = await waitForProjectImportOutputs(projectId, resolvedTitle);
      const importResult = buildImportResultSummary(snapshot);
      await ensureMinimumProgressTime(startedAt);
      stopProgressTimer();
      updateWorkflow({
        title: '重新执行源文件分析',
        detail: `《${resolvedTitle}》已重新完成导入分析，并刷新为 ${importResult.sceneCount} 场 ${importResult.shotCount} 镜。`,
        percent: 100,
        tone: 'success',
        steps: buildWorkflowSteps(4, 'file')
      });
      setLatestImportResult(importResult);
      setSuccess('源文件已重新分析，并已刷新基础剧本产物');
      router.refresh();
    } catch (submissionError) {
      stopProgressTimer();
      updateWorkflow({
        title: '重新执行源文件分析',
        detail: submissionError instanceof Error ? submissionError.message : '导入任务失败',
        percent: 100,
        tone: 'error',
        steps: buildWorkflowSteps(3, 'file', true)
      });
      setError(submissionError instanceof Error ? submissionError.message : '导入任务失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handlePreview() {
    setSubmitting('preview');
    setError(null);
    setSuccess(null);

    try {
      await createPreviewVideoJob<PreviewVideoJob>(projectId, {
        episodeNo,
        provider: 'mock_storyboard',
        objective: objective.trim() || undefined
      });
      setSuccess(`第 ${episodeNo} 集预演包已准备`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '预演包生成失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleRender() {
    setSubmitting('render');
    setError(null);
    setSuccess(null);

    try {
      const job = await createRenderJob<RenderJob>(projectId, {
        episodeNo,
        provider: renderProvider,
        qualityPreset
      });
      setSuccess(`第 ${episodeNo} 集出片任务已创建，当前状态：${job.status}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '出片任务创建失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAssetCreate() {
    if (!assetName.trim() || !assetDescription.trim()) {
      setError('素材名称和描述不能为空');
      return;
    }

    setSubmitting('asset');
    setError(null);
    setSuccess(null);

    try {
      await createAssetItem<AssetLibraryItem>(projectId, {
        name: assetName.trim(),
        type: assetType,
        description: assetDescription.trim(),
        sourceFileId: sourceFileId || undefined,
        tags: assetTags.split(',').map((item) => item.trim()).filter(Boolean),
        promptHint: assetPromptHint.trim() || undefined
      });
      setSuccess(`素材资产「${assetName.trim()}」已登记`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '素材登记失败');
    } finally {
      setSubmitting(null);
    }
  }

  const commandCards: CommandCardMeta[] = [
    { key: 'import', label: '导入原著', eyebrow: '原著', hint: '上传并自动分析', status: hasNovel ? 'ready' : 'pending' },
    { key: 'package', label: '生成整包', eyebrow: '整包', hint: '生成单集剧本包', status: hasNovel ? 'ready' : 'locked' },
    { key: 'preview', label: '准备预演', eyebrow: '预演', hint: '生成预演交付', status: canPreparePreview ? 'ready' : 'locked' },
    { key: 'render', label: '提交出片', eyebrow: '出片', hint: '提交视频任务', status: canRender ? 'ready' : 'locked' },
    { key: 'asset', label: '资产入库', eyebrow: '资产', hint: '登记设定资产', status: 'neutral' }
  ];
  const commandCards: CommandCardMeta[] = [
    { key: 'import', label: '原著接入', eyebrow: '小说', hint: '接入长篇原著', status: hasNovel ? 'ready' : 'pending' },
    { key: 'package', label: '剧本整包', eyebrow: '整包', hint: '生成导演全案包', status: canPreparePackage ? 'ready' : 'locked' },
    { key: 'preview', label: '预演交付', eyebrow: '预演', hint: '生成视频交付说明', status: canPreparePreview ? 'ready' : 'locked' },
    { key: 'render', label: '提交出片', eyebrow: '出片', hint: '提交视频任务', status: canRender ? 'ready' : 'locked' },
    { key: 'asset', label: '资产入库', eyebrow: '资产', hint: '登记设定资产', status: 'neutral' }
  ];

  return (
    <div className="dispatch-panel">
      {/* 顶部状态条 */}
      <div className="status-bar">
        <StatusPill label={hasNovel ? '原著已接入' : '待导入'} tone={hasNovel ? 'success' : 'neutral'} />
        <StatusPill label={canPreparePreview ? '可准备预演' : '待生成整包'} tone={canPreparePreview ? 'success' : 'neutral'} />
        <StatusPill label={canRender ? '可提交出片' : '待生成预演'} tone={canRender ? 'success' : 'neutral'} />
        <StatusPill label={`${storedFiles.length} 附件`} tone="neutral" />
      </div>

      {error ? <NoticeBanner tone="error" message={error} /> : null}
      {success ? <NoticeBanner tone="success" message={success} /> : null}
      {progress ? <NoticeBanner tone="info" message={progress} /> : null}
      {workflowProgress ? <WorkflowProgressPanel progress={workflowProgress} /> : null}
      {latestImportResult ? <ImportResultPanel result={latestImportResult} /> : null}

      {/* 核心调度台 (Command Dock) */}
      <div className="glass-panel command-dock-overhaul">
        <div className="dock-head">
          <div className="dock-intro">
            <div className="eyebrow">Production Hub</div>
            <h2 className="dock-title">创制调度台</h2>
            <p className="dock-desc">标准动漫制作链路的枢纽。从原著分析到视频生成的一站式调度中心。</p>
          </div>
        </div>

        <div className="command-cards">
          {commandCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`command-card-btn ${controlTab === item.key ? 'active' : ''} status-${item.status}`}
              onClick={() => setControlTab(item.key)}
            >
              <div className="card-top">
                <div className="status-dot" />
                <span className="card-eyebrow">{item.eyebrow}</span>
              </div>
              <div className="card-label">{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 动态内容区 */}
      <div className="stage-workspace">
        {controlTab === 'import' && (
          <div className="import-workspace">
            <ActionCard eyebrow="原著入口" title="接入长篇小说原著" description="AI 自动解析全书，生成导演脚本、人物传记与分镜底稿。" tone="emerald">
              <StagePanel
                kicker="长篇接入流水线"
                title="导入原始文本"
                description="支持 TXT 文件直接上传或大段正文粘贴。系统将执行深度内容拆解与核心资产抽取。"
                controls={
                  <div className="import-controls">
                    <div className="mode-tabs">
                      <button className={`tab-btn ${importMode === 'file' ? 'active' : ''}`} onClick={() => setImportMode('file')}>上传文件</button>
                      <button className={`tab-btn ${importMode === 'text' ? 'active' : ''}`} onClick={() => setImportMode('text')}>内容粘贴</button>
                    </div>

                    {importMode === 'file' ? (
                      <div className="file-dropzone-overhaul">
                        <div className="drop-icon">↑</div>
                        <div className="drop-text">
                          {importFile ? `已选择: ${importFile.name}` : '点击或拖拽文件至此'}
                        </div>
                        <input
                          type="file"
                          accept=".txt"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          className="file-hidden"
                        />
                      </div>
                    ) : (
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="在此粘贴小说正文..."
                        className="text-input-field"
                      />
                    )}

                    <div className="import-actions">
                      <button
                        type="button"
                        disabled={submitting !== null || (importMode === 'file' ? !importFile : !importText.trim())}
                        onClick={handleImport}
                        className="btn-primary main-import-btn"
                      >
                        {submitting === 'import' ? '正在解析...' : '开始接入并分析'}
                      </button>
                    </div>
                  </div>
                }
                footnote="原著分析后将进入剧本整包生成环节。"
              />
            </ActionCard>

            <div className="side-rail">
              <RailCard title="分析项" description="接入后将自动抽取以下产物">
                <div className="outputs-tags">
                  {['章节切分', '角色传记', '主线总结', '导演稿', '预演分镜'].map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </RailCard>
              <RailCard title="附件信息" description="当前工程关联的所有文件">
                <div className="file-list">
                  {storedFiles.length === 0 ? (
                    <div className="empty">暂无附件</div>
                  ) : (
                    storedFiles.map(file => (
                      <div key={file.id} className="file-item">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                      </div>
                    ))
                  )}
                </div>
              </RailCard>
            </div>
          </div>
        )}

        {controlTab === 'package' && (
          <ActionCard eyebrow="剧本整包" title="生成全案导演包" description="汇总并固化全书的导演脚本、角色设定与场景资产。" tone="violet">
            <StagePanel
              kicker="整包引擎"
              title="一键固化导演包"
              description="生成包含导演稿、分场映射与核心镜头计划的完整资产包。该包是后续视频生成的唯一数据源。"
              controls={
                <button type="button" disabled={!canPreparePackage || submitting !== null} onClick={handlePackage} className="btn-primary">
                  {submitting === 'package' ? '封装中...' : '生成整包并导出分镜'}
                </button>
              }
              footnote="生成整包是进入预演与渲染的前提。"
            />
          </ActionCard>
        )}

        {controlTab === 'preview' && (
          <ActionCard eyebrow="预演调度" title="导出视频交付包" description="为 AI 视频引擎提供明确的镜头、节奏与资产指引。" tone="indigo">
            <StagePanel
              kicker="预演交付"
              title="视频生成交付方案"
              description="明确预演目标，生成详细的渲染指引，可直接对接到视频大模型。"
              controls={
                <div className="horizontal-controls">
                  <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="本次预演目标（如：第一集动作戏）" className="dispatch-input" style={{ flex: 1 }} />
                  <button type="button" disabled={!canPreparePreview || submitting !== null} onClick={handlePreview} className="btn-primary">
                    {submitting === 'preview' ? '准备中...' : '生成交付包'}
                  </button>
                </div>
              }
              footnote={!canPreparePreview ? '请先完成剧本整包固化。' : '交付包已支持主流视频引擎。'}
              footnoteTone={!canPreparePreview ? 'warn' : 'default'}
            />
          </ActionCard>
        )}

        {controlTab === 'render' && (
          <ActionCard eyebrow="渲染调度" title="提交视频生成任务" description="连接模型集群，开始实际的视频画面生成。" tone="amber">
            <StagePanel
              kicker="渲染队列"
              title="提交渲染任务"
              description="选择模型策略与质量预设，正式进入渲染队列。"
              controls={
                <div className="horizontal-controls">
                  <select value={renderProvider} onChange={(e) => setRenderProvider(e.target.value as any)} className="dispatch-select">
                    <option value="mock_video">Mock Engine (Test)</option>
                    <option value="sora">Sora (Adapting)</option>
                    <option value="jimeng">即梦 (Adapting)</option>
                  </select>
                  <select value={qualityPreset} onChange={(e) => setQualityPreset(e.target.value as any)} className="dispatch-select">
                    <option value="draft">草稿 (Draft)</option>
                    <option value="preview">预演 (Preview)</option>
                    <option value="final">成片 (Final)</option>
                  </select>
                  <button type="button" disabled={!canRender || submitting !== null} onClick={handleRender} className="btn-primary">
                    {submitting === 'render' ? '队列排队中...' : '提交渲染'}
                  </button>
                </div>
              }
              footnote={!canRender ? '请先准备好预演视频交付包。' : '当前节点：视频生成。'}
              footnoteTone={!canRender ? 'warn' : 'default'}
            />
          </ActionCard>
        )}

        {controlTab === 'asset' && (
          <ActionCard eyebrow="资产库" title="登记素材资产" description="统一管理角色设定、场景看板与核心参考。这些资产将直接影响视频生成的视觉一致性。" tone="indigo">
            <div className="asset-registration">
              <div className="asset-form-grid">
                <div className="form-item">
                  <label>名称</label>
                  <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="素材名称" className="dispatch-input" />
                </div>
                <div className="form-item">
                  <label>类型</label>
                  <select value={assetType} onChange={(e) => setAssetType(e.target.value as any)} className="dispatch-select">
                    <option value="character_sheet">角色设定 (Character)</option>
                    <option value="location_board">场景看板 (Location)</option>
                    <option value="prop_sheet">道具设定 (Prop)</option>
                    <option value="reference_frame">参考帧 (Reference)</option>
                  </select>
                </div>
                <div className="form-item full-width">
                  <label>描述</label>
                  <textarea value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} rows={3} placeholder="素材详细描述..." className="dispatch-textarea" />
                </div>
                <div className="form-item">
                  <label>附件关联</label>
                  <select value={sourceFileId} onChange={(e) => setSourceFileId(e.target.value)} className="dispatch-select">
                    <option value="">选择附件 (可选)</option>
                    {storedFiles.filter(f => f.kind === 'asset_attachment').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-item">
                  <label>提示词增强</label>
                  <input value={assetPromptHint} onChange={(e) => setAssetPromptHint(e.target.value)} placeholder="针对模型的特殊指令" className="dispatch-input" />
                </div>
              </div>
              <div className="asset-foot">
                <button type="button" disabled={submitting !== null} onClick={handleAssetCreate} className="btn-primary">
                  {submitting === 'asset' ? '保存中...' : '保存资产并入库'}
                </button>
              </div>
            </div>
          </ActionCard>
        )}
      </div>

      <style jsx>{`
        .dispatch-panel {
          display: grid;
          gap: 24px;
        }

        .status-bar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .command-dock-overhaul {
          padding: 32px;
          border-radius: var(--radius-lg);
          display: grid;
          gap: 32px;
        }

        .dock-title {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.05em;
        }

        .dock-desc {
          margin: 0;
          font-size: 14px;
          color: var(--text-subtle);
          max-width: 600px;
        }

        .command-cards {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.02);
          padding: 6px;
          border-radius: var(--radius-md);
          border: 1px solid var(--glass-border);
          width: fit-content;
        }

        .command-card-btn {
          display: grid;
          gap: 4px;
          padding: 12px 20px;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: var(--transition-normal);
          text-align: left;
        }

        .command-card-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .command-card-btn.active {
          background: rgba(85, 214, 255, 0.08);
          border-color: var(--accent-glow);
          box-shadow: 0 4px 12px rgba(85, 214, 255, 0.1);
        }

        .card-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #334155;
        }

        .status-ready .status-dot { background: var(--success); box-shadow: 0 0 8px var(--success-glow); }
        .status-pending .status-dot { background: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }

        .card-eyebrow {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        .card-label {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-main);
        }

        .stage-workspace {
          display: grid;
          gap: 24px;
        }

        .import-workspace {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: start;
        }

        .import-controls {
          display: grid;
          gap: 24px;
        }

        .mode-tabs {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.03);
          padding: 4px;
          border-radius: var(--radius-sm);
          width: fit-content;
        }

        .tab-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          border-radius: var(--radius-sm);
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-normal);
        }

        .tab-btn.active {
          background: var(--bg-2);
          color: var(--text-main);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .file-dropzone-overhaul {
          height: 200px;
          border: 2px dashed var(--glass-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          cursor: pointer;
          position: relative;
          transition: var(--transition-normal);
        }

        .file-dropzone-overhaul:hover {
          border-color: var(--accent);
          background: rgba(85, 214, 255, 0.03);
        }

        .drop-icon { font-size: 32px; color: var(--accent); }
        .drop-text { font-size: 14px; color: var(--text-subtle); }
        .file-hidden { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

        .text-input-field {
          height: 200px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 16px;
          color: var(--text-main);
          font-size: 15px;
          resize: none;
          outline: none;
        }

        .side-rail {
          display: grid;
          gap: 24px;
        }

        .outputs-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tag {
          padding: 6px 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-subtle);
        }

        .file-list {
          display: grid;
          gap: 8px;
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--radius-sm);
          font-size: 12px;
        }
        
        .file-name { color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .file-size { color: var(--text-muted); }

        .horizontal-controls {
          display: flex;
          gap: 16px;
          width: 100%;
        }

        .dispatch-input, .dispatch-select, .dispatch-textarea {
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          color: var(--text-main);
          font-size: 14px;
          outline: none;
        }

        .asset-registration {
          display: grid;
          gap: 24px;
        }

        .asset-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-item { display: grid; gap: 8px; }
        .form-item label { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .full-width { grid-column: 1 / -1; }

        @media (max-width: 1024px) {
          .import-workspace { grid-template-columns: 1fr; }
          .side-rail { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
                  <textarea value={assetDescription} onChange={(event) => setAssetDescription(event.target.value)} rows={4} placeholder="素材描述" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={fieldClusterStyle}>
                  <div style={fieldLabelStyle}>标签</div>
                  <input value={assetTags} onChange={(event) => setAssetTags(event.target.value)} placeholder="标签，逗号分隔" style={inputStyle} />
                </div>
                <div style={fieldClusterStyle}>
                  <div style={fieldLabelStyle}>关联附件</div>
                  <select value={sourceFileId} onChange={(event) => setSourceFileId(event.target.value)} style={inputStyle}>
                    <option value="">选择已上传素材附件（可选）</option>
                    {storedFiles
                      .filter((file) => file.kind === 'asset_attachment')
                      .map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ ...fieldClusterStyle, gridColumn: '1 / -1' }}>
                  <div style={fieldLabelStyle}>提示词补充</div>
                  <input value={assetPromptHint} onChange={(event) => setAssetPromptHint(event.target.value)} placeholder="提示词补充" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--text-subtle)', fontSize: 13 }}>资产会被后续角色设定、场景统一和视频生成模型调用。</div>
                <button type="button" disabled={submitting !== null} onClick={handleAssetCreate} style={submitting !== null ? disabledButtonStyle : buttonStyle}>
                  {submitting === 'asset' ? '登记中...' : '登记素材资产'}
                </button>
              </div>
            </div>
          </ActionCard>
        </div>
      ) : null}
    </div>
  );
}

function ControlTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={controlTabButtonStyle(active)}>
      {label}
    </button>
  );
}

function ControlSubTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={controlSubTabButtonStyle(active)}>
      {label}
    </button>
  );
}

function KindSwitchButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={kindSwitchButtonStyle(active)}>
      {label}
    </button>
  );
}

function WorkflowProgressPanel({ progress }: { progress: WorkflowProgress }) {
  const barColor = progress.tone === 'success' ? 'var(--success)' : progress.tone === 'error' ? 'var(--error)' : 'var(--accent)';

  return (
    <div className="glass-panel progress-panel-overhaul">
      <div className="progress-head">
        <div className="head-text">
          <h4 className="progress-title">{progress.title}</h4>
          <p className="progress-detail">{progress.detail}</p>
        </div>
        <div className="percent">{progress.percent}%</div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress.percent}%`, background: barColor }} />
      </div>
      <div className="steps-grid">
        {progress.steps.map((step) => (
          <div key={step.label} className={`step-item state-${step.state}`}>
            <div className="step-dot" />
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .progress-panel-overhaul {
          padding: 24px;
          border-radius: var(--radius-lg);
          display: grid;
          gap: 20px;
        }
        .progress-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .progress-title {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 800;
        }
        .progress-detail {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .percent {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.05em;
        }
        .progress-track {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
        }
        .step-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
        }
        .step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .state-active { color: var(--accent); border-color: var(--accent-glow); background: rgba(85, 214, 255, 0.05); }
        .state-done { color: var(--success); }
        .state-error { color: var(--error); }
      `}</style>
    </div>
  );
}

function StageFeature({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card feature-card-overhaul">
      <div className="feature-label">{label}</div>
      <div className="feature-value">{value}</div>
      <style jsx>{`
        .feature-card-overhaul {
          padding: 12px;
          border-radius: var(--radius-sm);
          display: grid;
          gap: 4px;
        }
        .feature-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .feature-value {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-main);
        }
      `}</style>
    </div>
  );
}

function StagePanel({
  kicker,
  title,
  description,
  controls,
  footnote,
  footnoteTone = 'default'
}: {
  kicker: string;
  title: string;
  description: string;
  controls: React.ReactNode;
  footnote: string;
  footnoteTone?: 'default' | 'warn';
}) {
  return (
    <div className="stage-panel-overhaul">
      <div className="stage-intro">
        <div className="kicker">{kicker}</div>
        <h3 className="stage-title">{title}</h3>
        <p className="stage-desc">{description}</p>
      </div>
      <div className="stage-controls">{controls}</div>
      <div className={`stage-footer tone-${footnoteTone}`}>{footnote}</div>
      <style jsx>{`
        .stage-panel-overhaul {
          display: grid;
          gap: 32px;
          padding: 24px 0;
        }
        .kicker {
          font-size: 11px;
          font-weight: 800;
          color: var(--accent);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .stage-title {
          margin: 0 0 16px;
          font-size: 48px;
          font-weight: 950;
          letter-spacing: -0.06em;
          line-height: 1;
          background: var(--text-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .stage-desc {
          margin: 0;
          font-size: 16px;
          color: var(--text-subtle);
          line-height: 1.7;
          max-width: 640px;
        }
        .stage-controls {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        .stage-footer {
          font-size: 13px;
          color: var(--text-muted);
          padding-top: 16px;
          border-top: 1px solid var(--glass-border);
        }
        .tone-warn { color: var(--warning); }
      `}</style>
    </div>
  );
}


function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }

  return chunks.length > 0 ? chunks : [''];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function deriveTitleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/^[_?]+|[_?]+$/g, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return base || '未命名小说';
}

async function ensureMinimumProgressTime(startedAt: number, minimumMs = 700): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minimumMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
  }
}

async function waitForProjectImportOutputs(projectId: string, titleHint?: string): Promise<ProjectSnapshot> {
  for (let index = 0; index < 8; index += 1) {
    const snapshot = await getProject<ProjectSnapshot>(projectId);
    if (hasImportOutputs(snapshot, titleHint)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 420));
  }

  throw new Error('导入已完成，但暂未读取到分析产物，请稍后刷新重试。');
}

function hasImportOutputs(snapshot: ProjectSnapshot, titleHint?: string): boolean {
  const novelReady = Boolean(snapshot.novel && snapshot.novel.chapterCount > 0);
  const outputsReady = snapshot.scenes.length > 0 && snapshot.shots.length > 0;
  if (!novelReady || !outputsReady) {
    return false;
  }

  if (!titleHint?.trim() || !snapshot.novel?.title) {
    return true;
  }

  return snapshot.novel.title.includes(titleHint.trim()) || titleHint.trim().includes(snapshot.novel.title);
}

function buildImportResultSummary(snapshot: ProjectSnapshot): ImportResultSummary {
  if (!snapshot.novel) {
    throw new Error('导入返回成功，但未发现小说产物。');
  }

  return {
    title: snapshot.novel.title,
    wordCount: snapshot.novel.wordCount,
    chapterCount: snapshot.novel.chapterCount,
    characterCount: snapshot.characters.length,
    sceneCount: snapshot.scenes.length,
    shotCount: snapshot.shots.length,
    issueCount: snapshot.issues.length
  };
}

function buildWorkflowSteps(activeStep: number, mode: 'text' | 'file' | 'chunk' | 'asset', hasError = false): WorkflowStep[] {
  const labelsByMode: Record<typeof mode, string[]> = {
    text: ['正文已就绪', '提交分析', '章节与角色抽取', '导入完成'],
    file: ['文件已选择', '文件上传', '小说分析', '导入完成'],
    chunk: ['拆分长文', '上传分片', '组装分析', '导入完成'],
    asset: ['文件已选择', '文件上传', '入库完成', '']
  };

  return labelsByMode[mode]
    .filter(Boolean)
    .map((label, index) => {
      const stepNo = index + 1;
      if (hasError && stepNo === activeStep) {
        return { label, state: 'error' };
      }
      if (stepNo < activeStep) {
        return { label, state: 'done' };
      }
      if (stepNo === activeStep) {
        return { label, state: 'active' };
      }
      return { label, state: 'pending' };
    });
}

function ActionCard({
  eyebrow,
  title,
  description,
  tone,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone: 'violet' | 'emerald' | 'amber' | 'indigo';
  children: React.ReactNode;
}) {
  return (
    <div className={`glass-panel action-card-overhaul tone-${tone}`}>
      <div className="action-card-header">
        <div className="head-left">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="title">{title}</h2>
        </div>
        <p className="description">{description}</p>
      </div>
      <div className="action-card-body">{children}</div>
      <style jsx>{`
        .action-card-overhaul {
          padding: 32px;
          border-radius: var(--radius-lg);
          display: grid;
          gap: 24px;
        }
        .action-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--glass-border);
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .title {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
        .description {
          margin: 0;
          font-size: 14px;
          color: var(--text-subtle);
          max-width: 420px;
          line-height: 1.6;
        }
        .tone-violet { border-left: 4px solid var(--accent-2); }
        .tone-emerald { border-left: 4px solid var(--success); }
        .tone-amber { border-left: 4px solid var(--warning); }
        .tone-indigo { border-left: 4px solid var(--accent); }
      `}</style>
    </div>
  );
}

function RailCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rail-card-overhaul">
      <div className="rail-head">
        <h4 className="rail-title">{title}</h4>
        <p className="rail-desc">{description}</p>
      </div>
      <div className="rail-body">{children}</div>
      <style jsx>{`
        .rail-card-overhaul {
          padding: 20px;
          border-radius: var(--radius-md);
          display: grid;
          gap: 16px;
        }
        .rail-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }
        .rail-desc {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportResultSummary }) {
  return (
    <div className="glass-panel import-result-overhaul">
      <div className="result-head">
        <div className="eyebrow">分析产物</div>
        <h3 className="result-title">{result.title}</h3>
        <p className="result-desc">已完成原著深度解析，多维数据已就绪。</p>
      </div>
      <div className="result-grid">
        <MetaMetric label="总字数" value={result.wordCount.toLocaleString('zh-CN')} />
        <MetaMetric label="章节" value={result.chapterCount.toLocaleString('zh-CN')} />
        <MetaMetric label="角色" value={result.characterCount.toLocaleString('zh-CN')} />
        <MetaMetric label="分场" value={result.sceneCount.toLocaleString('zh-CN')} />
        <MetaMetric label="镜头" value={result.shotCount.toLocaleString('zh-CN')} />
        <MetaMetric label="审查" value={result.issueCount.toLocaleString('zh-CN')} />
      </div>
      <style jsx>{`
        .import-result-overhaul {
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--success-glow);
          background: radial-gradient(circle at top right, rgba(34, 197, 94, 0.05), transparent 40%);
        }
        .eyebrow {
          font-size: 10px;
          font-weight: 800;
          color: var(--success);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .result-title {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 900;
        }
        .result-desc {
          margin: 0 0 24px;
          font-size: 14px;
          color: var(--text-subtle);
        }
        .result-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
        }
      `}</style>
    </div>
  );
}

function MetaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-metric-overhaul">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <style jsx>{`
        .meta-metric-overhaul {
          display: grid;
          gap: 4px;
        }
        .metric-label {
          font-size: 11px;
          color: var(--text-muted);
        }
        .metric-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-main);
        }
      `}</style>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'success' | 'neutral' }) {
  return (
    <div className={`status-pill tone-${tone}`}>
      {label}
      <style jsx>{`
        .status-pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .tone-success {
          background: rgba(34, 197, 94, 0.1);
          color: var(--success);
          border: 1px solid var(--success-glow);
        }
        .tone-neutral {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-subtle);
          border: 1px solid var(--glass-border);
        }
      `}</style>
    </div>
  );
}

function NoticeBanner({ tone, message }: { tone: 'success' | 'error' | 'info'; message: string }) {
  return (
    <div className={`notice-banner tone-${tone}`}>
      {message}
      <style jsx>{`
        .notice-banner {
          padding: 14px 20px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
        }
        .tone-success { background: rgba(34, 197, 94, 0.1); color: var(--success); border: 1px solid var(--success-glow); }
        .tone-error { background: rgba(239, 68, 68, 0.1); color: var(--error); border: 1px solid rgba(239, 68, 68, 0.2); }
        .tone-info { background: rgba(85, 214, 255, 0.1); color: var(--accent); border: 1px solid var(--accent-glow); }
      `}</style>
    </div>
  );
}

type WorkflowStep = {
  label: string;
  state: 'pending' | 'active' | 'done' | 'error';
};

type ControlTab = 'import' | 'package' | 'preview' | 'render' | 'asset';

type WorkflowProgress = {
  title: string;
  detail: string;
  percent: number;
  tone: 'active' | 'success' | 'error';
  steps: WorkflowStep[];
};

type ImportResultSummary = {
  title: string;
  wordCount: number;
  chapterCount: number;
  characterCount: number;
  sceneCount: number;
  shotCount: number;
  issueCount: number;
};

type CommandCardMeta = {
  key: ControlTab;
  label: string;
  eyebrow: string;
  hint: string;
  status: 'ready' | 'pending' | 'locked' | 'neutral';
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'linear-gradient(180deg, rgba(15,19,27,0.88), rgba(10,14,20,0.92))',
  color: 'var(--text-main)',
  padding: '13px 14px',
  boxSizing: 'border-box',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)'
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(85,214,255,0.22)',
  borderRadius: 14,
  background: 'linear-gradient(180deg, rgba(99,228,255,0.98), rgba(38,197,243,0.94))',
  color: '#04131a',
  padding: '12px 16px',
  fontWeight: 800,
  boxShadow: '0 10px 24px rgba(18,194,242,0.18)',
  cursor: 'pointer'
};

const heroButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '14px 16px',
  borderRadius: 16,
  boxShadow: '0 14px 28px rgba(18,194,242,0.2)'
};

const secondaryPrimaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'linear-gradient(180deg, rgba(22,28,39,0.96), rgba(14,19,28,0.98))',
  color: '#eff6ff',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'none'
};

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(51,65,85,0.72)',
  color: 'rgba(226,232,240,0.7)',
  boxShadow: 'none',
  cursor: 'not-allowed'
};

const disabledHeroButtonStyle: React.CSSProperties = {
  ...disabledButtonStyle,
  borderRadius: 16,
  padding: '14px 16px'
};

const panelShellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18
};

const controlSummaryStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  paddingBottom: 0
};

const commandDockStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 22,
  background:
    'radial-gradient(circle at top right, rgba(85,214,255,0.1), transparent 18%), linear-gradient(180deg, rgba(13,17,25,0.94), rgba(9,12,18,0.94))',
  border: '1px solid rgba(255,255,255,0.05)',
  boxShadow: '0 14px 34px rgba(0,0,0,0.18)'
};

const commandDockHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap'
};

const dockEyebrowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  marginBottom: 8
};

const dockStatusRailStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const dockStatusPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.05)',
  background: 'rgba(255,255,255,0.02)',
  fontSize: 12,
  fontWeight: 700
};

const commandCardsStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  flexWrap: 'wrap',
  width: 'fit-content',
  padding: 4,
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.012))',
  border: '1px solid rgba(255,255,255,0.04)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)'
};

function commandCardStyle(active: boolean, status: CommandCardMeta['status']): React.CSSProperties {
  return {
    display: 'grid',
    gap: 4,
    alignItems: 'start',
    textAlign: 'left',
    flex: '0 0 auto',
    minHeight: 0,
    minWidth: 110,
    padding: '10px 12px 11px',
    borderRadius: 14,
    cursor: 'pointer',
    background: active ? 'linear-gradient(180deg, rgba(85,214,255,0.12), rgba(85,214,255,0.04))' : 'transparent',
    border: active
      ? '1px solid rgba(85,214,255,0.14)'
      : status === 'locked'
        ? '1px solid transparent'
        : '1px solid transparent',
    color: active ? '#f8fdff' : '#cbd5e1',
    boxShadow: active ? 'inset 0 -1px 0 rgba(85,214,255,0.25)' : 'none'
  };
}

function commandCardDotStyle(status: CommandCardMeta['status']): React.CSSProperties {
  const color =
    status === 'ready' ? '#22c55e' : status === 'pending' ? '#38bdf8' : status === 'neutral' ? '#94a3b8' : '#64748b';

  return {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: color
  };
}

const commandCardEyebrowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase'
};

const commandCardLeadingStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8
};

const commandSegmentTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const commandSegmentHintStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  paddingLeft: 15
};

const activeCommandSummaryStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '12px 14px 2px',
  maxWidth: '100%',
  borderTop: '1px solid rgba(255,255,255,0.045)'
};

const activeCommandSummaryLeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap'
};

const activeCommandMetaStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '10px 12px',
  minWidth: 132,
  borderRadius: 14,
  background: 'rgba(255,255,255,0.018)',
  border: '1px solid rgba(255,255,255,0.04)'
};

const activeCommandMetaLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const studioLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.88fr) minmax(236px, 0.56fr)',
  gap: 16,
  alignItems: 'start'
};

const heroStageStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18
};

const heroCopyStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const stageFeatureRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  maxWidth: 760,
  marginTop: 4
};

const stageFeatureStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.018)',
  border: '1px solid rgba(255,255,255,0.04)'
};

const heroKickerStyle: React.CSSProperties = {
  color: '#8be7ff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase'
};

const modeSwitcherStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
  border: '1px solid rgba(255,255,255,0.05)',
  width: 'fit-content'
};

const inputCanvasStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 14,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.004))',
  border: '1px solid rgba(255,255,255,0.035)'
};

const fieldClusterStyle: React.CSSProperties = {
  display: 'grid',
  gap: 7
};

const fieldLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const inlineFieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12
};

const heroDropZoneStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 24,
  alignItems: 'stretch',
  flexWrap: 'wrap',
  minHeight: 252,
  padding: '24px 24px 22px',
  borderRadius: 24,
  border: '1px solid rgba(85,214,255,0.12)',
  background:
    'radial-gradient(circle at top right, rgba(85,214,255,0.13), transparent 22%), radial-gradient(circle at 12% 0%, rgba(36,99,235,0.06), transparent 24%), linear-gradient(180deg, rgba(11,17,25,0.98), rgba(8,12,18,0.99))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
};

const dropzoneBodyStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  alignContent: 'space-between',
  flex: '1 1 520px'
};

const dropzoneActionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  alignContent: 'space-between',
  width: 240,
  padding: 14,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.012))',
  border: '1px solid rgba(255,255,255,0.045)'
};

const kindSwitcherStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.024)',
  border: '1px solid rgba(255,255,255,0.05)',
  width: 'fit-content'
};

const dropzoneAssistRailStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const dropzoneAssistTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 9px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  color: '#d9ebf8',
  fontSize: 11,
  fontWeight: 700
};

const metaMetricStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '8px 10px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.05)',
  background: 'rgba(255,255,255,0.02)'
};

const compactMetaPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: '11px 13px 13px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.01)',
  border: '1px solid rgba(255,255,255,0.03)'
};

const studioSideRailStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  position: 'sticky',
  top: 16
};

const railCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(12,16,23,0.56), rgba(9,12,18,0.8))',
  border: '1px solid rgba(255,255,255,0.032)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.018)'
};

const outputTagsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const outputTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)',
  color: '#e2f7ff',
  fontSize: 12,
  fontWeight: 700
};

const focusedStageStyle: React.CSSProperties = {
  display: 'grid'
};

const stagePanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 20,
  background:
    'radial-gradient(circle at top right, rgba(85,214,255,0.1), transparent 22%), linear-gradient(180deg, rgba(11,16,23,0.98), rgba(8,12,18,0.98))',
  border: '1px solid rgba(255,255,255,0.06)'
};

const stageHeroStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  alignItems: 'flex-start',
  flexWrap: 'wrap'
};

const stageControlsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  alignItems: 'end'
};

const assetStudioStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(11,16,23,0.98), rgba(8,12,18,0.98))',
  border: '1px solid rgba(255,255,255,0.06)'
};

const assetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12
};

const progressPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background:
    'radial-gradient(circle at top right, rgba(85,214,255,0.12), transparent 25%), linear-gradient(180deg, rgba(15,18,25,0.98), rgba(14,18,25,0.98))',
  border: '1px solid rgba(85,214,255,0.1)'
};

const importResultPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 20,
  background:
    'radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 24%), linear-gradient(180deg, rgba(11,16,23,0.98), rgba(8,12,18,0.98))',
  border: '1px solid rgba(34,197,94,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
};

const importResultEyebrowStyle: React.CSSProperties = {
  color: '#9ef0ba',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase'
};

const importResultGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 10
};

const importResultMetricStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.018)',
  border: '1px solid rgba(255,255,255,0.04)'
};

const progressTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 10,
  borderRadius: 999,
  background: 'rgba(30,41,59,0.75)',
  overflow: 'hidden'
};

const progressFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  transition: 'width 240ms ease'
};

const actionCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.01))',
  border: '1px solid rgba(255,255,255,0.05)',
  boxShadow: '0 14px 34px rgba(0,0,0,0.16)'
};

const actionHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.045)'
};

const actionEyebrowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase'
};

const controlTabButtonStyle = (active: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  padding: '8px 12px',
  borderRadius: 12,
  border: active ? '1px solid rgba(85,214,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
  background: active ? 'rgba(85,214,255,0.1)' : 'rgba(255,255,255,0.02)',
  color: active ? '#eefcff' : '#cbd5e1',
  fontWeight: 700
});

const controlSubTabButtonStyle = (active: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  padding: '8px 14px',
  borderRadius: 12,
  border: active ? '1px solid rgba(85,214,255,0.12)' : '1px solid transparent',
  background: active ? 'linear-gradient(180deg, rgba(85,214,255,0.09), rgba(85,214,255,0.03))' : 'transparent',
  color: active ? '#eefcff' : '#94a3b8',
  fontWeight: 700,
  boxShadow: active ? 'inset 0 -1px 0 rgba(85,214,255,0.2)' : 'none'
});

const kindSwitchButtonStyle = (active: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  padding: '7px 11px',
  borderRadius: 999,
  border: active ? '1px solid rgba(85,214,255,0.12)' : '1px solid transparent',
  background: active ? 'linear-gradient(180deg, rgba(85,214,255,0.08), rgba(85,214,255,0.03))' : 'transparent',
  color: active ? '#eefcff' : '#9fb1c6',
  fontSize: 12,
  fontWeight: 700
});

const toneStyles: Record<'violet' | 'emerald' | 'amber' | 'indigo', React.CSSProperties> = {
  violet: {
    background:
      'radial-gradient(circle at top right, rgba(129,140,248,0.12), transparent 22%), linear-gradient(180deg, rgba(12,16,23,0.98), rgba(9,12,18,0.98))'
  },
  emerald: {
    background:
      'radial-gradient(circle at top right, rgba(85,214,255,0.12), transparent 22%), linear-gradient(180deg, rgba(12,16,23,0.98), rgba(9,12,18,0.98))'
  },
  amber: {
    background:
      'radial-gradient(circle at top right, rgba(245,158,11,0.12), transparent 22%), linear-gradient(180deg, rgba(12,16,23,0.98), rgba(9,12,18,0.98))'
  },
  indigo: {
    background:
      'radial-gradient(circle at top right, rgba(96,165,250,0.12), transparent 22%), linear-gradient(180deg, rgba(12,16,23,0.98), rgba(9,12,18,0.98))'
  }
};

function statusPillStyle(tone: 'success' | 'neutral'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 9px',
    borderRadius: 999,
    background: tone === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
    border: tone === 'success' ? '1px solid rgba(34,197,94,0.18)' : '1px solid rgba(255,255,255,0.06)',
    color: tone === 'success' ? '#d1fae5' : '#cbd5e1',
    fontSize: 11,
    fontWeight: 700
  };
}

function noticeBannerStyle(tone: 'success' | 'error' | 'info'): React.CSSProperties {
  const palette =
    tone === 'success'
      ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.18)', color: '#dcfce7' }
      : tone === 'error'
        ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.18)', color: '#fee2e2' }
        : { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.18)', color: '#e0f2fe' };

  return {
    padding: '11px 14px',
    borderRadius: 14,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    color: palette.color,
    fontWeight: 600
  };
}

function stepShellStyle(state: WorkflowStep['state']): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${state === 'active' ? 'rgba(56,189,248,0.22)' : state === 'done' ? 'rgba(34,197,94,0.2)' : state === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
    background:
      state === 'active'
        ? 'rgba(56,189,248,0.1)'
        : state === 'done'
          ? 'rgba(34,197,94,0.08)'
          : state === 'error'
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(255,255,255,0.02)',
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: 700
  };
}

function stepDotStyle(state: WorkflowStep['state']): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    background:
      state === 'active' ? '#38bdf8' : state === 'done' ? '#22c55e' : state === 'error' ? '#ef4444' : '#64748b'
  };
}
