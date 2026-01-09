'use client';

import React, { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  id: string;
  status: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  input?: any;
  output?: any;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

/**
 * DetailDrawer - 统一的详情抽屉组件
 * 信息结构（强制顺序）：
 * 1. Header：标题 + 状态（dot）+ id（可复制）
 * 2. Timeline：createdAt / startedAt / finishedAt
 * 3. Input：JSON 折叠块（默认折叠）
 * 4. Output：JSON 折叠块（默认折叠）
 * 5. Errors：如果有 error 字段，红色块突出（可复制）
 * 6. Actions：Retry / Cancel（沿用现有调用，不改逻辑）
 */
export function DetailDrawer({
  isOpen,
  onClose,
  title,
  id,
  status,
  createdAt,
  startedAt,
  finishedAt,
  input,
  output,
  error,
  onRetry,
  onCancel,
  children,
}: DetailDrawerProps) {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // 可以添加 toast 提示，这里简化
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <StatusBadge status={status} showPulse={status === 'RUNNING'} size="sm" />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ID (可复制) */}
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-gray-800">{id}</code>
              <button
                onClick={() => copyToClipboard(id)}
                className="text-xs text-blue-600 hover:text-blue-800"
                title="复制 ID"
              >
                复制
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Timeline */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">时间线</h4>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>创建时间:</span>
                <span className="font-mono">{formatDate(createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>开始时间:</span>
                <span className="font-mono">{formatDate(startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>完成时间:</span>
                <span className="font-mono">{formatDate(finishedAt)}</span>
              </div>
            </div>
          </div>

          {/* Input */}
          {input && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setInputExpanded(!inputExpanded)}
                className="w-full flex items-center justify-between p-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
              >
                <span>Input</span>
                <svg
                  className={`w-4 h-4 transition-transform ${inputExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {inputExpanded && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <pre className="text-xs font-mono overflow-auto max-h-64 bg-white p-2 rounded border">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Output */}
          {output && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setOutputExpanded(!outputExpanded)}
                className="w-full flex items-center justify-between p-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
              >
                <span>Output</span>
                <svg
                  className={`w-4 h-4 transition-transform ${outputExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {outputExpanded && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <pre className="text-xs font-mono overflow-auto max-h-64 bg-white p-2 rounded border">
                    {JSON.stringify(output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {error && (
            <div className="border border-red-200 rounded-lg bg-red-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-red-800">错误信息</h4>
                <button
                  onClick={() => copyToClipboard(error)}
                  className="text-xs text-red-600 hover:text-red-800"
                  title="复制错误信息"
                >
                  复制
                </button>
              </div>
              <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">{error}</pre>
            </div>
          )}

          {/* Custom Children */}
          {children}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-2 justify-end">
          {onRetry && (status === 'FAILED' || status === 'CANCELLED') && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              重试
            </button>
          )}
          {onCancel && (status === 'PENDING' || status === 'RUNNING') && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
