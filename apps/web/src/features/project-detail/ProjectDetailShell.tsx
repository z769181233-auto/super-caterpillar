'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProjectDetailView } from './adapters';
import { ProjectDetailOverview, OverviewAside } from './ProjectDetailOverview';
import { ProjectBuildsPanel } from './ProjectBuildsPanel';
import { ProjectEvidencePanel } from './ProjectEvidencePanel';
import { ProjectStructureResultsPanel } from './ProjectStructureResultsPanel';
import { getProjectDetailTabFromModule, ProjectDetailTabType } from './project-detail-tabs';
import { ProjectDetailLayout } from '@/components/layout/ProjectDetailLayout';
import { Button } from '@/components/ui/Button';

interface ProjectDetailShellProps {
  project: ProjectDetailView;
}

export type TabType = ProjectDetailTabType;

export function ProjectDetailShell({ project }: ProjectDetailShellProps) {
  const t = useTranslations('ProjectDetail');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    getProjectDetailTabFromModule(searchParams.get('module'))
  );

  useEffect(() => {
    setActiveTab(getProjectDetailTabFromModule(searchParams.get('module')));
  }, [searchParams]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ProjectDetailOverview project={project} onSwitchTab={setActiveTab} />;
      case 'script':
        return <ProjectStructureResultsPanel projectId={project.id} projectName={project.name} />;
      case 'builds':
        return <ProjectBuildsPanel projectId={project.id} />;
      case 'evidence':
        return <ProjectEvidencePanel projectId={project.id} />;
      default:
        return null;
    }
  };

  const renderAsideContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewAside project={project} onSwitchTab={setActiveTab} />;
      case 'script':
        return null;
      case 'builds':
        return null;
      case 'evidence':
        return null;
      default:
        return null;
    }
  };

  const navItems: { id: TabType; label: string }[] = [
    { id: 'overview', label: t('navOverview') },
    { id: 'script', label: t('navScript') },
    { id: 'builds', label: t('navBuilds') },
    { id: 'evidence', label: t('navEvidence') },
  ];

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ marginBottom: '1.5rem', padding: '0 1rem' }}>
        <Button
          variant="secondary"
          onClick={() => router.push(`/${locale}/projects`)}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          &larr; {t('ctaBackToProjects')}
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push(`/${locale}/projects/${project.id}/studio`)}
          style={{ width: '100%', justifyContent: 'flex-start', marginTop: '0.75rem' }}
        >
          进入新版动漫制作 Studio
        </Button>
      </div>
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              background: isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              padding: '0.75rem 1rem',
              borderRadius: 'var(--r-md)',
              textAlign: 'left',
              border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const asideContent = renderAsideContent();

  return <ProjectDetailLayout sidebar={sidebar} main={renderMainContent()} aside={asideContent} />;
}
