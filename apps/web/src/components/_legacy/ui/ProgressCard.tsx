'use client';

import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type ProgressCardType = 'episode' | 'scene';

interface ProgressCardProps {
  type: ProgressCardType;
  index: number;
  title: string;
  description?: string | null;
  badgeStatus: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CANCELLED' | 'FORCE_FAILED';
  metrics: Array<{ label: string; value: string }>;
  relativeTime?: string;
  blockers?: Array<{ severity: 'warning' | 'info'; message: string }>;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * ProgressCard - 纯 UI 卡片组件
 * 用于展示 Episode/Scene 的进度、状态、卡点
 * 注意：只负责渲染，不做状态推断、不做 blockers 推断
 */
export function ProgressCard({
  type,
  index,
  title,
  description,
  badgeStatus,
  metrics,
  relativeTime,
  blockers,
  isSelected = false,
  onClick,
  className = '',
}: ProgressCardProps) {
  const typeLabel = type === 'episode' ? 'EP' : 'SC';
  const typeColor = type === 'episode' ? 'purple' : 'green';

  return (
    <div
      className={`
        relative h-[220px] p-5 bg-white rounded-xl shadow-sm border border-gray-200
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-in-out
        cursor-pointer flex flex-col justify-between
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-1 rounded-md ${type === 'episode'
                ? 'text-purple-600 bg-purple-50'
                : 'text-green-600 bg-green-50'
              }`}
          >
            {typeLabel}{index.toString().padStart(2, '0')}
          </span>
          <h4 className="font-bold text-base text-gray-900 line-clamp-1">{title}</h4>
        </div>
        <StatusBadge status={badgeStatus} showPulse={badgeStatus === 'RUNNING'} size="sm" />
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3 flex-1">
          {description}
        </p>
      )}

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="space-y-1 mb-3">
          {metrics.map((metric, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{metric.label}:</span>
              <span className="font-medium text-gray-800">{metric.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Blockers */}
        {blockers && blockers.length > 0 && (
          <div className="flex items-center gap-1.5">
            {blockers.map((blocker, idx) => (
              <span
                key={idx}
                className={`text-xs px-2 py-0.5 rounded-md ${blocker.severity === 'warning'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
              >
                {blocker.message}
              </span>
            ))}
          </div>
        )}
        {/* Relative Time */}
        {relativeTime && (
          <span className="text-xs text-gray-400 ml-auto">{relativeTime}</span>
        )}
      </div>
    </div>
  );
}

