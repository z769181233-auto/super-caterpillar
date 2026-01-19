'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';
import Link from 'next/link';

// P4 Components
import ShotWall from '@/components/studio/ShotWall';
import DirectorPanel from '@/components/studio/DirectorPanel';
import ProjectStructureTree from '@/components/project/ProjectStructureTree'; // 假设已有或需微调

export default function StudioPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.projectId as string;
  const sceneId = searchParams.get('sceneId');
  const shotId = searchParams.get('shotId');

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 状态下钻
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(sceneId);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(shotId);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await projectApi.getProjectTree(projectId);
      setProject(data);

      // 默认选中
      if (!sceneId && data.seasons?.[0]?.episodes?.[0]?.scenes?.[0]) {
        const firstSceneId = data.seasons[0].episodes[0].scenes[0].id;
        handleSelectScene(firstSceneId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScene = (id: string) => {
    setSelectedSceneId(id);
    setSelectedShotId(null);
    router.replace(`/projects/${projectId}/page-studio?sceneId=${id}`);
  };

  const handleSelectShot = (id: string) => {
    setSelectedShotId(id);
    router.replace(`/projects/${projectId}/page-studio?sceneId=${selectedSceneId}&shotId=${id}`);
  };

  const handleSaveShot = async (id: string, updates: any) => {
    try {
      // 模拟 PATCH 调用，实际应通过 apiClient
      console.log('PATCH Shot:', id, updates);
      // await projectApi.patchShot(id, updates);

      // 内存更新以实现乐观更新效果
      setProject((prev) => {
        const newProject = JSON.parse(JSON.stringify(prev));
        // 递归寻找并更新 shot
        outer: for (const s of newProject.seasons || []) {
          for (const e of s.episodes || []) {
            for (const sc of e.scenes || []) {
              const shot = sc.shots?.find((sh) => sh.id === id);
              if (shot) {
                Object.assign(shot, updates);
                break outer;
              }
            }
          }
        }
        return newProject;
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      alert('Save failed: ' + err.message);
    }
  };

  // 提取当前 Scene 的 Shots
  const currentShots = useMemo(() => {
    if (!project || !selectedSceneId) return [];
    for (const s of project.seasons || []) {
      for (const e of s.episodes || []) {
        const scene = e.scenes?.find((sc) => sc.id === selectedSceneId);
        if (scene) return scene.shots || [];
      }
    }
    return [];
  }, [project, selectedSceneId]);

  const currentShot = useMemo(() => {
    return currentShots.find((s) => s.id === selectedShotId) || null;
  }, [currentShots, selectedShotId]);

  if (loading) return <div className="p-8 text-center">Loading Studio...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 bg-white z-10">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </Link>
          <span className="font-bold text-sm">{project?.name}</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500 text-sm">Studio V3.0</span>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-black text-white text-xs rounded font-bold hover:bg-gray-800">
            Export Video
          </button>
        </div>
      </div>

      {/* Main Grid: 30/50/20 */}
      <div className="flex-1 grid grid-cols-[300px_1fr_320px] overflow-hidden">
        {/* Left: Structure Tree */}
        <div className="border-r overflow-y-auto bg-gray-50">
          <div className="p-4 border-b bg-white italic text-xs text-gray-400 uppercase font-bold tracking-widest">
            Project Structure
          </div>
          {/* 这里复用已有的树或简单重构 */}
          <div className="p-2">
            {project?.seasons?.map((s) => (
              <div key={s.id} className="mb-4">
                <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">
                  Season {s.index}
                </div>
                {s.episodes?.map((e) => (
                  <div key={e.id} className="ml-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-500">
                      Ep {e.index}: {e.name}
                    </div>
                    {e.scenes?.map((sc) => (
                      <div
                        key={sc.id}
                        onClick={() => handleSelectScene(sc.id)}
                        className={`
                            ml-4 px-3 py-1.5 text-xs rounded cursor-pointer mb-1 transition-colors
                            ${selectedSceneId === sc.id ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200 text-gray-600'}
                          `}
                      >
                        Scene {sc.index}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Middle: ShotWall */}
        <div className="border-r relative flex flex-col min-w-0">
          <ShotWall
            shots={currentShots}
            selectedShotId={selectedShotId}
            onSelectShot={handleSelectShot}
          />
        </div>

        {/* Right: DirectorPanel */}
        <div className="bg-white overflow-y-auto">
          <DirectorPanel shot={currentShot} onSave={handleSaveShot} />
        </div>
      </div>
    </div>
  );
}
