'use client';

import React from 'react';
import { ProjectNextActionDTO } from '@scu/shared-types';

export function NextActionCard({
  next,
  onAction,
}: {
  next: ProjectNextActionDTO;
  onAction?: (key: string, href?: string) => void;
}) {
  if (!next || !next.action) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg text-white p-6 relative overflow-hidden">
      {/* Decorator */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>

      <h3 className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-2">
        Recommended Action
      </h3>

      <div className="text-2xl font-bold mb-1">{next.action.label}</div>
      <p className="text-indigo-100 text-sm mb-6 opacity-90 max-w-[90%]">{next.why}</p>

      <div className="flex justify-between items-end">
        <div className="text-xs text-indigo-200">
          {next.estimate && <>Est. Time: {next.estimate.etaSec}s </>}
        </div>

        <button
          disabled={!next.action.canRun}
          onClick={() => onAction?.(next.action.key, next.action.href)}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-transform active:scale-95 ${
            next.action.canRun
              ? 'bg-white text-indigo-600 hover:bg-gray-50'
              : 'bg-white/20 text-white/50 cursor-not-allowed'
          }`}
          title={next.action.disabledReason}
        >
          {next.action.canRun ? 'Execute Now →' : 'Waiting...'}
        </button>
      </div>
    </div>
  );
}
