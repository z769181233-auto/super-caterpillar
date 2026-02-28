import React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { ProjectDetailView } from './adapters';
import { TabType } from './ProjectDetailShell';

interface ProjectDetailOverviewProps {
    project: ProjectDetailView;
    onSwitchTab: (tab: TabType) => void;
}

export function ProjectDetailOverview({ project, onSwitchTab }: ProjectDetailOverviewProps) {
    const t = useTranslations('ProjectDetail');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header Area */}
            <Card style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            {project.name}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            ID: {project.id} · Org: {project.organizationId} · Created: {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                        <StatusPill level={project.status === 'RUNNING' ? 'GOLD' : 'DEFAULT'}>
                            {project.status}
                        </StatusPill>
                    </div>
                    <div>
                        {project.stats.buildsCount > 0 ? (
                            <Button variant="primary" onClick={() => onSwitchTab('builds')}>
                                {t('ctaOpenStudio')}
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={() => { }} disabled>
                                {t('ctaImportNovel')}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statsBuilds')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{project.stats.buildsCount}</div>
                </Card>
                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statsAudited')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{project.stats.structuralStatus}</div>
                </Card>
                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statsUpdated')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(project.updatedAt).toLocaleDateString()}</div>
                </Card>
                <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statsUsage', { defaultValue: 'Usage' })}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{project.stats.usage}</div>
                </Card>
            </div>

            {/* Recent Builds */}
            <Card style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                    {t('sectionRecentBuilds')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Placeholder for Recent Builds. Real builds will be fetched in Builds Tab. */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t('mockBuildName', { defaultValue: 'Act 1: Genesis (Beta)' })}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('mockBuildDesc', { defaultValue: 'Click View All to open studio' })}</div>
                        </div>
                        <Button variant="secondary" onClick={() => onSwitchTab('builds')}>{t('ctaViewAll', { defaultValue: 'View All' })}</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export function OverviewAside({ project, onSwitchTab }: ProjectDetailOverviewProps) {
    const t = useTranslations('ProjectDetail');

    return (
        <Card style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                {t('sectionAuditMetering')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t('fingerprintStatus', { defaultValue: 'Fingerprint Status' })}</div>
                    <StatusPill level={project.audit.fingerprintStatus === 'SEALED' ? 'GOLD' : 'DEFAULT'}>
                        {project.audit.fingerprintStatus}
                    </StatusPill>
                </div>
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t('rulesVersion', { defaultValue: 'Rules Version' })}</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{project.audit.rulesVersion}</div>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <Button variant="secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onSwitchTab('evidence')}>
                        {t('ctaExportEvidence')}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
