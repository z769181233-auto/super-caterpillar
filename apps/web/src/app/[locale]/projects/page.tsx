'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { projectApi } from '@/lib/apiClient';
import { ProjectCard } from '@/components/project/ProjectCard';
import { Button } from '@/components/_legacy/ui/Button';
import { Input } from '@/components/ui/Input';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  status?: 'READY' | 'RUNNING' | 'ERROR' | 'DONE';
  stats?: {
    seasonsCount?: number;
    scenesCount?: number;
    shotsCount?: number;
  };
  hasVideo?: boolean;
}

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module');

  const t = useTranslations('Projects');
  const tCommon = useTranslations('Common');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  // Helper to check for video existence in structure
  const checkHasVideo = (structure: any): boolean => {
    if (!structure) return false;
    // Helper recursive function
    const scan = (nodes: any[]): boolean => {
      if (!nodes || !Array.isArray(nodes)) return false;
      for (const node of nodes) {
        // If it's a Shot and has videoUrl or assetId indicating video
        if (node.type === 'SHOT' || node.type === 'shot') {
          // Check common places where video url might be
          if (
            node.videoUrl ||
            node.assetId ||
            (node.assets && node.assets.some((a: any) => a.type === 'video'))
          ) {
            return true;
          }
        }
        // Recursively check children
        if (node.children && scan(node.children)) return true;

        // Also check specific arrays if structure is different
        if (node.seasons && scan(node.seasons)) return true;
        if (node.episodes && scan(node.episodes)) return true;
        if (node.scenes && scan(node.scenes)) return true;
        if (node.shots && scan(node.shots)) return true;
      }
      return false;
    };

    // Structure might be the tree root or have 'tree' prop
    if (structure.tree) return scan([structure.tree]);
    // Or if structure itself is the list (unlikely based on type, usually { success, data: root })
    // Based on apiClient, structure is the data object.

    // Try to scan from root children
    if (structure.children) return scan(structure.children);
    // Try to scan seasons directly if it's a flattened structure or specific root
    if (structure.seasons) return scan(structure.seasons);

    return false;
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const projects = await projectApi.getProjects();
      const projectsList = Array.isArray(projects) ? projects : [];

      const projectsWithStats = await Promise.allSettled(
        projectsList.map(async (project: any) => {
          try {
            const structure = await projectApi.getProjectStructure(project.id);
            const hasVideo = checkHasVideo(structure);

            return {
              ...project,
              status: (project.status || 'READY') as 'READY' | 'RUNNING' | 'ERROR' | 'DONE',
              hasVideo, // Pass calculated value
              stats: {
                seasonsCount: structure?.counts?.seasons || 0,
                scenesCount: structure?.counts?.scenes || 0,
                shotsCount: structure?.counts?.shots || 0,
              },
            };
          } catch {
            return {
              ...project,
              status: (project.status || 'READY') as 'READY' | 'RUNNING' | 'ERROR' | 'DONE',
              hasVideo: false,
              stats: { seasonsCount: 0, scenesCount: 0, shotsCount: 0 },
            };
          }
        })
      );

      const finalProjects = projectsWithStats.map((result, index) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              ...projectsList[index],
              status: 'READY' as const,
              hasVideo: false,
              stats: { seasonsCount: 0, scenesCount: 0, shotsCount: 0 },
            }
      );

      setProjects(finalProjects);
    } catch (err: any) {
      const message = err?.message || '';
      if (err?.statusCode === 401 || message.includes('401')) {
        router.push('/login');
      } else {
        setError(message || 'Failed to load projects');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      setError('');
      await projectApi.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });
      await loadProjects();
      setShowCreateForm(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateDemoProject = async () => {
    try {
      setCreatingDemo(true);
      setError('');
      // 调用 Demo Seed Endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/projects/demo-structure`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create demo project');
      }

      const result = await response.json();
      const projectId = result?.data?.projectId;

      if (projectId) {
        // 跳转到 demo 项目页面
        router.push(`/projects/${projectId}`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create demo project');
    } finally {
      setCreatingDemo(false);
    }
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Page Header */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            {t('title')}
          </h1>
          <p style={{ color: 'hsl(var(--hsl-text-muted))' }}>{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleCreateDemoProject}
            disabled={creatingDemo}
            className="animate-fade-in"
          >
            {creatingDemo ? 'Creating...' : 'Import Demo'}
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="animate-fade-in"
          >
            {t('newProject')}
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: 'var(--radius-md)',
            background: 'hsla(var(--hsl-error), 0.1)',
            border: '1px solid hsla(var(--hsl-error), 0.3)',
            color: 'hsl(var(--hsl-error))',
          }}
        >
          {error}
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div
          className="flex-center"
          style={{ minHeight: '400px', flexDirection: 'column', gap: '1rem' }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid hsla(var(--hsl-primary), 0.3)',
              borderTopColor: 'hsl(var(--hsl-primary))',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
          <div style={{ color: 'hsl(var(--hsl-text-muted))' }}>{tCommon('loading')}</div>
        </div>
      ) : projects.length === 0 ? (
        <div
          className="glass-panel flex-center"
          style={{ minHeight: '400px', flexDirection: 'column', gap: '1.5rem' }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'hsla(var(--hsl-bg-surface), 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            🪐
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('emptyTitle')}</h3>
            <p style={{ color: 'hsl(var(--hsl-text-muted))' }}>{t('emptyDesc')}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => setShowCreateForm(true)}>
              {t('newProject')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCreateDemoProject}
              disabled={creatingDemo}
              style={{ opacity: creatingDemo ? 0.6 : 1 }}
            >
              {creatingDemo ? '创建中...' : '创建示例项目 (1/2/6/30)'}
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            animation: 'fadeIn 0.5s ease-out',
          }}
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              createdAt={project.createdAt}
              status={project.status}
              stats={project.stats}
              targetModule={moduleParam}
              hasVideo={project.hasVideo}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowCreateForm(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
              {t('createModalTitle')}
            </h2>
            <form
              onSubmit={handleCreateProject}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              <Input
                label={t('createModalName')}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
                placeholder={t('createModalNamePlaceholder')}
                autoFocus
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label
                  style={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--hsl-text-muted))',
                    fontWeight: 500,
                  }}
                >
                  {t('createModalDesc')}
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  placeholder={t('createModalDescPlaceholder')}
                  className="glass-input" // Utilizing the style from Input component if we made it global, or inline here
                  style={{
                    padding: '0.8rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'hsla(var(--hsl-bg-surface), 0.5)',
                    border: '1px solid var(--glass-border)',
                    color: 'hsl(var(--hsl-text-main))',
                    fontSize: '1rem',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                  style={{ flex: 1 }}
                >
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={creating} style={{ flex: 1 }}>
                  {creating ? t('creatingButton') : t('createButton')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
