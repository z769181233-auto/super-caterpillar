'use client';

import React, { useState } from 'react';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslations } from 'next-intl';
import type { ProjectCardView } from './mock';

interface ProjectsGridProps {
    projects: ProjectCardView[];
    isLoading: boolean;
    onImportClick?: () => void;
    onCreateClick?: () => void;
}

export function ProjectsGrid({ projects, isLoading, onImportClick, onCreateClick }: ProjectsGridProps) {
    const t = useTranslations('Projects');
    const [search, setSearch] = useState('');

    if (isLoading) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height="260px" borderRadius="var(--r-lg)" />
                ))}
            </div>
        );
    }

    if (!projects || projects.length === 0) {
        return (
            <EmptyState
                title={t('empty.title')}
                description={t('empty.desc')}
                icon={<span style={{ fontSize: '2.5rem' }}>🪐</span>}
                action={
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {onImportClick && (
                            <button
                                onClick={onImportClick}
                                style={{
                                    background: 'var(--bg-panel)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--r-md)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('empty.ctaImport')}
                            </button>
                        )}
                        {onCreateClick && (
                            <button
                                onClick={onCreateClick}
                                style={{
                                    background: 'var(--gold)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--r-md)',
                                    border: '1px solid var(--gold)',
                                    color: '#000',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('empty.ctaCreate')}
                            </button>
                        )}
                    </div>
                }
            />
        );
    }

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ maxWidth: '300px' }}>
                <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                    }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {filteredProjects.map(project => (
                    <ProjectCard key={project.id} project={project} />
                ))}
            </div>
        </div>
    );
}
