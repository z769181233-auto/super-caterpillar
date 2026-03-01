'use client';

import React from 'react';
import { ProjectStructureStatsDTO } from '@scu/shared-types';

export function StructureStatsCard({ stats }: { stats: ProjectStructureStatsDTO }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Structure</h3>
        {stats.issues.total > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {stats.issues.total} Issues
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatItem label="Seasons" value={stats.seasons} />
        <StatItem label="Episodes" value={stats.episodes} />
        <StatItem label="Scenes" value={stats.scenes} highlight />
        <StatItem label="Shots" value={stats.shots} />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
        <span>QA Passed: {(100 - (stats.issues.qaFailed / stats.shots) * 100).toFixed(0)}%</span>
        <a href={stats.links.structureView} className="text-blue-600 hover:underline">
          View Tree →
        </a>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg ${highlight ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-orange-900' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
