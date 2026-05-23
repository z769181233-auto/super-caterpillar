'use client';

import type { ProductionStateDTO } from '@scu/shared-types';

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
  const canContinue = Boolean(state && state.riskFlags.length === 0);

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
        <p style={{ color: canContinue ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          是否可继续下一步：{canContinue ? '可继续' : '需要补齐缺失能力'}
        </p>
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
        {panelTitle('镜头台本门槛')}
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
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
        </div>
      </section>
    </aside>
  );
}
