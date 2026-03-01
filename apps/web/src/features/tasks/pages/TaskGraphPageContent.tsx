'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getTaskGraph } from '@/lib/apiClient';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';

function GraphContent() {
    const params = useParams() as { taskId: string };
    const taskId = params.taskId;
    const [graph, setGraph] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!taskId) return;
        getTaskGraph(taskId).then(res => {
            if (res.success) setGraph(res.data);
            setLoading(false);
        });
    }, [taskId]);

    if (loading) return <div className="p-6 text-white bg-[#020617] min-h-screen">Loading...</div>;
    if (!graph) return <div className="p-6 text-white bg-[#020617] min-h-screen">Not found</div>;

    return (
        <div className="p-6 bg-[#020617] min-h-screen text-white">
            <h1 className="text-xl font-bold mb-4">任务关系图: {taskId}</h1>
            <div className="border border-gray-700 rounded p-4 bg-[#0b1120]">
                <pre className="text-xs">{JSON.stringify(graph, null, 2)}</pre>
            </div>
        </div>
    );
}

export function TaskGraphPageContent() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <GraphContent />
        </Suspense>
    );
}
