'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectSceneGraph, NovelAnalysisStatus, ProjectOverviewDTO } from '@scu/shared-types';
import { projectApi, novelImportApi } from '@/lib/apiClient';
import { OverviewHeader } from '@/components/workbench/overview/OverviewHeader';
import { FlowProgress } from './FlowProgress';
import { NextActionCard } from '@/components/workbench/overview/NextActionCard';
import { StructureStatsCard } from '@/components/workbench/overview/StructureStatsCard';
import { JobMonitor } from '@/components/workbench/overview/JobMonitor';
import * as util from 'util';

interface ProjectOverviewProps {
  project: ProjectSceneGraph;
  analysisStatus: NovelAnalysisStatus | null;
}

export function ProjectOverview({ project, analysisStatus }: ProjectOverviewProps) {
  const router = useRouter();
  const [data, setData] = useState<ProjectOverviewDTO | null>(null);

  const refresh = useCallback(async () => {
    try {
      const overview = await projectApi.getProjectOverview(project.projectId);
      process.stdout.write(util.format('Overview fetched:', overview) + '\n');
      setData(overview);
    } catch (e) {
      process.stderr.write(util.format('Failed to fetch overview:', e) + '\n');
    }
  }, [project.projectId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // 5s polling for robust loop monitoring
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAction = async (key: string, href?: string) => {
    process.stdout.write(util.format('Action triggered:', key, href) + '\n');

    if (href) {
      if (href.startsWith('navigate:')) {
        router.push(href.replace('navigate:', ''));
      } else {
        router.push(href);
      }
      return;
    }

    // Handle keys that are actions (API calls)
    if (key === 'RUN' || key === 'RETRY') {
      // We might need to know which node triggered this, but assuming logic based on current state/context
      // Simplified logic: Check if we are in structure analysis stage implies running analysis
      // ideally specific action handlers should be mapped.
      const currentStepNode =
        data?.flow.nodes.find((n) => n.status === 'RUNNING') ||
        data?.flow.nodes.find((n) => n.status === 'PENDING');
      const currentStepId = currentStepNode?.key;

      if (
        href === 'api:analyze' ||
        (!href && (currentStepId === 'STRUCTURE_ANALYSIS' || currentStepId === 'NOVEL_IMPORT'))
      ) {
        try {
          await novelImportApi.analyzeNovel(project.projectId);
          refresh(); // Immediate refresh
        } catch (e) {
          process.stderr.write(util.format(e) + '\n');
          alert('Failed to start analysis');
        }
      }
    }
  };

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Loading Workspace...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 1. Header (Identity & Status) */}
      <OverviewHeader header={data.header} />

      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {/* 2. Pipeline Progress (Critical Path) */}
        <div className="mb-8">
          <FlowProgress flow={data.flow} onAction={handleAction} />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Seasons" value={project.seasons?.length || 0} icon="📅" />
          {/* ProjectSceneGraph doesn't have counts directly usually, or maybe it does? 
                        Checking 'shared-types' scene-graph.ts from previous context:
                        It has 'seasons'. It does NOT have 'counts'. 
                        So we need to calculate or use 'any'. Using 'any' for speed as requested.
                    */}
          <StatCard
            title="Total Episodes"
            value={(project as any).episodes?.length || 0}
            icon="📺"
          />
          <StatCard
            title="Total Scenes"
            value={(project as any).counts?.scenes || 'N/A'}
            icon="🎬"
          />
          {/* Stage 9: Video Stat Card */}
          <StatCard
            title="Generated Videos"
            value={(project as any).hasVideo ? 'Recently Generated' : '0'}
            icon="🎥"
            highlight={(project as any).hasVideo}
          />
        </div>

        {/* Stage 9: Video Completion Area */}
        {(project as any).hasVideo && (
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-900 to-black border border-gray-800 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">🎬 Video Production Ready</h3>
              <p className="text-gray-400">视频已生成完成，您可以立即观看或发布。</p>
            </div>
            <a
              href={`/projects/${project.projectId}/video`}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all"
            >
              ▶ 看片 (Watch)
            </a>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6 mt-8">
          {/* Left Column: Action & Stats (8 cols) */}
          <div className="col-span-8 flex flex-col gap-6">
            {/* 3. Next Action (Driver) */}
            <NextActionCard next={data.next} onAction={handleAction} />

            {/* 4. Structure Stats */}
            <div className="h-48">
              <StructureStatsCard stats={data.stats} />
            </div>

            {/* 7. Cost & Quality Row (Summary Cards) */}
            <div className="grid grid-cols-2 gap-6">
              {/* Quality Summary */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Quality Gates
                </h3>
                <div className="space-y-3">
                  <QualityRow label="Structure" status={data.quality.structure} />
                  <QualityRow label="Semantic" status={data.quality.semantic} />
                  <QualityRow label="Visual" status={data.quality.visual} />
                </div>
              </div>

              {/* Cost Summary */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Cost Control
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  ${data.cost.total.money?.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  Total Estimate (Including running jobs)
                </div>
                <div className="text-xs bg-gray-50 p-2 rounded text-gray-600">
                  Last 24h: ${data.cost.last24h?.money?.toFixed(2) ?? '0.00'}
                </div>
              </div>
            </div>

            {/* 8. Audit Log (Brief) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Activity
                </h3>
                <a href={data.audit.href} className="text-xs text-blue-600 hover:underline">
                  View All
                </a>
              </div>
              <div className="space-y-3">
                {data.audit.recent.map((log, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-sm border-b last:border-0 border-gray-50 pb-2 last:pb-0"
                  >
                    <div>
                      <span className="font-medium text-gray-700">{log.action}</span>
                      <span className="text-gray-400 mx-2">by</span>
                      <span className="text-gray-600">{log.actor.name}</span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(log.at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {data.audit.recent.length === 0 && (
                  <div className="text-gray-400 text-sm italic">No recent activity</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Job Monitor (4 cols) */}
          <div className="col-span-4 h-full">
            <JobMonitor jobs={data.jobs} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Component: StatCard
function StatCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string;
  value: string | number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-xl shadow-sm border transition-all ${highlight ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-white border-gray-100'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm font-medium">{title}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function QualityRow({ label, status }: { label: string; status: 'OK' | 'WARN' | 'FAIL' }) {
  const colors = {
    OK: 'bg-green-500',
    WARN: 'bg-yellow-500',
    FAIL: 'bg-red-500',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${colors[status]}`}></span>
        <span className="text-xs font-medium text-gray-700">{status}</span>
      </div>
    </div>
  );
}
