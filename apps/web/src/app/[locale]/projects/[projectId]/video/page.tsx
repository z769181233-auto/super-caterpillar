'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';
import { Button } from '@/components/_legacy/ui/Button';

export default function VideoPlayerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null); // Store full structure for metadata
  const [videoShot, setVideoShot] = useState<any>(null); // Store found shot details
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFirstVideo();
  }, [params.id]);

  const loadFirstVideo = async () => {
    try {
      setLoading(true);
      const structure = await projectApi.getProjectStructure(params.id);
      setProject(structure);

      // DFS to find video with context tracking
      const findVideo = (
        nodes: any[],
        pathInfo: { season?: any; episode?: any; scene?: any } = {}
      ): { url: string; shot: any; context: any } | null => {
        if (!nodes || !Array.isArray(nodes)) return null;
        for (const node of nodes) {
          // Update context based on node type
          const newPath = { ...pathInfo };
          if (node.type === 'SEASON' || node.type === 'season') newPath.season = node;
          if (node.type === 'EPISODE' || node.type === 'episode') newPath.episode = node;
          if (node.type === 'SCENE' || node.type === 'scene') newPath.scene = node;

          if (node.type === 'SHOT' || node.type === 'shot') {
            let url = node.videoUrl;
            if (!url && node.assets?.some((a: any) => a.type === 'VIDEO')) {
              url = node.assets.find((a: any) => a.type === 'VIDEO').storageKey; // Assume storageKey is URL for MVP
            }

            if (url) {
              return { url, shot: node, context: newPath };
            }
          }

          const children =
            node.children || node.seasons || node.episodes || node.scenes || node.shots || [];
          if (children.length > 0) {
            const found = findVideo(children, newPath);
            if (found) return found;
          }
        }
        return null;
      };

      const rootPayload = (structure as any).tree
        ? [(structure as any).tree]
        : (structure as any).seasons
          ? (structure as any).seasons
          : [structure];
      const found = findVideo(rootPayload);

      if (found) {
        setVideoUrl(found.url);
        // Augment shot with context for display
        setVideoShot({
          ...found.shot,
          seasonIndex: found.context.season?.index,
          episodeIndex: found.context.episode?.index,
          sceneIndex: found.context.scene?.index,
        });
      } else {
        setError('No video found in this project.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">{project?.projectName || 'Project Video'}</h1>
          <p className="text-xs text-gray-400">Project ID: {params.id}</p>
        </div>
        <Button variant="secondary" onClick={() => router.back()}>
          Back to Studio
        </Button>
      </div>

      {/* Main Player Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative bg-zinc-900">
        {/* Info Overlay - Stage 9 Requirement */}
        <div className="absolute top-0 left-0 right-0 p-8 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              {project?.projectName || 'Project Video'}
            </h1>
            <div className="flex gap-4 text-gray-300 text-sm font-mono tracking-wide">
              {videoShot?.episodeIndex && (
                <span className="bg-white/10 px-3 py-1 rounded border border-white/10">
                  EP {videoShot.episodeIndex}
                </span>
              )}
              {videoShot?.sceneIndex && (
                <span className="bg-white/10 px-3 py-1 rounded border border-white/10">
                  SCENE {videoShot.sceneIndex}
                </span>
              )}
              {videoShot?.index && (
                <span className="bg-white/10 px-3 py-1 rounded border border-white/10">
                  SHOT {videoShot.index}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="bg-green-600/90 text-white px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(22,163,74,0.6)] animate-pulse font-medium text-sm flex items-center gap-2">
              ✅ 本次生成结果 (Result)
            </span>
            <span className="text-xs text-gray-500">{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p>Searching for available video...</p>
          </div>
        ) : error ? (
          <div className="text-red-400 bg-red-900/20 p-8 rounded-xl border border-red-900/50 flex flex-col items-center">
            <span className="text-4xl mb-4">⚠️</span>
            {error}
            <div className="mt-6">
              <Button onClick={() => router.push(`/projects/${params.id}`)} variant="primary">
                Back to Project
              </Button>
            </div>
          </div>
        ) : videoUrl ? (
          <div className="w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group border border-gray-800">
            <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
            {/* Optional: Simple Download Button Overlay */}
            <a
              href={videoUrl}
              download
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download"
            >
              ⬇️
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
