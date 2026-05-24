'use client';

import Link from 'next/link';
import type { ProductionStateDTO } from '@scu/shared-types';
import {
  getFirstTextPipelineBlocker,
  getTextPipelineStages,
  isTextPipelineReady,
} from './studio-state-summary';

interface StudioRightPanelProps {
  locale: string;
  projectId: string;
  state: ProductionStateDTO | null;
  stateError?: string | null;
  onRetryState?: () => void;
}

function panelTitle(text: string) {
  return <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{text}</h3>;
}

function compactStatus(status: string | undefined): string {
  if (!status) return '未开始';
  if (status === 'done') return 'READY';
  if (status === 'blocked') return 'BLOCKED';
  if (status === 'missing') return 'MISSING';
  return status.toUpperCase();
}

function readableNextAction(state: ProductionStateDTO | null): string {
  if (!state) return '请确认 API 服务已启动，然后刷新制作状态。';
  const legacy = state.legacyDataSummary;
  if (!legacy.hasStorySource && !legacy.hasNovelSource) return '先导入小说，或等待 AI 原创剧本入口开放。';
  const blocker = getFirstTextPipelineBlocker(state);
  if (!blocker) return '文本链路已完成到 ShotScript；下一阶段只能先做视觉资产方案设计。';
  if (blocker.key === 'story_bible_ready') return '先生成或修复 StoryBible，再继续剧集规划。';
  if (blocker.key === 'episodes_ready') return '先生成或修复第一集 EpisodePlan。';
  if (blocker.key === 'director_script_ready') return '先生成或修复第一集 DirectorScript。';
  if (blocker.key === 'shot_script_ready') return '先生成或修复第一集 ShotScript。';
  return blocker.nextAction || '先处理当前阻断项。';
}

function primaryBlocker(state: ProductionStateDTO | null): string {
  if (!state) return '制作状态暂时不可用';
  const legacy = state.legacyDataSummary;
  if (!legacy.hasStorySource && !legacy.hasNovelSource) return '还没有小说或剧本来源';
  const blocker = getFirstTextPipelineBlocker(state);
  return blocker ? `${blocker.label}：${blocker.missingReason || blocker.status}` : '无';
}

function actionLinkStyle() {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    display: 'block',
    fontWeight: 700,
    padding: '0.75rem',
    textDecoration: 'none',
  };
}

export function StudioRightPanel({ locale, projectId, state, stateError = null, onRetryState }: StudioRightPanelProps) {
  const legacy = state?.legacyDataSummary;
  const shotStage = state?.stages.find((stage) => stage.key === 'shot_script_ready');
  const storyboardStage = state?.stages.find((stage) => stage.key === 'storyboard_ready');
  const videoPromptStage = state?.stages.find((stage) => stage.key === 'video_prompt_ready');
  const textPipelineStages = state ? getTextPipelineStages(state) : [];
  const textPipelineReady = state ? isTextPipelineReady(state) : false;
  const importHref = `/${locale}/projects/${projectId}/import-novel`;

  return (
    <aside
      style={{
        position: 'sticky',
        top: '2rem',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-panel)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {stateError ? (
        <section
          style={{
            border: '1px solid var(--hsl-error)',
            borderRadius: 'var(--r-md)',
            padding: '1rem',
          }}
        >
          {panelTitle('制作状态暂不可用')}
          <p style={{ color: 'var(--text-secondary)' }}>请确认 API 服务已启动，或刷新页面重试。</p>
          <button type="button" onClick={onRetryState} style={{ padding: '0.6rem 0.8rem' }}>
            Retry
          </button>
        </section>
      ) : null}

      <section>
        {panelTitle('下一步')}
        <p style={{ color: 'var(--text-secondary)' }}>
          当前最早 blocker：<strong style={{ color: 'var(--text-primary)' }}>{primaryBlocker(state)}</strong>
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>{readableNextAction(state)}</p>
        {state && !legacy?.hasStorySource && !legacy?.hasNovelSource ? (
          <Link href={importHref} style={actionLinkStyle()}>
            导入小说
          </Link>
        ) : null}
      </section>

      <section>
        {panelTitle('文本链路状态')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {textPipelineStages.length ? (
            textPipelineStages.map((stage) => (
              <div key={stage.key}>
                {stage.label}：{compactStatus(stage.status)}
              </div>
            ))
          ) : (
            <div>{stateError ? '读取失败' : '等待状态'}</div>
          )}
          <div>文本链路：{textPipelineReady ? '已完成到 ShotScript' : '尚未完成'}</div>
        </div>
      </section>

      <section>
        {panelTitle('视觉链路状态')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>Storyboard：{compactStatus(storyboardStage?.status)} / 未开始</div>
          <div>Image：LOCKED / 未开始</div>
          <div>VideoPrompt：{compactStatus(videoPromptStage?.status)} / 未开始</div>
          <div>Video：LOCKED / 未开始</div>
          <div>边界：不会生成分镜、图片、视频，不会启动 worker 或新增 job。</div>
        </div>
      </section>

      <section>
        {panelTitle('来源与风险')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>StorySource：{legacy?.hasStorySource ? '有' : '无'}</div>
          <div>旧 NovelSource：{legacy?.hasNovelSource ? '可兼容' : '无'}</div>
          <div>章节：{legacy?.novelChapterCount ?? '--'}</div>
          <div>风险：{state?.riskFlags?.length ? state.riskFlags[0] : stateError ? '制作状态读取失败' : '无'}</div>
        </div>
      </section>

      <section>
        {panelTitle('镜头台本边界')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ShotScript：{compactStatus(shotStage?.status)}</div>
          <div>storyboard_prompt：文本准备态，不生成图片。</div>
          <div>video_prompt：文本准备态，不调用视频生成。</div>
          <div>worker/job：未创建。</div>
        </div>
      </section>
    </aside>
  );
}
