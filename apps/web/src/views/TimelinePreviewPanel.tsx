/**
 * apps/web/src/views/TimelinePreviewPanel.tsx
 *
 * Studio Timeline Preview Panel
 * 功能：发起预览、轮询状态、视频回显、下载透传
 * 策略：非侵入式扩展 (P1-2)
 */

import React, { useState, useEffect } from 'react';
import { startTimelinePreview, pollJobStatus } from '../adapters/studio-preview.adapter';
import { JobDTO } from '@/types/dto';

interface TimelinePreviewPanelProps {
  projectId: string;
  timelineData: any;
  apiKey: string;
  apiSecret: string;
}

type PreviewStatus =
  | 'IDLE'
  | 'STARTING'
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REPLAY_TEST_4004';

export const TimelinePreviewPanel: React.FC<TimelinePreviewPanelProps> = ({
  projectId,
  timelineData,
  apiKey,
  apiSecret,
}) => {
  const [status, setStatus] = useState<PreviewStatus>('IDLE');
  const [job, setJob] = useState<JobDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | number | null>(null);

  const handleStartPreview = async () => {
    try {
      setStatus('STARTING');
      setError(null);
      setErrorCode(null);

      // 发起请求 (HMAC v1.1 内部完成)
      const response = await startTimelinePreview(apiKey, apiSecret, timelineData);

      setStatus('PENDING');

      // 开始轮询
      const finishedJob = await pollJobStatus(response.jobId);

      setJob(finishedJob);
      setStatus(finishedJob.status as PreviewStatus);
    } catch (err: any) {
      console.error('Preview failed:', err);
      setError(err.message || '预览请求失败');
      setErrorCode(err.code || err.status || 'UNKNOWN');

      // 如果触发了 4004，由于是硬性规约回归，显式标记以便审计
      if (err.code === '4004' || err.status === 403) {
        setStatus('REPLAY_TEST_4004');
      } else {
        setStatus('FAILED');
      }
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Timeline Preview (CE11)</h2>
        <span
          className={`px-3 py-1 rounded text-xs font-mono ${
            status === 'SUCCEEDED'
              ? 'bg-green-600'
              : status === 'FAILED'
                ? 'bg-red-600'
                : status === 'REPLAY_TEST_4004'
                  ? 'bg-orange-600'
                  : 'bg-blue-600'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="space-y-4">
        {status === 'IDLE' && (
          <button
            onClick={handleStartPreview}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors"
          >
            发起渲染预览
          </button>
        )}

        {(status === 'STARTING' || status === 'PENDING' || status === 'RUNNING') && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
            <p className="text-slate-400">正在与云端同步并渲染 ({status})...</p>
          </div>
        )}

        {status === 'SUCCEEDED' && job?.result?.videoUrl && (
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded overflow-hidden border border-slate-700">
              <video
                src={job.result.videoUrl}
                controls
                className="w-full h-full"
                poster={job.result.posterUrl}
              />
            </div>
            <div className="flex space-x-2">
              <a
                href={job.result.videoUrl}
                download
                className="flex-1 text-center py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                下载 MP4 资产
              </a>
              <button
                onClick={() => setStatus('IDLE')}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded text-sm"
              >
                重新预览
              </button>
            </div>
          </div>
        )}

        {(status === 'FAILED' || status === 'REPLAY_TEST_4004') && (
          <div className="p-4 bg-red-900/30 border border-red-900 rounded">
            <p className="text-red-400 font-bold">渲染失败</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
            <div className="mt-3 pt-3 border-t border-red-900/50 flex justify-between items-center">
              <span className="text-xs font-mono text-red-500">Error: {errorCode}</span>
              <button
                onClick={() => setStatus('IDLE')}
                className="text-xs text-red-400 hover:underline"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-800">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
          Auth Strategy: HMAC v1.1 | Nonce Protection: Hard Enabled
        </p>
      </div>
    </div>
  );
};
