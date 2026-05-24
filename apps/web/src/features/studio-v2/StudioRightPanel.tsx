'use client';

import type { ProductionStateDTO } from '@scu/shared-types';
import {
  getFirstTextPipelineBlocker,
  getTextPipelineStages,
  isTextPipelineReady,
} from './studio-state-summary';

interface StudioRightPanelProps {
  state: ProductionStateDTO | null;
}

function panelTitle(text: string) {
  return <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{text}</h3>;
}

export function StudioRightPanel({ state }: StudioRightPanelProps) {
  const legacy = state?.legacyDataSummary;
  const coverage = legacy?.sceneCandidateCoverage;
  const shotScriptGate = state?.shotScriptQualityGate;
  const shotStage = state?.stages.find((stage) => stage.key === 'shot_script_ready');
  const storyboardStage = state?.stages.find((stage) => stage.key === 'storyboard_ready');
  const videoPromptStage = state?.stages.find((stage) => stage.key === 'video_prompt_ready');
  const episodeStage = state?.stages.find((stage) => stage.key === 'episodes_ready');
  const directorStage = state?.stages.find((stage) => stage.key === 'director_script_ready');
  const textPipelineStages = state ? getTextPipelineStages(state) : [];
  const firstTextBlocker = state ? getFirstTextPipelineBlocker(state) : null;
  const textPipelineReady = state ? isTextPipelineReady(state) : false;

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
      <section>
        {panelTitle('质量 / 风险')}
        <p style={{ color: 'var(--text-secondary)' }}>
          {state ? `当前阶段：${state.currentStage}` : '正在读取生产状态'}
        </p>
        <p style={{ color: textPipelineReady ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          文本链路是否完成：{textPipelineReady ? '已完成到 ShotScript' : '仍有文本阶段阻断'}
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>
          是否可继续下一步：
          {firstTextBlocker
            ? `先处理 ${firstTextBlocker.label}`
            : '只允许进入下一阶段方案设计，不自动进入视觉生成'}
        </p>
      </section>

      <section>
        {panelTitle('文本链路状态')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {textPipelineStages.length ? (
            textPipelineStages.map((stage) => (
              <div key={stage.key}>
                {stage.label}：{stage.status}
              </div>
            ))
          ) : (
            <div>状态读取中</div>
          )}
          <div>
            最早阻断：
            {firstTextBlocker
              ? `${firstTextBlocker.label} - ${firstTextBlocker.missingReason || firstTextBlocker.status}`
              : '无'}
          </div>
          <div>下一步：{firstTextBlocker?.nextAction || '文本链路封板后只做下一阶段方案设计'}</div>
        </div>
      </section>

      <section>
        {panelTitle('当前项目风险')}
        <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
          {(state?.riskFlags || ['状态读取中']).map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      </section>

      <section>
        {panelTitle('缺失能力')}
        <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
          {(state?.missingCapabilities || ['状态读取中']).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        {panelTitle('可用旧资产')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>旧小说：{legacy?.hasNovelSource ? '有' : '无'}</div>
          <div>章节：{legacy?.novelChapterCount ?? '--'}</div>
          <div>旧剧集：{legacy?.episodeCount ?? '--'}</div>
          <div>旧场景：{legacy?.sceneCount ?? '--'}</div>
          <div>旧镜头：{legacy?.shotCount ?? '--'}</div>
        </div>
      </section>

      <section>
        {panelTitle('小说分析质量')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>场景候选状态：{coverage?.coverageStatus || '--'}</div>
          <div>
            可用场景候选：
            {coverage ? `${coverage.usableSceneCandidateCount}/${Math.max(1, coverage.chapterCount)}` : '--'}
          </div>
          <div>缺失能力：{coverage?.missingCapabilities.length ? coverage.missingCapabilities.join('、') : '无'}</div>
          <div>阻断原因：{coverage?.blockerReason || '无'}</div>
        </div>
      </section>

      <section>
        {panelTitle('剧集 / 导演门槛')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>EpisodePlan：{episodeStage?.status || '--'}</div>
          <div>EpisodePlan 阻断：{episodeStage?.missingReason || '无'}</div>
          <div>DirectorScript：{directorStage?.status || '--'}</div>
          <div>DirectorScript 阻断：{directorStage?.missingReason || '无'}</div>
        </div>
      </section>

      <section>
        {panelTitle('镜头台本门槛')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ShotScript：{shotStage?.status || '--'}</div>
          <div>状态：{shotScriptGate?.status || '--'}</div>
          <div>
            镜头候选：
            {shotScriptGate
              ? `${shotScriptGate.candidateShotCount}/${shotScriptGate.minShotCount}`
              : '--'}
          </div>
          <div>
            对白抽取率：
            {shotScriptGate?.dialogueExtractionRate === null || !shotScriptGate
              ? '--'
              : `${Math.round(shotScriptGate.dialogueExtractionRate * 100)}%`}
          </div>
          <div>
            阻断原因：
            {shotScriptGate?.reasons.length ? shotScriptGate.reasons.join('；') : '无'}
          </div>
          <div>下一步：{shotScriptGate?.nextAction || '无'}</div>
          <div>Storyboard：{storyboardStage?.status || '--'}</div>
          <div>VideoPrompt：{videoPromptStage?.status || '--'}</div>
          <div>边界：ShotScript ready 不会自动生成分镜、图片、视频、worker 或 job</div>
        </div>
      </section>
    </aside>
  );
}
