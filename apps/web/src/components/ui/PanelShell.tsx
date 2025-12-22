'use client';

import React from 'react';

interface PanelShellProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * PanelShell - 统一的面板容器组件
 * 提供：标题区、Body 容器、统一状态块（Loading/Empty/Error）
 * 注意：只做容器，不接任何 API
 */
export function PanelShell({
  title,
  description,
  actions,
  children,
  loading = false,
  empty = false,
  error = null,
  onRetry,
  className = '',
}: PanelShellProps) {
  return (
    <div className={`border border-gray-200 rounded-lg shadow-sm bg-white flex flex-col h-full ${className}`}>
      {/* Header */}
      {(title || actions) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            {title && <h4 className="text-base font-semibold text-gray-800">{title}</h4>}
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-500"></div>
            <p className="mt-4 text-sm text-gray-500">加载中...</p>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 flex flex-col items-center space-y-2">
            <span>{error}</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
              >
                重试
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="text-sm text-gray-500 text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>暂无数据</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

