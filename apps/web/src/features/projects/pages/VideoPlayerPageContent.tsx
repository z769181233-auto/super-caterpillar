'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';
import { Button } from '@/components/_legacy/ui/Button';

export function VideoPlayerPageContent() {
    const router = useRouter();
    const params = useParams() as { projectId: string };
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [project, setProject] = useState<any>(null);
    const [videoShot, setVideoShot] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadFirstVideo();
    }, [params.projectId]);

    const loadFirstVideo = async () => {
        try {
            setLoading(true);
            const structure = await projectApi.getProjectStructure(params.projectId);
            setProject(structure);

            const findVideo = (nodes: any[], pathInfo: { season?: any; episode?: any; scene?: any } = {}): any => {
                if (!nodes || !Array.isArray(nodes)) return null;
                for (const node of nodes) {
                    const newPath = { ...pathInfo };
                    if (node.type === 'SEASON' || node.type === 'season') newPath.season = node;
                    if (node.type === 'EPISODE' || node.type === 'episode') newPath.episode = node;
                    if (node.type === 'SCENE' || node.type === 'scene') newPath.scene = node;
                    if (node.type === 'SHOT' || node.type === 'shot') {
                        let url = node.videoUrl;
                        if (!url && node.assets?.some((a: any) => a.type === 'VIDEO')) {
                            url = node.assets.find((a: any) => a.type === 'VIDEO').storageKey;
                        }
                        if (url) return { url, shot: node, context: newPath };
                    }
                    const children = node.children || node.seasons || node.episodes || node.scenes || node.shots || [];
                    if (children.length > 0) {
                        const found = findVideo(children, newPath);
                        if (found) return found;
                    }
                }
                return null;
            };

            const rootPayload = (structure as any).tree ? [(structure as any).tree] : (structure as any).seasons ? (structure as any).seasons : [structure];
            const found = findVideo(rootPayload);

            if (found) {
                setVideoUrl(found.url);
                setVideoShot({ ...found.shot, seasonIndex: found.context.season?.index, episodeIndex: found.context.episode?.index, sceneIndex: found.context.scene?.index });
            } else {
                setError('No video found in this project.');
            }
        } catch (err: any) {
            setError('Failed to load video.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold">{project?.projectName || 'Project Video'}</h1>
                    <p className="text-xs text-gray-400">Project ID: {params.projectId}</p>
                </div>
                <Button variant="secondary" onClick={() => router.back()}>Back</Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 relative bg-zinc-900">
                {loading ? <div>Loading...</div> : error ? <div className="text-red-400">{error}</div> : videoUrl ? (
                    <video src={videoUrl} controls autoPlay className="max-w-6xl w-full aspect-video" />
                ) : null}
            </div>
        </div>
    );
}
