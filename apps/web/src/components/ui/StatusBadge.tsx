'use client';

import React from 'react';

export type StatusType = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'FORCE_FAILED' | 'QUEUED';

interface StatusBadgeProps {
  status: StatusType | string;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string }> = {
  PENDING: { label: '等待中', color: '#999', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  RUNNING: { label: '执行中', color: '#FF9800', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  SUCCEEDED: { label: '已完成', color: '#4CAF50', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  FAILED: { label: '失败', color: '#F44336', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  CANCELLED: { label: '已取消', color: '#9E9E9E', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  FORCE_FAILED: { label: '强制失败', color: '#D32F2F', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  QUEUED: { label: '排队中', color: '#2196F3', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
};

const sizeClasses = {
  sm: 'w-1.5 h-1.5 text-xs px-2 py-0.5',
  md: 'w-2 h-2 text-sm px-2.5 py-1',
  lg: 'w-2.5 h-2.5 text-base px-3 py-1.5',
};

/**
 * StatusBadge - 统一的状态展示组件
 * 提供：dot + label +（RUNNING 有 pulse）
 */
export function StatusBadge({ status, showPulse = false, size = 'sm', className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;
  const sizeClass = sizeClasses[size];
  const pulseClass = showPulse && status === 'RUNNING' ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClass} ${config.bgColor} ${config.textColor} rounded-full font-medium ${pulseClass} ${className}`}
    >
      <span
        className={`rounded-full ${sizeClass.split(' ')[0]} ${sizeClass.split(' ')[1]}`}
        style={{ backgroundColor: config.color }}
      ></span>
      <span>{config.label}</span>
    </span>
  );
}

