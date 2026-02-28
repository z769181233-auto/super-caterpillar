import React from 'react';
import { getProjectDetail } from '@/features/project-detail/api';
import { ProjectDetailShell } from '@/features/project-detail/ProjectDetailShell';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params: { locale, projectId } }: { params: { locale: string; projectId: string } }) {
  const t = await getTranslations({ locale, namespace: 'ProjectDetail' });
  return {
    title: `${t('navOverview')} - ${projectId} | Super Caterpillar Studio`,
  };
}

export default async function ProjectDetailPage({ params: { projectId } }: { params: { projectId: string } }) {
  try {
    const project = await getProjectDetail(projectId);

    if (!project || project.status === 'UNKNOWN') {
      return notFound();
    }

    return <ProjectDetailShell project={project} />;
  } catch (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Failed to load project details for {projectId}.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }
}
