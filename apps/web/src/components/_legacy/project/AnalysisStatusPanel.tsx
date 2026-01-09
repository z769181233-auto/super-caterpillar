'use client';

import React from 'react';
import Link from 'next/link';
import { NovelAnalysisStatus } from '@scu/shared-types';
import { getAnalysisStatusText } from '@/lib/status';
import { useTranslations } from 'next-intl';

interface AnalysisStatusPanelProps {
  projectName: string;
  analysisStatus?: NovelAnalysisStatus | null;
  analysisUpdatedAt?: string | null;
  jobId?: string | null;
  onImportNovel: () => void;
  onAnalyze: () => void;
  onGenerateStructure: () => void;
  onRefreshStatus: () => void;
  isAnalyzeDisabled?: boolean;
  isGenerateDisabled?: boolean;
  canImportNovel?: boolean;
}

const statusColor = (status?: NovelAnalysisStatus | null) => {
  switch (status) {
    case 'DONE':
      return 'bg-green-100 text-green-800';
    case 'ANALYZING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function AnalysisStatusPanel({
  projectName,
  analysisStatus,
  analysisUpdatedAt,
  jobId,
  onImportNovel,
  onAnalyze,
  onGenerateStructure,
  onRefreshStatus,
  isAnalyzeDisabled = false,
  isGenerateDisabled = false,
  canImportNovel = true,
}: AnalysisStatusPanelProps) {
  const t = useTranslations('Projects.Analysis');
  const isAnalyzing = analysisStatus === 'ANALYZING' || analysisStatus === 'PENDING';

  return (
    <div className="mb-3 rounded-xl border border-[hsl(var(--hsl-border))] bg-[hsl(var(--hsl-card-bg))] p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[hsl(var(--hsl-text-primary))] flex items-center gap-3">
            {projectName}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                analysisStatus === 'DONE'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : analysisStatus === 'ANALYZING'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : analysisStatus === 'FAILED'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
              }`}
            >
              {getAnalysisStatusText(analysisStatus)}
            </span>
          </h2>
          <div className="mt-1 flex items-center gap-4 text-xs text-[hsl(var(--hsl-text-muted))]">
            {jobId && (
              <span className="font-mono opacity-70">
                {t('job', { id: jobId.substring(0, 8) })}
              </span>
            )}
            {analysisUpdatedAt && (
              <span>{t('updated', { time: new Date(analysisUpdatedAt).toLocaleString() })}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canImportNovel && (
            <button
              onClick={onImportNovel}
              className="rounded-lg border border-[hsl(var(--hsl-primary))] bg-[hsla(var(--hsl-primary),0.1)] px-4 py-1.5 text-sm font-semibold text-[hsl(var(--hsl-primary-glow))] hover:bg-[hsla(var(--hsl-primary),0.2)] hover:shadow-[0_0_15px_hsl(var(--hsl-primary-glow)/0.3)] transition-all flex items-center gap-2"
            >
              <span>📚</span>
              {t('import')}
            </button>
          )}

          <button
            onClick={onAnalyze}
            disabled={isAnalyzeDisabled || isAnalyzing}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-2 border ${
              isAnalyzeDisabled || isAnalyzing
                ? 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'
                : 'bg-green-600/20 text-green-400 border-green-500/50 hover:bg-green-600/30 hover:shadow-[0_0_15px_rgba(74,222,128,0.3)]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="animate-spin">⏳</span> {t('analyzing')}
              </>
            ) : (
              <>
                <span>🧠</span> {t('start')}
              </>
            )}
          </button>

          <button
            onClick={onGenerateStructure}
            disabled={isGenerateDisabled}
            className={`rounded-lg border px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-2 ${
              isGenerateDisabled
                ? 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'
                : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-600/30 hover:shadow-[0_0_15px_rgba(129,140,248,0.3)]'
            }`}
          >
            <span>🏗️</span>
            {t('structure')}
          </button>

          <button
            onClick={onRefreshStatus}
            className="rounded-lg border border-[hsl(var(--hsl-border))] bg-white/5 px-3 py-1.5 text-sm text-[hsl(var(--hsl-text-secondary))] hover:bg-white/10 transition-all hover:text-white"
          >
            ↻ {t('refresh')}
          </button>
        </div>
      </div>

      <div className="mt-2 flex justify-between items-center text-xs text-[hsl(var(--hsl-text-muted))]">
        <div>
          {isAnalyzing && (
            <span className="flex items-center gap-2 text-blue-400">
              <span className="animate-pulse">●</span>
              {t('status')}
              {jobId && (
                <Link href="/studio/jobs" className="underline hover:text-blue-300 ml-2">
                  {t('viewJob')}
                </Link>
              )}
            </span>
          )}
        </div>
        <Link
          href="/studio/jobs"
          className="hover:text-[hsl(var(--hsl-primary-glow))] transition-colors border-b border-transparent hover:border-[hsl(var(--hsl-primary-glow))]"
        >
          {t('viewAllJobs')} &rarr;
        </Link>
      </div>
    </div>
  );
}
