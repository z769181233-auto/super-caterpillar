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

function statusText(status: string | undefined): string {
  if (status === 'done') return 'READY';
  if (status === 'blocked') return 'BLOCKED';
  if (status === 'missing') return 'MISSING';
  if (status === 'failed') return 'FAILED';
  return status ? status.toUpperCase() : '未开始';
}

function nextAction(state: ProductionStateDTO | null, hasError: boolean): string {
  if (hasError) return '刷新制作状态，或返回项目页确认登录和权限。';
  if (!state) return '等待制作状态读取完成。';
  if (!state.legacyDataSummary.hasStorySource && !state.legacyDataSummary.hasNovelSource) return '导入小说。';
  const blocker = getFirstTextPipelineBlocker(state);
  if (!blocker) return '文本链路已完成；下一阶段只能进入视觉资产方案设计。';
  if (blocker.key === 'story_bible_ready') return '修复或生成 StoryBible。';
  if (blocker.key === 'episodes_ready') return '修复或生成 EpisodePlan。';
  if (blocker.key === 'director_script_ready') return '修复或生成 DirectorScript。';
  if (blocker.key === 'shot_script_ready') return '修复或生成 ShotScript。';
  return blocker.nextAction || '处理当前阻断项。';
}

function blockerText(state: ProductionStateDTO | null, hasError: boolean): string {
  if (hasError) return '制作状态读取失败';
  if (!state) return '读取中';
  if (!state.legacyDataSummary.hasStorySource && !state.legacyDataSummary.hasNovelSource) return '没有小说或剧本来源';
  const blocker = getFirstTextPipelineBlocker(state);
  return blocker ? blocker.label : '无';
}

export function StudioRightPanel({ locale, projectId, state, stateError = null, onRetryState }: StudioRightPanelProps) {
  const textPipelineStages = state ? getTextPipelineStages(state) : [];
  const textReady = state ? isTextPipelineReady(state) : false;
  const storyboardStage = state?.stages.find((stage) => stage.key === 'storyboard_ready');
  const storyboardReady = storyboardStage?.status === 'done';
  const importHref = `/${locale}/projects/${projectId}/import-novel`;
  const projectHref = `/${locale}/projects/${projectId}`;
  const hasError = Boolean(stateError);

  return (
    <aside style={panelStyle()}>
      <section style={sectionStyle()}>
        <h3 style={titleStyle()}>当前状态</h3>
        <StatusLine label="文本链路" value={textReady ? '完成' : hasError ? '不可用' : '未完成'} strong />
        <StatusLine label="分镜文本层" value={storyboardReady ? 'READY' : '未开始'} />
        <StatusLine label="图片/视频链路" value="未开始" />
      </section>

      <section style={sectionStyle()}>
        <h3 style={titleStyle()}>下一步</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 0 }}>
          {nextAction(state, hasError)}
        </p>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {state && !state.legacyDataSummary.hasStorySource && !state.legacyDataSummary.hasNovelSource ? (
            <Link href={importHref} style={primaryActionStyle()}>
              导入小说
            </Link>
          ) : null}
          {hasError ? (
            <>
              <button type="button" onClick={onRetryState} style={buttonStyle()}>
                刷新制作状态
              </button>
              <Link href={projectHref} style={secondaryActionStyle()}>
                返回项目页
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <section style={sectionStyle()}>
        <h3 style={titleStyle()}>风险</h3>
        <ul style={compactListStyle()}>
          <li>{storyboardReady ? 'StoryboardAsset 只是文本绑定，未生成图片' : '未生成 StoryboardAsset 文本绑定'}</li>
          <li>未生成 Image</li>
          <li>未生成 Video</li>
          <li>未启动 worker/job</li>
        </ul>
      </section>

      <section style={sectionStyle()}>
        <h3 style={titleStyle()}>文本链路</h3>
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          {textPipelineStages.length ? (
            textPipelineStages.map((stage) => (
              <StatusLine key={stage.key} label={stage.label} value={statusText(stage.status)} />
            ))
          ) : (
            <StatusLine label="状态" value={hasError ? '读取失败' : '读取中'} />
          )}
        </div>
      </section>

      <details style={detailsStyle()}>
        <summary>技术详情</summary>
        <div style={{ color: 'var(--text-secondary)', display: 'grid', gap: '0.45rem', marginTop: '0.75rem' }}>
          <div>最早 blocker：{blockerText(state, hasError)}</div>
          <div>projectId：{projectId}</div>
          <div>StorySource：{state?.legacyDataSummary.hasStorySource ? '有' : '无'}</div>
          <div>NovelSource：{state?.legacyDataSummary.hasNovelSource ? '可兼容' : '无'}</div>
          <div>错误：{stateError || '无'}</div>
        </div>
      </details>
    </aside>
  );
}

function StatusLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <strong style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

function panelStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.25rem',
    position: 'sticky',
    top: '2rem',
  };
}

function sectionStyle(): React.CSSProperties {
  return {
    borderBottom: '1px solid var(--border-subtle)',
    display: 'grid',
    gap: '0.75rem',
    paddingBottom: '1rem',
  };
}

function titleStyle(): React.CSSProperties {
  return {
    fontSize: '1rem',
    margin: 0,
  };
}

function compactListStyle(): React.CSSProperties {
  return {
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    margin: 0,
    paddingLeft: '1.2rem',
  };
}

function primaryActionStyle(): React.CSSProperties {
  return {
    background: 'var(--text-primary)',
    borderRadius: 'var(--r-md)',
    color: 'var(--bg-surface)',
    fontWeight: 800,
    padding: '0.75rem',
    textAlign: 'center',
    textDecoration: 'none',
  };
}

function secondaryActionStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    padding: '0.75rem',
    textAlign: 'center',
    textDecoration: 'none',
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0.75rem',
  };
}

function detailsStyle(): React.CSSProperties {
  return {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  };
}
