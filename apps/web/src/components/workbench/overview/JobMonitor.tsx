'use client';

import React from 'react';
import { ProjectJobsSummaryDTO } from '@scu/shared-types';

// apps/web/src/components/workbench/overview/JobMonitor.tsx
export function JobMonitor({ jobs }: { jobs: ProjectJobsSummaryDTO }) {
  const [showDebug, setShowDebug] = React.useState(false);

  // Filter Logic:
  // If !showDebug, only show high-level jobs (NOVEL_ANALYSIS, VIDEO_RENDER, etc.)
  // Hide SCENE_*, SHOT_*
  const isVisible = (jobType: string) => {
    if (showDebug) return true;
    const lowLevelPrefixes = ['SCENE_', 'SHOT_', 'EPISODE_', 'SEASON_'];
    return !lowLevelPrefixes.some((p) => jobType.startsWith(p));
  };

  const running = jobs.running.filter((j) => isVisible(j.type));
  const failed = jobs.failed.filter((j) => isVisible(j.type));
  // Queued count is just a number, can't filter easily without list.
  // We'll leave queued count as is or hide it if it's 0? The original code just shows count.

  if (running.length === 0 && jobs.queuedCount === 0 && failed.length === 0 && !showDebug) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col items-center justify-center text-gray-400 relative">
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-300 hover:text-blue-500 transition-colors"
            title="Toggle Debug View"
          >
            🐞
          </button>
        </div>
        <div className="text-center">
          <div className="text-2xl mb-2">💤</div>
          <div>Idle System</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Job Monitor
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{showDebug ? 'Debug Mode' : 'User Mode'}</span>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showDebug ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <div
              className={`w-3 h-3 bg-white rounded-full transition-transform ${showDebug ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* Running Jobs */}
        {running.map((job) => (
          <div key={job.id} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-blue-900 text-sm">{job.type}</span>
              <span className="text-xs font-mono text-blue-600">ID: {job.id.slice(0, 6)}</span>
            </div>
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${job.progressPct || 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-blue-700">{job.progressPct}%</span>
            </div>
            <div className="mt-2 text-xs text-blue-400 flex justify-between">
              <span>Worker: {job.workerId}</span>
              <span className="animate-pulse">Running</span>
            </div>
          </div>
        ))}

        {/* Queued */}
        {jobs.queuedCount > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span>Queued Jobs</span>
            </div>
            <span className="font-bold">{jobs.queuedCount}</span>
          </div>
        )}

        {/* Failed */}
        {failed.map((job) => (
          <div
            key={job.id}
            className="bg-red-50 rounded-lg p-3 border border-red-100 flex items-center justify-between text-sm text-red-600"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>Failed: {job.type}</span>
            </div>
            <button className="text-xs bg-white border border-red-200 px-2 py-1 rounded hover:bg-red-50">
              Retry
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
