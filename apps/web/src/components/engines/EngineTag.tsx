'use client';

import React from 'react';

interface EngineTagProps {
  /**
   * 引擎标识（必填）
   */
  engineKey: string;
  /**
   * 引擎版本（可选）
   */
  engineVersion?: string | null;
  /**
   * 适配器名称（可选，用于显示小角标）
   */
  adapterName?: string;
  /**
   * 尺寸大小
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 自定义样式类名
   */
  className?: string;
  /**
   * 是否显示适配器标签
   */
  showAdapter?: boolean;
}

/**
 * S3-C.3: Engine 标签组件
 *
 * 统一展示 engineKey 和 engineVersion
 * 格式：engineKey 主体 + @version 小号灰字（version 为空时只显示 key）
 */
export default function EngineTag({
  engineKey,
  engineVersion,
  adapterName,
  size = 'md',
  className = '',
  showAdapter = false,
}: EngineTagProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1.5',
  };

  const fontClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${sizeClasses[size]} ${className}`}>
      <span className={fontClasses[size]}>{engineKey}</span>
      {engineVersion && (
        <span className={`${fontClasses[size]} text-gray-500`}>@{engineVersion}</span>
      )}
      {showAdapter && adapterName && <span className="text-xs text-gray-400">({adapterName})</span>}
    </span>
  );
}
