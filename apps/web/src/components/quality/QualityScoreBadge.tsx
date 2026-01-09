'use client';

import React from 'react';

interface QualityScoreBadgeProps {
  /**
   * 质量评分（0-1，null 表示无数据）
   */
  score: number | null | undefined;
  /**
   * 置信度（0-1，可选）
   */
  confidence?: number | null;
  /**
   * 是否显示置信度
   */
  showConfidence?: boolean;
  /**
   * 尺寸大小
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 展示变体：badge（标签形式）或 text（文本形式）
   */
  variant?: 'badge' | 'text';
  /**
   * 自定义样式类名
   */
  className?: string;
}

/**
 * S3-C.3: 质量评分标签组件
 *
 * 按设计文档规则对 score 做颜色编码：
 * - score >= 0.8 → 绿色
 * - 0.6 <= score < 0.8 → 橙/黄
 * - score < 0.6 → 红色
 * - score === null/undefined → 灰色（显示 - 或 N/A）
 */
export default function QualityScoreBadge({
  score,
  confidence,
  showConfidence = false,
  size = 'md',
  variant = 'badge',
  className = '',
}: QualityScoreBadgeProps) {
  // 颜色编码逻辑
  const getScoreColor = (scoreValue: number | null | undefined) => {
    if (scoreValue === null || scoreValue === undefined) {
      return {
        text: 'text-gray-500',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
      };
    }
    if (scoreValue >= 0.8) {
      return {
        text: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
      };
    }
    if (scoreValue >= 0.6) {
      return {
        text: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
      };
    }
    return {
      text: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
    };
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1.5',
  };

  const colors = getScoreColor(score);
  const displayScore = score !== null && score !== undefined ? score.toFixed(2) : '-';

  if (variant === 'text') {
    return (
      <span className={`${colors.text} ${className}`}>
        {displayScore}
        {showConfidence && confidence !== null && confidence !== undefined && (
          <span className="text-xs text-gray-500 ml-1">({confidence.toFixed(2)})</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${colors.bg} ${colors.text} ${sizeClasses[size]} rounded font-semibold ${className}`}
    >
      <span>Score: {displayScore}</span>
      {showConfidence && confidence !== null && confidence !== undefined && (
        <span className="text-xs opacity-75">({confidence.toFixed(2)})</span>
      )}
    </span>
  );
}
