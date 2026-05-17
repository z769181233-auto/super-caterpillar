'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/system/PageShell';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';
import { EmptyState } from '@/components/system/EmptyState';
import { ErrorState } from '@/components/system/ErrorState';
import { useRequestState } from '@/hooks/useRequestState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ProjectsGrid } from './ProjectsGrid';
import { ProjectsHeader } from './ProjectsHeader';
import {
  PROJECT_STATUS_POLL_INTERVAL_MS,
  shouldPollProjects,
} from './project-status-polling';

import { createProject, deleteProject, getProjects } from './api';
import { ProjectCardView } from './adapters';
import { getProjectDetailHref, normalizeCreateProjectPayload } from './project-create-flow';

const projectGridRequestOptions = {
  initialStatus: 'loading' as const,
  isEmpty: (data: ProjectCardView[] | null) => !data || data.length === 0,
};

interface ProjectsGridPageProps {
  initialCreateOpen?: boolean;
}

export function ProjectsGridPage({ initialCreateOpen = false }: ProjectsGridPageProps) {
  const t = useTranslations('Projects');
  const locale = useLocale();
  const router = useRouter();
  const s = useRequestState<ProjectCardView[]>(null, projectGridRequestOptions);
  const { setSuccess, setError } = s;
  const [isCreateOpen, setIsCreateOpen] = useState(initialCreateOpen);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectCardView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProjects = useCallback(() => {
    return getProjects()
      .then((data) => {
        setSuccess(data);
      })
      .catch((err) => {
        setError(err);
      });
  }, [setError, setSuccess]);

  const resetCreateForm = () => {
    setCreateName('');
    setCreateDescription('');
    setCreateError(null);
  };

  const openCreateModal = () => {
    resetCreateForm();
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }
    setIsCreateOpen(false);
    router.replace(`/${locale}/projects`);
    resetCreateForm();
  };

  const openDeleteModal = (project: ProjectCardView) => {
    setProjectPendingDelete(project);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) {
      return;
    }
    setProjectPendingDelete(null);
    setDeleteError(null);
  };

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const payload = normalizeCreateProjectPayload(createName, createDescription);
      const project = await createProject(payload);

      setIsCreateOpen(false);
      router.push(getProjectDetailHref(locale, project.id));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NAME_REQUIRED') {
        setCreateError(t('createModalErrorEmptyName'));
      } else if (error instanceof Error && error.message.trim().length > 0) {
        setCreateError(error.message);
      } else {
        setCreateError(t('createModalErrorGeneric'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!projectPendingDelete) return;

    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteProject(projectPendingDelete.id);
      setProjectPendingDelete(null);
      await loadProjects();
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setDeleteError(error.message);
      } else {
        setDeleteError(t('deleteModalErrorGeneric'));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadProjects()
      .then(() => undefined)
      .catch(() => undefined);
  }, [loadProjects]);

  useEffect(() => {
    if (s.status !== 'success' || !shouldPollProjects(s.data)) {
      return;
    }

    const interval = window.setInterval(() => {
      loadProjects()
        .then(() => undefined)
        .catch(() => undefined);
    }, PROJECT_STATUS_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadProjects, s.data, s.status]);

  return (
    <PageShell
      header={<ProjectsHeader onCreateClick={openCreateModal} />}
      maxWidth="1200px"
    >
      {s.status === 'loading' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <SkeletonBlock key={i} height="200px" />
          ))}
        </div>
      ) : s.status === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={() => void loadProjects()} />
      ) : s.status === 'empty' ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.desc')}
          actionText={t('empty.ctaCreate')}
          onAction={openCreateModal}
        />
      ) : (
        <div className="animate-fade-in">
          <ProjectsGrid projects={s.data || []} isLoading={false} onDeleteClick={openDeleteModal} />
          {s.isPartial && (
            <div style={{ marginTop: '2rem' }}>
              <ErrorState
                error="Some projects failed to load"
                onRetry={() => console.log('retry partial')}
              />
            </div>
          )}
        </div>
      )}

      {projectPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-delete-modal-title"
          onClick={closeDeleteModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(7, 10, 18, 0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: 'var(--r-xl)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <h2
                id="project-delete-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {t('deleteModalTitle')}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {t('deleteModalDesc')}
              </p>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{projectPendingDelete.title}</div>
            </div>

            {deleteError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert variant="warning">{deleteError}</Alert>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={isDeleting}>
                {t('deleteModalCancel')}
              </Button>
              <Button type="button" variant="danger" onClick={handleDeleteSubmit} disabled={isDeleting}>
                {isDeleting ? t('deletingButton') : t('deleteModalConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-create-modal-title"
          onClick={closeCreateModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(7, 10, 18, 0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: 'var(--r-xl)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2
                  id="project-create-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t('createModalTitle')}
                </h2>
              </div>

              <Button variant="ghost" type="button" onClick={closeCreateModal} disabled={isCreating}>
                {t('createModalCancel')}
              </Button>
            </div>

            {createError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert variant="warning">{createError}</Alert>
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <FormField label={t('createModalName')}>
                <Input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder={t('createModalNamePlaceholder')}
                  disabled={isCreating}
                  autoFocus
                  maxLength={200}
                />
              </FormField>

              <FormField label={t('createModalDesc')}>
                <Input
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder={t('createModalDescPlaceholder')}
                  disabled={isCreating}
                  maxLength={1000}
                />
              </FormField>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1rem',
                }}
              >
                <Button type="button" variant="secondary" onClick={closeCreateModal} disabled={isCreating}>
                  {t('createModalCancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isCreating}>
                  {isCreating ? t('creatingButton') : t('createButton')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
