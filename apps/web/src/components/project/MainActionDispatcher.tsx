import React from 'react';
import { useRouter } from 'next/navigation';
import { ProjectStructureTree } from '@scu/shared-types';

interface MainActionDispatcherProps {
    project: ProjectStructureTree;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    canAnalyze: boolean;
}

export const MainActionDispatcher: React.FC<MainActionDispatcherProps> = ({
    project,
    onAnalyze,
    isAnalyzing,
    canAnalyze,
}) => {
    const router = useRouter();
    const { statusSummary, productionStatus, sourceType, projectId } = project;

    // State 1: EMPTY (No Novel)
    // Logic: sourceType === 'NOVEL' but no analysis happened usually means we have source?
    // Actually, ProjectStructureService sets 'sourceType' based on NovelSource existence.
    // If sourceType === 'DEMO', we might skip import.
    // Let's assume if statusSummary.analysis === 'PENDING' and productionStatus === 'IDLE', we might need to import or analyze.

    // Refined Logic based on `ProjectDetailPage` state:
    // We don't have explicit "HasNovel" flag in DTO, but `sourceType` helps.
    // If user can analyze, it means they have imported.

    // ACTION: IMPORT NOVEL
    // If we assume a project created without novel needs import.
    // But currently creation flow forces import? Maybe not.
    // Let's rely on `canAnalyze` passed from parent. If `!canAnalyze` and not analyzing, maybe missing novel?
    // Let's use a simpler heuristic for now: Always allow Import if not analyzing.
    // But we want ONE MAIN ACTION.

    // State Machine as per Requirements

    // 1. Analyzing (High Priority Override)
    if (isAnalyzing || statusSummary?.analysis === 'ANALYZING') {
        return (
            <button disabled className="px-6 py-2 bg-gray-800 text-gray-400 rounded cursor-not-allowed flex items-center gap-2 font-medium">
                <span className="animate-spin">⏳</span>
                分析中...
            </button>
        );
    }

    // 2. Imported but Pending Analysis (Start Point)
    // Condition: Analysis PENDING, Not Empty (implied by canAnalyze)
    if (canAnalyze && statusSummary?.analysis === 'PENDING') {
        return (
            <button
                onClick={onAnalyze}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2"
            >
                <span>▶</span> 开始分析
            </button>
        );
    }

    // 3. Video Generating (Global Video Job Running) (Override Analysis Done)
    // Passed via props as `isVideoGenerating`
    if ((project as any).isVideoGenerating) {
        return (
            <button disabled className="px-6 py-2 bg-gray-800 text-yellow-500 rounded cursor-not-allowed flex items-center gap-2 font-medium">
                <span className="animate-spin">⏳</span>
                视频生成中...
            </button>
        );
    }

    // 4. Video Generated (Has Video) -> Watch
    // Passed via props as `hasVideo`
    if ((project as any).hasVideo) {
        return (
            <button
                onClick={() => router.push(`/projects/${projectId}/video`)}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium shadow-lg hover:shadow-green-500/20 transition-all flex items-center gap-2"
            >
                <span>▶</span> 查看视频
            </button>
        );
    }

    // 5. Analysis Completed -> Generate Video (Default Action if no video yet)
    if (statusSummary?.analysis === 'DONE') {
        return (
            <button
                onClick={() => router.push(`/projects/${projectId}?module=structure`)}
                // Tip: In structure view, user selects shot -> Generate. 
                // This button guides them there.
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium shadow-lg hover:shadow-purple-500/20 transition-all flex items-center gap-2"
            >
                <span>🎬</span> 生成视频
            </button>
        );
    }

    // Fallback / Empty
    return (
        <button disabled className="px-6 py-2 bg-gray-800 text-gray-500 rounded cursor-not-allowed">
            准备就绪
        </button>
    );
};
