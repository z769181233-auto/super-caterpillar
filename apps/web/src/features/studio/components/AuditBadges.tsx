// apps/web/src/features/studio/components/AuditBadges.tsx
// P6.4.2: 顶栏审计印章徽章 — Token-only
'use client';

import React from 'react';
import { dict } from '../../../i18n/dict';

type TTable = (typeof dict)['zh'];
type TFunc = <K extends keyof TTable>(key: K, vars?: Record<string, string | number>) => string;

type AuditBadgesProps = {
  /** 是否已完成结构化分析（有 Episodes/Scenes/Shots 则为 true） */
  isStructured?: boolean | null;
  /** 是否经过工业级审计（优先用后端字段；null/undefined 显示 Unknown） */
  isAudited?: boolean | null;
  t: TFunc;
};

/** 徽章状态三态样式 */
function badgeStyle(status: 'true' | 'false' | 'unknown'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
    transition: 'opacity 0.2s',
  };
  if (status === 'true')
    return {
      ...base,
      background: 'var(--gold-tint-05)',
      border: '1px solid var(--gold-weak)',
      color: 'var(--gold-primary)',
    };
  if (status === 'false')
    return {
      ...base,
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-muted)',
      opacity: 0.6,
    };
  // unknown
  return {
    ...base,
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    opacity: 0.4,
    fontStyle: 'italic',
  };
}

function toStatus(val: boolean | null | undefined): 'true' | 'false' | 'unknown' {
  if (val === true) return 'true';
  if (val === false) return 'false';
  return 'unknown';
}

export function AuditBadges({ isStructured, isAudited, t }: AuditBadgesProps) {
  const structStatus = toStatus(isStructured);
  const auditStatus = toStatus(isAudited);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* 结构化徽章 */}
      <span style={badgeStyle(structStatus)} title={`${t('badgeStructured')}: ${structStatus}`}>
        {/* 状态指示点 */}
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: structStatus === 'true' ? 'var(--gold-primary)' : 'var(--text-muted)',
            opacity: structStatus === 'unknown' ? 0.3 : 1,
          }}
        />
        {structStatus === 'unknown' ? '--' : t('badgeStructured')}
      </span>

      {/* 审计徽章 */}
      <span style={badgeStyle(auditStatus)} title={`${t('badgeAudited')}: ${auditStatus}`}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: auditStatus === 'true' ? 'var(--gold-primary)' : 'var(--text-muted)',
            opacity: auditStatus === 'unknown' ? 0.3 : 1,
          }}
        />
        {auditStatus === 'unknown' ? '--' : t('badgeAudited')}
      </span>
    </div>
  );
}
