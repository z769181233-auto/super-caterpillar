'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { KpiStat } from '@/components/ui/KpiStat';
import { useTranslations } from 'next-intl';
import type { ProjectCardView } from './mock';
import { useRouter } from 'next/navigation';

interface ProjectCardProps {
    project: ProjectCardView;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const t = useTranslations('Projects');
    const tCard = useTranslations('Projects.card');
    const router = useRouter();

    // Route strictly to the builds workspace to follow system rules
    const handleOpenStudio = () => {
        // Note: If build ID was present in future API, we'd use it. Setting placeholder project id per requirements.
        router.push(`/projects/${project.id}`);
    };

    const getSystemStatus = () => {
        if (!project.latestBuild) return null;
        const { status, audited, sealed } = project.latestBuild;

        // Convert backend status to SSOT standard levels
        if (sealed) return <StatusPill level="GOLD">{t('status.sealed')}</StatusPill>;
        if (audited) return <StatusPill level="GOLD">{t('status.audited')}</StatusPill>;
        if (status === 'ERROR') return <StatusPill level="ERROR">{t('status.ERROR')}</StatusPill>;
        return <StatusPill level="DEFAULT">{t(`status.${status}`)}</StatusPill>;
    };

    const formattedDate = new Date(project.updatedAt).toLocaleDateString();

    return (
        <Card
            hoverEffect
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}
            onClick={handleOpenStudio}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {project.title}
                </h3>
                {project.latestBuild && (
                    <div>
                        {getSystemStatus()}
                    </div>
                )}
            </div>

            {project.tags && project.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {project.tags.map(tag => (
                        <Badge key={tag}>{tag}</Badge>
                    ))}
                </div>
            )}

            <div style={{ flex: 1 }} />

            {project.stats && (
                <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <KpiStat label={t('stats.seasons')} value={project.stats.seasons} />
                    <KpiStat label={t('stats.episodes')} value={project.stats.episodes} />
                    <KpiStat label={t('stats.scenes')} value={project.stats.scenes} />
                    <KpiStat label={t('stats.shots')} value={project.stats.shots} />
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{tCard('updated')}: {formattedDate}</span>
            </div>
        </Card>
    );
}
