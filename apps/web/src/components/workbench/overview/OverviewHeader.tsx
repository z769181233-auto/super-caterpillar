'use client';

import React from 'react';
import { ProjectHeaderDTO } from '@scu/shared-types';

export function OverviewHeader({ header }: { header: ProjectHeaderDTO }) {
  // Status Badge Colors
  const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-600',
    RUNNING: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700',
    FAILED: 'bg-red-100 text-red-700',
    READY: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-gray-100 text-gray-400',
  };

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6">
      <div className="flex justify-between items-start">
        {/* Left: Identity */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{header.name}</h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[header.status]}`}
            >
              {header.status}
            </span>
          </div>
          <div className="flex gap-4 text-sm text-gray-500 font-mono">
            <span>ID: {header.idShort}</span>
            <span>Created: {new Date(header.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(header.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Right: Risk Summary */}
        <div className="flex gap-2">
          {/* Risk Indicators */}
          <RiskBadge label="Quality" status={header.risk.quality} />
          <RiskBadge label="Cost" status={header.risk.cost} />
          <RiskBadge label="Compliance" status={header.risk.compliance} />
        </div>
      </div>

      {/* Blocking Alert */}
      {header.blocking.isBlocked && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-3">
          <span className="text-xl">⛔</span>
          <div>
            <div className="font-semibold text-red-800">Production Blocked</div>
            <div className="text-sm text-red-700 mt-1">
              Currently blocked by: <strong>{header.stage.currentLabel}</strong>. Reason:{' '}
              {header.blocking.reasonDetail || 'Unknown Issue'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskBadge({ label, status }: { label: string; status: 'OK' | 'WARN' | 'FAIL' }) {
  const colors = {
    OK: 'bg-green-50 text-green-700 border-green-200',
    WARN: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    FAIL: 'bg-red-50 text-red-700 border-red-200',
  };
  const icons = { OK: '✓', WARN: '⚠️', FAIL: '❌' };

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status]}`}
    >
      <span>{icons[status]}</span>
      <span>{label}</span>
    </div>
  );
}
