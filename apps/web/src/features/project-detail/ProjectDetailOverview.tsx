import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { ProjectDetailView } from './adapters';
import { ProjectDetailTabType } from './project-detail-tabs';

interface ProjectDetailOverviewProps {
  project: ProjectDetailView;
  onSwitchTab: (tab: ProjectDetailTabType) => void;
}

export function ProjectDetailOverview({ project, onSwitchTab }: ProjectDetailOverviewProps) {
  const t = useTranslations('ProjectDetail');
  const locale = useLocale();
  const importHref = `/${locale}/projects/${project.id}/import-novel`;
  const scriptHref = `/${locale}/projects/${project.id}?module=script`;
  const createdAt = formatDateTime(project.createdAt);
  const updatedAt = formatDateTime(project.updatedAt);
  const novelAnalysis = getNovelAnalysisDisplay(project.stats.novelAnalysisStatus, t);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Area */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              {project.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {t('metaId')}: {project.id} · {t('metaOrg')}: {project.organizationId} ·{' '}
              {t('metaCreated')}: {createdAt}
            </p>
            <StatusPill level={project.status === 'RUNNING' ? 'GOLD' : 'DEFAULT'}>
              {project.status}
            </StatusPill>
          </div>
          <div>
            {project.stats.buildsCount > 0 ? (
              <Button variant="primary" onClick={() => onSwitchTab('script')}>
                {t('ctaOpenScriptResults')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => (window.location.href = importHref)}>
                {t('ctaImportNovel')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <Card
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('statsBuilds')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {project.stats.buildsCount}
          </div>
        </Card>
        <Card
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('statsAudited')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {project.stats.structuralStatus}
          </div>
        </Card>
        <Card
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('statsUpdated')}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {updatedAt}
          </div>
        </Card>
        <Card
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('statsNovelAnalysis')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {novelAnalysis.label}
          </div>
        </Card>
      </div>

      <Card style={{ padding: '2rem' }}>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
          }}
        >
          {t('sectionNovelAnalysis')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 1rem' }}>
          {t('sectionNovelAnalysisDesc')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <OverviewMetric label={t('statsNovelJobId')} value={project.stats.latestNovelJobId} />
          <OverviewMetric label={t('statsNovelJobType')} value={project.stats.latestNovelJobType} />
          <OverviewMetric
            label={t('statsNovelUpdatedAt')}
            value={formatDateTime(project.stats.latestNovelJobUpdatedAt)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusPill level={novelAnalysis.level}>{novelAnalysis.label}</StatusPill>
          <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {novelAnalysis.nextAction}
          </span>
        </div>
      </Card>

      <Card style={{ padding: '2rem' }}>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
          }}
        >
          {t('sectionRecentBuilds')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Placeholder for Recent Builds. Real builds will be fetched in Builds Tab. */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {t('truthBuildName')}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('buildDesc')}
              </div>
            </div>
            <Button variant="secondary" onClick={() => (window.location.href = scriptHref)}>
              {t('ctaViewAll')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '0.85rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.3rem' }}>
        {value}
      </div>
    </div>
  );
}

export function OverviewAside({ project, onSwitchTab }: ProjectDetailOverviewProps) {
  const t = useTranslations('ProjectDetail');

  return (
    <Card style={{ padding: '1.5rem' }}>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
        }}
      >
        {t('sectionAuditMetering')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}
          >
            {t('fingerprintStatus')}
          </div>
          <StatusPill level={project.audit.fingerprintStatus === 'SEALED' ? 'GOLD' : 'DEFAULT'}>
            {project.audit.fingerprintStatus}
          </StatusPill>
        </div>
        <div>
          <div
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}
          >
            {t('rulesVersion')}
          </div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {project.audit.rulesVersion}
          </div>
        </div>

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button
            variant="secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onSwitchTab('evidence')}
          >
            {t('ctaExportEvidence')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatDateTime(value: string) {
  if (!value || value === '--') return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNovelAnalysisDisplay(status: string, t: ReturnType<typeof useTranslations>) {
  const normalized = String(status || 'NO_TASK').toUpperCase();

  if (['PENDING', 'QUEUED'].includes(normalized)) {
    return {
      label: t('novelAnalysisPending'),
      nextAction: t('novelAnalysisPendingNext'),
      level: 'DEFAULT' as const,
    };
  }
  if (['RUNNING', 'RETRYING', 'ANALYZING'].includes(normalized)) {
    return {
      label: t('novelAnalysisRunning'),
      nextAction: t('novelAnalysisRunningNext'),
      level: 'GOLD' as const,
    };
  }
  if (['SUCCEEDED', 'SUCCESS', 'DONE', 'COMPLETED'].includes(normalized)) {
    return {
      label: t('novelAnalysisDone'),
      nextAction: t('novelAnalysisDoneNext'),
      level: 'GOLD' as const,
    };
  }
  if (['FAILED', 'ERROR'].includes(normalized)) {
    return {
      label: t('novelAnalysisFailed'),
      nextAction: t('novelAnalysisFailedNext'),
      level: 'ERROR' as const,
    };
  }
  return {
    label: t('novelAnalysisNone'),
    nextAction: t('novelAnalysisNoneNext'),
    level: 'DEFAULT' as const,
  };
}
