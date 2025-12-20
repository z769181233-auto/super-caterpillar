/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  seasons?: Season[];
}

interface Season {
  id: string;
  index: number;
  name: string;
  episodes?: Episode[];
}

interface Episode {
  id: string;
  index: number;
  name: string;
  scenes?: Scene[];
}

interface Scene {
  id: string;
  index: number;
  summary?: string;
  shots?: Shot[];
}

interface Shot {
  id: string;
  index: number;
  type: string;
  status: string;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [showCreateEpisode, setShowCreateEpisode] = useState(false);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [showCreateShot, setShowCreateShot] = useState(false);

  const [formData, setFormData] = useState({
    seasonIndex: 1,
    seasonName: '',
    episodeIndex: 1,
    episodeName: '',
    sceneIndex: 1,
    sceneSummary: '',
    shotIndex: 1,
    shotType: 'close_up',
  });

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await projectApi.getProjectTree(projectId);
      setProject(data);
      if (data.seasons && data.seasons.length > 0) {
        setSelectedSeason(data.seasons[0].id);
        if (data.seasons[0].episodes && data.seasons[0].episodes.length > 0) {
          setSelectedEpisode(data.seasons[0].episodes[0].id);
          if (data.seasons[0].episodes[0].scenes && data.seasons[0].episodes[0].scenes.length > 0) {
            setSelectedScene(data.seasons[0].episodes[0].scenes[0].id);
          }
        }
      }
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      } else {
        setError(err.message || '加载项目失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectApi.createSeason(projectId, formData.seasonIndex, formData.seasonName);
      await loadProject();
      setShowCreateSeason(false);
      setFormData({ ...formData, seasonIndex: formData.seasonIndex + 1, seasonName: '' });
    } catch (err: any) {
      setError(err.message || '创建 Season 失败');
    }
  };

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeason) return;
    try {
      await projectApi.createEpisode(selectedSeason, formData.episodeIndex, formData.episodeName);
      await loadProject();
      setShowCreateEpisode(false);
      setFormData({ ...formData, episodeIndex: formData.episodeIndex + 1, episodeName: '' });
    } catch (err: any) {
      setError(err.message || '创建 Episode 失败');
    }
  };

  const handleCreateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEpisode) return;
    try {
      await projectApi.createScene(selectedEpisode, formData.sceneIndex, formData.sceneSummary || undefined);
      await loadProject();
      setShowCreateScene(false);
      setFormData({ ...formData, sceneIndex: formData.sceneIndex + 1, sceneSummary: '' });
    } catch (err: any) {
      setError(err.message || '创建 Scene 失败');
    }
  };

  const handleCreateShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScene) return;
    try {
      await projectApi.createShot(selectedScene, formData.shotIndex, formData.shotType, {});
      await loadProject();
      setShowCreateShot(false);
      setFormData({ ...formData, shotIndex: formData.shotIndex + 1 });
    } catch (err: any) {
      setError(err.message || '创建 Shot 失败');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>加载中...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '2rem' }}>
        <div>项目不存在</div>
      </div>
    );
  }

  const selectedSeasonData = project.seasons?.find((s) => s.id === selectedSeason);
  const selectedEpisodeData = selectedSeasonData?.episodes?.find((e) => e.id === selectedEpisode);
  const selectedSceneData = selectedEpisodeData?.scenes?.find((s) => s.id === selectedScene);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* 左侧项目列表导航 */}
      <div
        style={{
          width: '240px',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
          <Link
            href="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#666',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            ← 返回项目列表
          </Link>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{project.name}</h2>
          {project.description && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: '#666' }}>
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div
            style={{
              margin: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* 四栏结构 */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', padding: '1rem', overflow: 'auto' }}>
          {/* Seasons 列 */}
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Seasons</h3>
              <button
                onClick={() => setShowCreateSeason(true)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + 新增
              </button>
            </div>
            {showCreateSeason && (
              <form
                onSubmit={handleCreateSeason}
                style={{ padding: '0.75rem', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}
              >
                <input
                  type="number"
                  placeholder="Index"
                  value={formData.seasonIndex}
                  onChange={(e) => setFormData({ ...formData, seasonIndex: parseInt(e.target.value) })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.seasonName}
                  onChange={(e) => setFormData({ ...formData, seasonName: e.target.value })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>创建</button>
                  <button type="button" onClick={() => setShowCreateSeason(false)} style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                </div>
              </form>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {project.seasons && project.seasons.length > 0 ? (
                project.seasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => {
                      setSelectedSeason(season.id);
                      if (season.episodes && season.episodes.length > 0) {
                        setSelectedEpisode(season.episodes[0].id);
                        if (season.episodes[0].scenes && season.episodes[0].scenes.length > 0) {
                          setSelectedScene(season.episodes[0].scenes[0].id);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      textAlign: 'left',
                      backgroundColor: selectedSeason === season.id ? '#e3f2fd' : 'transparent',
                      border: selectedSeason === season.id ? '1px solid #0070f3' : '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{season.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Index: {season.index}</div>
                  </button>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.8125rem' }}>暂无 Seasons</div>
              )}
            </div>
          </div>

          {/* Episodes 列 */}
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Episodes</h3>
              {selectedSeason && (
                <button
                  onClick={() => setShowCreateEpisode(true)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  + 新增
                </button>
              )}
            </div>
            {showCreateEpisode && selectedSeason && (
              <form
                onSubmit={handleCreateEpisode}
                style={{ padding: '0.75rem', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}
              >
                <input
                  type="number"
                  placeholder="Index"
                  value={formData.episodeIndex}
                  onChange={(e) => setFormData({ ...formData, episodeIndex: parseInt(e.target.value) })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.episodeName}
                  onChange={(e) => setFormData({ ...formData, episodeName: e.target.value })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>创建</button>
                  <button type="button" onClick={() => setShowCreateEpisode(false)} style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                </div>
              </form>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {selectedSeasonData?.episodes && selectedSeasonData.episodes.length > 0 ? (
                selectedSeasonData.episodes.map((episode) => (
                  <button
                    key={episode.id}
                    onClick={() => {
                      setSelectedEpisode(episode.id);
                      if (episode.scenes && episode.scenes.length > 0) {
                        setSelectedScene(episode.scenes[0].id);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      textAlign: 'left',
                      backgroundColor: selectedEpisode === episode.id ? '#e3f2fd' : 'transparent',
                      border: selectedEpisode === episode.id ? '1px solid #0070f3' : '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{episode.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Index: {episode.index}</div>
                  </button>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.8125rem' }}>
                  {selectedSeason ? '暂无 Episodes' : '请先选择 Season'}
                </div>
              )}
            </div>
          </div>

          {/* Scenes 列 */}
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Scenes</h3>
              {selectedEpisode && (
                <button
                  onClick={() => setShowCreateScene(true)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  + 新增
                </button>
              )}
            </div>
            {showCreateScene && selectedEpisode && (
              <form
                onSubmit={handleCreateScene}
                style={{ padding: '0.75rem', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}
              >
                <input
                  type="number"
                  placeholder="Index"
                  value={formData.sceneIndex}
                  onChange={(e) => setFormData({ ...formData, sceneIndex: parseInt(e.target.value) })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <textarea
                  placeholder="Summary"
                  value={formData.sceneSummary}
                  onChange={(e) => setFormData({ ...formData, sceneSummary: e.target.value })}
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px', minHeight: '60px' }}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>创建</button>
                  <button type="button" onClick={() => setShowCreateScene(false)} style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                </div>
              </form>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {selectedEpisodeData?.scenes && selectedEpisodeData.scenes.length > 0 ? (
                selectedEpisodeData.scenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => setSelectedScene(scene.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      textAlign: 'left',
                      backgroundColor: selectedScene === scene.id ? '#e3f2fd' : 'transparent',
                      border: selectedScene === scene.id ? '1px solid #0070f3' : '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Scene {scene.index}</div>
                    {scene.summary && (
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        {scene.summary}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.8125rem' }}>
                  {selectedEpisode ? '暂无 Scenes' : '请先选择 Episode'}
                </div>
              )}
            </div>
          </div>

          {/* Shots 列 */}
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Shots</h3>
              {selectedScene && (
                <button
                  onClick={() => setShowCreateShot(true)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  + 新增
                </button>
              )}
            </div>
            {showCreateShot && selectedScene && (
              <form
                onSubmit={handleCreateShot}
                style={{ padding: '0.75rem', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}
              >
                <input
                  type="number"
                  placeholder="Index"
                  value={formData.shotIndex}
                  onChange={(e) => setFormData({ ...formData, shotIndex: parseInt(e.target.value) })}
                  required
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                />
                <select
                  value={formData.shotType}
                  onChange={(e) => setFormData({ ...formData, shotType: e.target.value })}
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.8125rem', border: '1px solid #d0d0d0', borderRadius: '4px' }}
                >
                  <option value="close_up">Close Up</option>
                  <option value="wide_shot">Wide Shot</option>
                  <option value="medium_shot">Medium Shot</option>
                </select>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>创建</button>
                  <button type="button" onClick={() => setShowCreateShot(false)} style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                </div>
              </form>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {selectedSceneData?.shots && selectedSceneData.shots.length > 0 ? (
                selectedSceneData.shots.map((shot) => (
                  <div
                    key={shot.id}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Shot {shot.index}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>Type: {shot.type}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Status: {shot.status}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.8125rem' }}>
                  {selectedScene ? '暂无 Shots' : '请先选择 Scene'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

