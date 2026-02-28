'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProjectsHeader } from './ProjectsHeader';
import { ProjectsGrid } from './ProjectsGrid';
import { DashboardAside } from './DashboardAside';
import { ProjectCardView } from './mock';
import { useTranslations } from 'next-intl';
import { projectApi } from '@/lib/apiClient';
import { adaptProjects } from './adapters';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function ProjectsDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ProjectCardView[]>([]);
    const [error, setError] = useState<string | null>(null);
    const t = useTranslations('Common');

    const fetchProjects = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // Actual fetch from existing API
            const rawProjects = await projectApi.getProjects();
            const mapped = adaptProjects(rawProjects);
            setData(mapped);
        } catch (err: any) {
            console.error('Failed to load projects', err);
            setError(err?.message || 'Failed to load projects. Please check your network.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleCreate = () => {
        alert('Create Project workflow triggered.');
    };

    const handleImport = () => {
        // Scaffold
    };

    if (error) {
        return (
            <DashboardLayout
                header={<ProjectsHeader onCreateClick={handleCreate} />}
                main={
                    <EmptyState
                        title="System Error"
                        description={error}
                        icon={<span style={{ fontSize: '2.5rem' }}>⚠️</span>}
                        action={
                            <Button variant="primary" onClick={() => fetchProjects()}>
                                {t('retry')}
                            </Button>
                        }
                    />
                }
                aside={<DashboardAside />}
            />
        );
    }

    return (
        <DashboardLayout
            header={<ProjectsHeader onCreateClick={handleCreate} />}
            main={
                <ProjectsGrid
                    projects={data}
                    isLoading={isLoading}
                    onCreateClick={handleCreate}
                    onImportClick={handleImport}
                />
            }
            aside={<DashboardAside />}
        />
    );
}
