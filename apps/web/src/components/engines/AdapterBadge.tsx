'use client';

import React from 'react';

interface AdapterBadgeProps {
  /**
   * 适配器名称
   */
  adapterName: string;
  /**
   * 尺寸大小
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 自定义样式类名
   */
  className?: string;
}

/**
 * S3-C.3: 适配器标签组件
 * 
 * 统一展示适配器类型：
 * - HTTP 类：紫色标签（如 http、http_real_*）
 * - Local 类：灰色标签（默认）
 * 
 * 判断规则：基于 adapterName 或 engineKey 简单判断
 * - 包含 "http" 的 → 视为 HTTP 适配器
 * - 否则视为 local
 */
export default function AdapterBadge({
  adapterName,
  size = 'sm',
  className = '',
}: AdapterBadgeProps) {
  // 判断是否为 HTTP 适配器
  const isHttp = adapterName.toLowerCase().includes('http');

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1.5',
  };

  const colorClasses = isHttp
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <span
      className={`inline-flex items-center ${colorClasses} ${sizeClasses[size]} rounded border ${className}`}
    >
      {isHttp ? 'http' : 'local'}
    </span>
  );
}

