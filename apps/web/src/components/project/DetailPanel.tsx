'use client';

import React from 'react';
import Link from 'next/link';
import { NovelAnalysisStatus, SeasonNode, EpisodeNode, SceneNode, ShotNode } from '@scu/shared-types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { projectApi } from '@/lib/apiClient';
import { useTranslations } from 'next-intl';

type SelectedNode =
  | { type: 'season'; data: SeasonNode }
  | { type: 'episode'; data: EpisodeNode }
  | { type: 'scene'; data: SceneNode }
  | { type: 'shot'; data: ShotNode }
  | null;

interface DetailPanelProps {
  selectedNode: SelectedNode;
  analysisStatus?: NovelAnalysisStatus | null;
  projectId: string;
}

/**
 * 分析状态映射（UI-only，仅用于 StatusBadge 展示）
 */
function mapAnalysisStatus(status: NovelAnalysisStatus | null | undefined): 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' {
  if (status === 'ANALYZING') return 'RUNNING';
  if (status === 'DONE') return 'SUCCEEDED';
  if (status === 'FAILED') return 'FAILED';
  return 'PENDING';
}

export default function DetailPanel({
  selectedNode,
  analysisStatus,
  projectId,
}: DetailPanelProps) {
  const t = useTranslations('Projects.Detail');
  // 状态：生成中
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerateVideo = async (shotId: string) => {
    try {
      setIsGenerating(true);
      // 调用批量生成 API (Single Shot 也可以视为 Batch 的特例)
      // JOB_TYPE默认为 VIDEO，引擎可选 Luma/Runway，这里暂不指定让后端用默认
      await projectApi.batchGenerate([shotId], 'VIDEO');

      // 简单反馈，后续应接入 Toast
      // alert('视频生成任务已提交，请留意任务列表');
      // 触发一次刷新 (可选)
      window.location.reload(); // 简单粗暴刷新以查看状态变化，实际应回调父组件
    } catch (err: unknown) {
      console.error('Video generation failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`生成失败: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };



  // Helper to calculate Path (e.g. S1 E2 Sc3)
  const calculatePath = (node: SelectedNode): string => {
    if (!node) return '';
    const d = node.data as any;
    const idx = d.index ?? '?';

    if (node.type === 'season') return `S${idx}`;
    if (node.type === 'episode') return `Ep${idx}`; // Ideally S{parent} Ep{idx} but we need parent context. For now just local index.
    if (node.type === 'scene') return `Sc${idx}`;
    if (node.type === 'shot') return `Sh${idx}`;
    return '';
  };

  const renderContent = () => {
    if (!selectedNode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-12" style={{ color: 'hsl(var(--hsl-text-muted))' }}>
          <div className="text-4xl mb-4" style={{ filter: 'grayscale(1)' }}>📋</div>
          <p className="text-sm font-medium">{t('selectNode')}</p>
        </div>
      );
    }

    // Common Header with Type and Path
    const nodeTypeUpper = selectedNode.type.toUpperCase();
    const nodePath = calculatePath(selectedNode);

    const labelStyle = {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: 'hsl(var(--hsl-text-muted))',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em'
    };
    const valueStyle = {
      fontSize: '0.9rem',
      color: 'hsl(var(--hsl-text-main))',
      marginTop: '0.25rem',
      lineHeight: 1.5
    };
    const sectionStyle = { marginBottom: '1.25rem' };

    // Common Meta Section
    const MetaHeader = (
      <div style={{ marginBottom: '1.5rem', background: 'hsla(var(--hsl-bg-deep), 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--hsl-primary))', border: '1px solid hsl(var(--hsl-primary))', padding: '2px 6px', borderRadius: '4px' }}>
            {nodeTypeUpper}
          </span>
          <span style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'hsl(var(--hsl-text-muted))' }}>
            {nodePath}
          </span>
        </div>
      </div>
    );

    if (selectedNode.type === 'season') {
      const s = selectedNode.data;
      return (
        <div className="space-y-4">
          {MetaHeader}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-text-main))' }}>{t('season', { index: s.index ?? '' })}</h3>
            <div style={{ height: '4px', width: '3rem', background: 'hsl(var(--hsl-primary))', borderRadius: '2px', marginTop: '0.5rem' }}></div>
          </div>
          <div className="space-y-3">
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('title')}</span>
              <p style={valueStyle}>{s.title || t('season', { index: s.index ?? '' })}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('desc')}</span>
              <p style={valueStyle}>{s.description || t('noDesc')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('episodes')}</span>
              <p style={{ ...valueStyle, fontFamily: 'monospace', color: 'hsl(var(--hsl-primary))' }}>{s.episodes?.length ?? 0}</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'episode') {
      const e = selectedNode.data;
      return (
        <div className="space-y-4">
          {MetaHeader}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-text-main))' }}>{t('episode', { index: e.index ?? '' })}</h3>
            <div style={{ height: '4px', width: '3rem', background: 'hsl(var(--hsl-secondary))', borderRadius: '2px', marginTop: '0.5rem' }}></div>
          </div>
          <div className="space-y-3">
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('title')}</span>
              <p style={valueStyle}>{e.name || t('noDesc')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('summary')}</span>
              <p style={valueStyle}>{e.summary || t('noSummary')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('scenes')}</span>
              <p style={{ ...valueStyle, fontFamily: 'monospace', color: 'hsl(var(--hsl-secondary))' }}>{e.scenes?.length ?? 0}</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'scene') {
      const sc = selectedNode.data;
      return (
        <div className="space-y-4">
          {MetaHeader}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-text-main))' }}>{t('scene', { index: sc.index ?? '' })}</h3>
            <div style={{ height: '4px', width: '3rem', background: 'hsl(var(--hsl-success))', borderRadius: '2px', marginTop: '0.5rem' }}></div>
          </div>
          <div className="space-y-3">
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('title')}</span>
              <p style={valueStyle}>{sc.title || t('noDesc')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('summary')}</span>
              <p style={valueStyle}>{sc.summary || t('noSummary')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('shots')}</span>
              <p style={{ ...valueStyle, fontFamily: 'monospace', color: 'hsl(var(--hsl-success))' }}>{sc.shots?.length ?? 0}</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === 'shot') {
      const sh = selectedNode.data;
      return (
        <div className="space-y-4">
          {MetaHeader}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-text-main))' }}>{t('shot', { index: sh.index ?? '' })}</h3>
            <div style={{ height: '4px', width: '3rem', background: 'hsl(var(--hsl-brand))', borderRadius: '2px', marginTop: '0.5rem' }}></div>
          </div>
          <div className="space-y-3">
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('title')}</span>
              <p style={valueStyle}>{sh.title || t('noDesc')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('desc')}</span>
              <p style={valueStyle}>{sh.description || t('noDesc')}</p>
            </div>
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('type')}</span>
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: 'hsla(var(--hsl-brand), 0.2)', color: 'hsl(var(--hsl-brand))', fontSize: '0.8rem', marginTop: '4px' }}>
                {sh.type || t('noDesc')}
              </div>
            </div>
            {sh.params && Object.keys(sh.params).length > 0 && (
              <div style={sectionStyle}>
                <span style={labelStyle}>{t('params')}</span>
                <pre style={{ fontSize: '0.75rem', background: 'hsla(var(--hsl-bg-deep), 0.5)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', overflow: 'auto', marginTop: '0.5rem', color: 'hsl(var(--hsl-text-muted))' }}>
                  {JSON.stringify(sh.params, null, 2)}
                </pre>
              </div>
            )}

            {/* Video Generation Trigger */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>

              {/* Show Video Controls if available */}
              {(sh as any).videoUrl ? (
                <div className="space-y-3">
                  <div style={{
                    background: 'black',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    position: 'relative'
                  }}>
                    <video src={(sh as any).videoUrl} controls style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={(sh as any).videoUrl}
                      download
                      style={{ flex: 1, textDecoration: 'none' }}
                    >
                      <button className="button-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        <span>⬇</span> {t('download')}
                      </button>
                    </a>
                    <Link
                      href={`/projects/${projectId}/video?url=${encodeURIComponent((sh as any).videoUrl)}`}
                      style={{ flex: 1, textDecoration: 'none' }}
                    >
                      <button className="button-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        <span>▶</span> {t('playFullscreen')}
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                <button
                  className="button-glow"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'hsl(var(--hsl-brand))',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: isGenerating ? 0.7 : 1
                  }}
                  onClick={() => handleGenerateVideo(sh.id)}
                  disabled={isGenerating}
                >
                  <span>{isGenerating ? '⏳' : '🎬'}</span>
                  {isGenerating ? t('submitting') : t('generateVideo')}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return <p className="text-sm text-gray-500">{t('unknown')}</p>;
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Body */}
      <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </div>
      {/* Bottom */}
      <div style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--glass-border)',
        background: 'hsla(var(--hsl-bg-deep), 0.3)',
        padding: '1rem'
      }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'hsl(var(--hsl-text-main))' }}>{t('statusTitle')}</h4>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: '0.875rem', color: 'hsl(var(--hsl-text-muted))' }}>状态：</span>
          <StatusBadge
            status={mapAnalysisStatus(analysisStatus)}
            showPulse={analysisStatus === 'ANALYZING'}
            size="sm"
          />
        </div>
        <div>
          <Link
            href={`/studio/jobs?projectId=${projectId}&type=NOVEL_ANALYSIS`}
            style={{ fontSize: '0.875rem', color: 'hsl(var(--hsl-primary))', textDecoration: 'none', fontWeight: 500 }}
          >
            {t('viewAll')} →
          </Link>
        </div>
      </div>
    </div>
  );
}

