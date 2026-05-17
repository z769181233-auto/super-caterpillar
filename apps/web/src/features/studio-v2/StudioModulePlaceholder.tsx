'use client';

import React, { useEffect, useState } from 'react';
import type { ProductionStateDTO, ProductionStage } from '@scu/shared-types';
import { getStudioProductionState } from './api';
import { StudioLayout } from './StudioLayout';

export interface StudioModuleConfig {
  title: string;
  target: string;
  phase: 'Phase 2' | 'Phase 3' | 'Phase 4';
  stageKey: ProductionStage;
  legacyMapping: (state: ProductionStateDTO) => string;
  missing: string;
  futureOutput: string;
}

interface StudioModulePlaceholderProps {
  locale: string;
  projectId: string;
  config: StudioModuleConfig;
}

export function StudioModulePlaceholder({ locale, projectId, config }: StudioModulePlaceholderProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getStudioProductionState(projectId)
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const stage = state?.stages.find((item) => item.key === config.stageKey);

  return (
    <StudioLayout locale={locale} projectId={projectId} state={state}>
      <section
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-panel)',
          padding: '1.5rem',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Studio v2 只读占位，不伪造已完成结果
        </p>
        <h1 style={{ marginTop: 0 }}>{config.title}</h1>
        {error && <p style={{ color: 'var(--hsl-error)' }}>{error}</p>}
        <div style={{ display: 'grid', gap: '1rem' }}>
          <InfoRow label="当前模块目标" value={config.target} />
          <InfoRow label="当前旧数据可映射情况" value={state ? config.legacyMapping(state) : '读取中'} />
          <InfoRow label="当前缺什么" value={stage?.missingReason || config.missing} />
          <InfoRow label="后续阶段要生成什么" value={`${config.phase}：${config.futureOutput}`} />
          <InfoRow label="当前状态" value={stage ? `${stage.label} / ${stage.status}` : '读取中'} />
        </div>
      </section>
    </StudioLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}
