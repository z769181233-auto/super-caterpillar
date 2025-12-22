/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';

interface Project {
  id: string;
  name: string;
  description?: string;
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
  params?: any;
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

  // 创建表单状态
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
      // 使用新的 tree 接口获取完整层级结构
      const data = await projectApi.getProjectTree(projectId);
      setProject(data);
      // 自动选中第一个 season/episode/scene
      if (data.seasons && data.seasons.length > 0) {
        setSelectedSeason(data.seasons[0].id);
        if (data.seasons[0].episodes && data.seasons[0].episodes.length > 0) {
          setSelectedEpisode(data.seasons[0].episodes[0].id);
          if (
            data.seasons[0].episodes[0].scenes &&
            data.seasons[0].episodes[0].scenes.length > 0
          ) {
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
      const season = await projectApi.createSeason(
        projectId,
        formData.seasonIndex,
        formData.seasonName
      );
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
      await projectApi.createEpisode(
        selectedSeason,
        formData.episodeIndex,
        formData.episodeName
      );
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
      await projectApi.createScene(
        selectedEpisode,
        formData.sceneIndex,
        formData.sceneSummary || undefined
      );
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
      await projectApi.createShot(
        selectedScene,
        formData.shotIndex,
        formData.shotType,
        {
          shotType: formData.shotType,
          style: 'realistic',
        }
      );
      await loadProject();
      setShowCreateShot(false);
      setFormData({ ...formData, shotIndex: formData.shotIndex + 1 });
    } catch (err: any) {
      setError(err.message || '创建 Shot 失败');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
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
  const selectedEpisodeData = selectedSeasonData?.episodes?.find(
    (e) => e.id === selectedEpisode
  );
  const selectedSceneData = selectedEpisodeData?.scenes?.find(
    (s) => s.id === selectedScene
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push('/projects')}
          style={{
            padding: '0.5rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← 返回项目列表
        </button>
        <h1>{project.name}</h1>
        {project.description && (
          <p style={{ color: '#666', marginTop: '0.5rem' }}>{project.description}</p>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
        {/* Seasons 列 */}
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3>Seasons</h3>
            <button
              onClick={() => setShowCreateSeason(true)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
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
              style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}
            >
              <input
                type="number"
                placeholder="Index"
                value={formData.seasonIndex}
                onChange={(e) =>
                  setFormData({ ...formData, seasonIndex: parseInt(e.target.value) })
                }
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <input
                type="text"
                placeholder="Name"
                value={formData.seasonName}
                onChange={(e) => setFormData({ ...formData, seasonName: e.target.value })}
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}>创建</button>
                <button
                  type="button"
                  onClick={() => setShowCreateSeason(false)}
                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                >
                  取消
                </button>
              </div>
            </form>
          )}
          {project.seasons && project.seasons.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {project.seasons.map((season) => (
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
                    padding: '0.75rem',
                    textAlign: 'left',
                    backgroundColor: selectedSeason === season.id ? '#e3f2fd' : 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{season.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Index: {season.index}</div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '0.875rem' }}>暂无 Seasons</div>
          )}
        </div>

        {/* Episodes 列 */}
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3>Episodes</h3>
            {selectedSeason && (
              <button
                onClick={() => setShowCreateEpisode(true)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
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
              style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}
            >
              <input
                type="number"
                placeholder="Index"
                value={formData.episodeIndex}
                onChange={(e) =>
                  setFormData({ ...formData, episodeIndex: parseInt(e.target.value) })
                }
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <input
                type="text"
                placeholder="Name"
                value={formData.episodeName}
                onChange={(e) => setFormData({ ...formData, episodeName: e.target.value })}
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}>创建</button>
                <button
                  type="button"
                  onClick={() => setShowCreateEpisode(false)}
                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                >
                  取消
                </button>
              </div>
            </form>
          )}
          {selectedSeasonData?.episodes && selectedSeasonData.episodes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedSeasonData.episodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => {
                    setSelectedEpisode(episode.id);
                    if (episode.scenes && episode.scenes.length > 0) {
                      setSelectedScene(episode.scenes[0].id);
                    }
                  }}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    backgroundColor: selectedEpisode === episode.id ? '#e3f2fd' : 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{episode.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>Index: {episode.index}</div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '0.875rem' }}>
              {selectedSeason ? '暂无 Episodes' : '请先选择 Season'}
            </div>
          )}
        </div>

        {/* Scenes 列 */}
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3>Scenes</h3>
            {selectedEpisode && (
              <button
                onClick={() => setShowCreateScene(true)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
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
              style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}
            >
              <input
                type="number"
                placeholder="Index"
                value={formData.sceneIndex}
                onChange={(e) =>
                  setFormData({ ...formData, sceneIndex: parseInt(e.target.value) })
                }
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <textarea
                placeholder="Summary"
                value={formData.sceneSummary}
                onChange={(e) => setFormData({ ...formData, sceneSummary: e.target.value })}
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem', minHeight: '60px' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}>创建</button>
                <button
                  type="button"
                  onClick={() => setShowCreateScene(false)}
                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                >
                  取消
                </button>
              </div>
            </form>
          )}
          {selectedEpisodeData?.scenes && selectedEpisodeData.scenes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedEpisodeData.scenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id)}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    backgroundColor: selectedScene === scene.id ? '#e3f2fd' : 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Scene {scene.index}</div>
                  {scene.summary && (
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      {scene.summary}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '0.875rem' }}>
              {selectedEpisode ? '暂无 Scenes' : '请先选择 Episode'}
            </div>
          )}
        </div>

        {/* Shots 列 */}
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3>Shots</h3>
            {selectedScene && (
              <button
                onClick={() => setShowCreateShot(true)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
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
              style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}
            >
              <input
                type="number"
                placeholder="Index"
                value={formData.shotIndex}
                onChange={(e) =>
                  setFormData({ ...formData, shotIndex: parseInt(e.target.value) })
                }
                required
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              />
              <select
                value={formData.shotType}
                onChange={(e) => setFormData({ ...formData, shotType: e.target.value })}
                style={{ width: '100%', marginBottom: '0.5rem', padding: '0.25rem' }}
              >
                <option value="close_up">Close Up</option>
                <option value="wide_shot">Wide Shot</option>
                <option value="medium_shot">Medium Shot</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}>创建</button>
                <button
                  type="button"
                  onClick={() => setShowCreateShot(false)}
                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.875rem' }}
                >
                  取消
                </button>
              </div>
            </form>
          )}
          {selectedSceneData?.shots && selectedSceneData.shots.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedSceneData.shots.map((shot) => (
                <div
                  key={shot.id}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Shot {shot.index}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    Type: {shot.type}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Status: {shot.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '0.875rem' }}>
              {selectedScene ? '暂无 Shots' : '请先选择 Scene'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

