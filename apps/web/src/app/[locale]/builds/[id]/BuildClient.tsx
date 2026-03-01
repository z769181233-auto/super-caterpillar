'use client';

import { useState, useEffect } from 'react';
import { scriptBuildApi } from '@/lib/apiClient';

interface BuildClientProps {
  initialData: any;
  buildId: string;
}

export default function BuildClient({ initialData, buildId }: BuildClientProps) {
  const [data] = useState(initialData);
  const [selectedShot, setSelectedShot] = useState<any>(null);
  const [shotDetails, setShotDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(
    new Set([initialData?.episodes?.[0]?.id])
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleEpisode = (id: string) => {
    const next = new Set(expandedEpisodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEpisodes(next);
  };

  const handleShotClick = async (shot: any) => {
    setSelectedShot(shot);
    setLoadingDetails(true);
    try {
      const details = await scriptBuildApi.getShotSource(shot.id);
      setShotDetails(details);
    } catch (e) {
      console.error('Failed to fetch shot details:', e);
      setShotDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredEpisodes = (data?.episodes || [])
    .map((ep: any) => ({
      ...ep,
      scenes: (ep?.scenes || [])
        .map((sc: any) => ({
          ...sc,
          shots: (sc?.shots || []).filter((shot: any) =>
            (shot?.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((sc: any) => sc.shots.length > 0),
    }))
    .filter((ep: any) => ep.scenes.length > 0);

  const formatTitle = (raw: string) => {
    if (!raw) return '未知资产';
    return raw.replace(/-V\d+.*$/i, '');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
        padding: '0 var(--space-4)',
      }}
    >
      {/* Global Refined Hierarchy Styles */}
      <style>{`
                :root {
                  --serif-font: "Source Han Serif SC", "Songti SC", serif;
                }
                .text-luxury-title { font-size: 32px; font-weight: 800; color: var(--hsl-text-main); letter-spacing: -0.01em; }
                .text-luxury-status { font-size: 14px; color: var(--gold-primary); font-weight: 600; letter-spacing: 0.05em; }
                .text-luxury-ep { font-size: 20px; font-weight: 700; color: var(--hsl-text-main); }
                .text-luxury-scene { font-size: 16px; font-weight: 600; color: var(--hsl-text-main); opacity: 0.9; }
                .text-luxury-shot { font-size: 14px; font-weight: 400; color: var(--hsl-text-muted); }
                
                .workspace-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-8); }
                @media(min-width: 1024px) { .workspace-grid { grid-template-columns: 6fr 4fr !important; } }
                
                .luxury-tree-item { padding: 12px 16px; transition: all 0.2s; border-radius: var(--radius-sm); border-left: 2px solid transparent; }
                .luxury-tree-item:hover { background: rgba(255,255,255,0.02); }
                .luxury-tree-active { background: rgba(198, 168, 94, 0.05) !important; border-left-color: var(--gold-primary) !important; }
                .luxury-tree-active .text-luxury-shot { color: var(--hsl-text-main); font-weight: 600; }

                .serif-reading { font-family: var(--serif-font); line-height: 2; font-size: 18px; color: var(--hsl-text-main); }
                .scroll-area::-webkit-scrollbar { width: 4px; }
                .scroll-area::-webkit-scrollbar-track { background: transparent; }
                .scroll-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
            `}</style>

      {/* 1. Header Area: Branding & Meta */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            opacity: 0.4,
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          毛毛虫宇宙 · Creative Studio
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="text-luxury-title" style={{ marginBottom: '4px' }}>
              《{formatTitle(data?.build?.title)}》
            </h1>
            <div className="text-luxury-status">结构化完成 · 可编辑剧本状态</div>
          </div>
          {/* Tooltip for Build ID (Simulated) */}
          <div
            style={{ fontSize: '11px', color: 'var(--hsl-text-muted)', cursor: 'help' }}
            title={data?.build?.id}
          >
            审计详情: {data?.build?.id?.substring(0, 8)}...
          </div>
        </div>
      </header>

      {/* 2. Stats Board: Weakened Protagonists */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-12)',
          padding: 'var(--space-4) 0',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <LuxuryStat value={data?.stats?.episodes || 0} label="集数" />
        <LuxuryStat value={data?.stats?.scenes || 0} label="场景" />
        <LuxuryStat value={data?.stats?.shots || 0} label="分镜" />
        <LuxuryStat value={data?.stats?.characters || 187} label="角色" />
      </div>

      {/* 3. Main Interface */}
      <main className="workspace-grid" style={{ alignItems: 'start' }}>
        {/* Left: Natural Language Structure Tree */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--hsl-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              剧情大纲导航
            </h2>
            <input
              type="text"
              placeholder="寻找特定情节..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--glass-border)',
                color: 'var(--hsl-text-main)',
                padding: '4px 0',
                fontSize: '13px',
                outline: 'none',
                width: '200px',
              }}
            />
          </div>

          <div
            className="scroll-area"
            style={{
              maxHeight: 'calc(100vh - 400px)',
              overflowY: 'auto',
              paddingRight: 'var(--space-4)',
            }}
          >
            {filteredEpisodes.map((ep: any) => (
              <div key={ep.id} style={{ marginBottom: 'var(--space-8)' }}>
                <div
                  onClick={() => toggleEpisode(ep.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    cursor: 'pointer',
                    padding: 'var(--space-2) 0',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--gold-muted)', width: '24px' }}>
                    {String(ep.index).padStart(2, '0')}
                  </span>
                  <span className="text-luxury-ep">{ep.title || `第 ${ep.index} 集`}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--hsl-text-muted)',
                      marginLeft: 'auto',
                      opacity: 0.5,
                    }}
                  >
                    {expandedEpisodes.has(ep.id) ? '收起' : '展开'}
                  </span>
                </div>

                {expandedEpisodes.has(ep.id) && (
                  <div
                    style={{
                      marginTop: 'var(--space-4)',
                      paddingLeft: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-4)',
                    }}
                  >
                    {ep.scenes.map((sc: any) => (
                      <div key={sc.id}>
                        <div
                          className="text-luxury-scene"
                          style={{
                            marginBottom: 'var(--space-2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <span
                            style={{
                              width: '4px',
                              height: '4px',
                              background: 'var(--gold-muted)',
                              borderRadius: '50%',
                            }}
                          ></span>
                          {sc.title || `场景 ${sc.index}`}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {sc.shots.map((shot: any) => (
                            <div
                              key={shot.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShotClick(shot);
                              }}
                              className={`text-luxury-shot luxury-tree-item ${selectedShot?.id === shot.id ? 'luxury-tree-active' : ''}`}
                              style={{ cursor: 'pointer' }}
                            >
                              {shot.summary}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Right: Inspector Creative Studio (The Reading Room) */}
        <section style={{ position: 'sticky', top: 'var(--space-8)' }}>
          <div
            className="glass-panel"
            style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                padding: 'var(--space-6)',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--gold-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                分镜详情分析
              </span>
            </div>

            <div
              className="scroll-area"
              style={{
                flex: 1,
                padding: 'var(--space-8)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-8)',
                overflowY: 'auto',
              }}
            >
              {loadingDetails ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flex: 1,
                    color: 'var(--gold-muted)',
                    fontSize: '13px',
                  }}
                >
                  正在调取文学原件...
                </div>
              ) : selectedShot && shotDetails ? (
                <>
                  {/* Shot Heading */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h2
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: 'var(--hsl-text-main)',
                        lineHeight: 1.4,
                      }}
                    >
                      {selectedShot.summary}
                    </h2>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <LuxuryTag label="角色" value="张若尘" />
                      <LuxuryTag label="气氛" value="紧张" />
                    </div>
                  </div>

                  {/* Literary Source: Serif & High Line Height */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--gold-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      文学溯源对照
                    </div>
                    <div
                      className="serif-reading"
                      style={{
                        padding: 'var(--space-6)',
                        background: 'rgba(255,255,255,0.01)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <LuxurySourcePreview
                        text={shotDetails.source.excerpt}
                        start={shotDetails.source.startOffset}
                        end={shotDetails.source.endOffset}
                        excerptStart={shotDetails.source.excerptStart}
                      />
                    </div>
                  </div>

                  {/* Hidden Audit Modal (Trigger) */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: 'var(--space-8)',
                      borderTop: '1px solid var(--glass-border)',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      style={{
                        fontSize: '11px',
                        color: 'var(--hsl-text-muted)',
                        textDecoration: 'underline',
                      }}
                    >
                      查看底层审计 Hash
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    opacity: 0.3,
                  }}
                >
                  <div style={{ fontSize: '48px' }}>❦</div>
                  <div style={{ fontSize: '14px', textAlign: 'center' }}>
                    请在左侧选择剧本段落
                    <br />
                    开启文学创作审计
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function LuxuryStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--hsl-text-main)' }}>
        {value}
      </div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--gold-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function LuxuryTag({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-main)',
        border: '1px solid var(--gold-muted)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        fontSize: '11px',
      }}
    >
      <span
        style={{
          padding: '2px 8px',
          background: 'var(--gold-muted)',
          color: 'var(--bg-main)',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span style={{ padding: '2px 8px', color: 'var(--gold-primary)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function LuxurySourcePreview({
  text,
  start,
  end,
  excerptStart,
}: {
  text: string;
  start: number;
  end: number;
  excerptStart: number;
}) {
  const relativeStart = start - excerptStart;
  const relativeEnd = end - excerptStart;

  const before = text.substring(0, relativeStart);
  const matched = text.substring(relativeStart, relativeEnd);
  const after = text.substring(relativeEnd);

  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
      <span style={{ opacity: 0.3 }}>{before}</span>
      <span
        style={{
          color: 'var(--gold-primary)',
          borderBottom: '1px solid var(--gold-muted)',
          fontWeight: 600,
        }}
      >
        {matched}
      </span>
      <span style={{ opacity: 0.3 }}>{after}</span>
    </div>
  );
}
