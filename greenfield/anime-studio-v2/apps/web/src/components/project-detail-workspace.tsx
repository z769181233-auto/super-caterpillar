'use client';

import { useMemo, useState } from 'react';
import type {
  AssetLibraryItem,
  CharacterProfile,
  ConsistencyIssue,
  EpisodeOutline,
  ImportJob,
  NovelImport,
  NovelUploadSession,
  PreviewVideoJob,
  RenderJob,
  SceneScript,
  ShotScript,
  StoredFile,
  VersionRecord
} from '../lib/types';

type WorkspaceTabKey = 'director' | 'delivery' | 'timeline';

export function ProjectDetailWorkspace({
  novel,
  scenes,
  shots,
  episodeOutlines,
  previewJobs,
  renderJobs,
  versions,
  storedFiles,
  importJobs,
  uploadSessions,
  assets,
  characters,
  issues
}: {
  novel?: NovelImport;
  scenes: SceneScript[];
  shots: ShotScript[];
  episodeOutlines: EpisodeOutline[];
  previewJobs: PreviewVideoJob[];
  renderJobs: RenderJob[];
  versions: VersionRecord[];
  storedFiles: StoredFile[];
  importJobs: ImportJob[];
  uploadSessions: NovelUploadSession[];
  assets: AssetLibraryItem[];
  characters: CharacterProfile[];
  issues: ConsistencyIssue[];
}) {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabKey>('director');

  const primaryScene = scenes[0];
  const primaryOutline = episodeOutlines[0];
  const latestPreview = previewJobs[previewJobs.length - 1];
  const latestRender = renderJobs[renderJobs.length - 1];
  const latestVersion = versions[versions.length - 1];
  const chapterMarkers = useMemo(() => novel?.chapters.slice(0, 6) || [], [novel]);

  return (
    <section style={shellStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Director Workspace</div>
          <div style={titleStyle}>导演主画布</div>
          <div style={subtitleStyle}>把分场、补写、镜头建议、资产与交付状态压缩到一块真正可工作的桌面。</div>
        </div>
        <div style={tabRailStyle}>
          <WorkspaceTab label="导演稿" active={workspaceTab === 'director'} onClick={() => setWorkspaceTab('director')} />
          <WorkspaceTab label="交付包" active={workspaceTab === 'delivery'} onClick={() => setWorkspaceTab('delivery')} />
          <WorkspaceTab label="时间线" active={workspaceTab === 'timeline'} onClick={() => setWorkspaceTab('timeline')} />
        </div>
      </div>

      {workspaceTab === 'director' ? (
        <div style={directorLayoutStyle}>
          <div style={scriptPanelStyle}>
            <div style={panelHeadingStyle}>
              <div>
                <div style={panelEyebrowStyle}>Scene Pack</div>
                <div style={panelTitleStyle}>{primaryScene?.title || primaryOutline?.title || novel?.title || '等待原著分析'}</div>
              </div>
              <div style={whiteBadgeStyle}>{primaryScene ? `Scene ${primaryScene.sceneNo}` : '草稿'}</div>
            </div>

            <div style={scriptSummaryStyle}>
              <SummaryBadge label="原著章节" value={novel ? novel.chapterCount.toLocaleString('zh-CN') : '0'} />
              <SummaryBadge label="分场" value={String(scenes.length)} />
              <SummaryBadge label="镜头" value={String(shots.length)} />
            </div>

            <div style={scriptDraftStyle}>
              <div style={scriptBlockStyle}>
                <div style={scriptBlockTitleStyle}>场景建立</div>
                <div style={scriptTextStyle}>
                  {primaryScene?.actionText ||
                    novel?.chapters[0]?.summary ||
                    '原著导入后，这里会自动生成可拍化的场景建立描述，并对环境、动作、氛围与空间关系进行导演级补写。'}
                </div>
              </div>

              <div style={scriptDividerStyle} />

              <div style={scriptColumnsStyle}>
                <div style={scriptMiniBlockStyle}>
                  <div style={scriptBlockTitleStyle}>人物调度</div>
                  <div style={scriptTextStyle}>
                    {primaryScene?.characters.length
                      ? `当前场景角色：${primaryScene.characters.join('、')}。系统已根据场次目标建议出场顺序与站位。`
                      : '等待抽取角色关系与出场层级。'}
                  </div>
                </div>
                <div style={scriptMiniBlockStyle}>
                  <div style={scriptBlockTitleStyle}>情绪与冲突</div>
                  <div style={scriptTextStyle}>
                    {primaryScene?.emotionGoal || primaryScene?.conflictSource || '系统会在这里总结场景情绪目标和冲突源。'}
                  </div>
                </div>
              </div>
            </div>

            <div style={timelineMarkerRailStyle}>
              {chapterMarkers.length > 0 ? (
                chapterMarkers.map((chapter) => (
                  <div key={chapter.id} style={timelineMarkerStyle}>
                    <div style={timelineMarkerDotStyle} />
                    <div style={timelineMarkerTextStyle}>{String(chapter.chapterNo).padStart(2, '0')}</div>
                  </div>
                ))
              ) : (
                <div style={emptyTextStyle}>暂无章节样本</div>
              )}
            </div>
          </div>

          <div style={analysisColumnStyle}>
            <AnalysisCard
              title="剧情钩子"
              description={primaryOutline?.logline || primaryScene?.sceneGoal || '等待结构分析生成剧情钩子。'}
            />
            <AnalysisCard
              title="导演补写"
              description={
                primaryScene
                  ? '已围绕环境、动作、情绪和转场可拍性进行自动补足。'
                  : '导入原著后将自动补足缺失的可视化信息。'
              }
            />
            <AnalysisCard
              title="镜头建议"
              description={
                shots[0]
                  ? `建议起手镜头：${shots[0].shotType} / ${shots[0].cameraAngle} / ${shots[0].cameraMove}`
                  : '镜头建议将在生成分镜后出现在这里。'
              }
            />
            <AnalysisCard
              title="审校风险"
              description={issues[0]?.description || '当前未发现显著断裂风险。'}
              tone={issues.length > 0 ? 'warning' : 'default'}
            />
          </div>

          <div style={inspectorStyle}>
            <InspectorGroup title="源文件" meta={`${storedFiles.length} 个`}>
              {storedFiles.length > 0 ? (
                storedFiles.slice(0, 4).map((file) => <InspectorRow key={file.id} title={file.name} subtitle={file.kind} />)
              ) : (
                <EmptyInline text="暂无已上传文件" />
              )}
            </InspectorGroup>

            <InspectorGroup title="角色主档" meta={`${characters.length} 人`}>
              {characters.length > 0 ? (
                characters.slice(0, 4).map((character) => (
                  <InspectorRow key={character.id} title={character.name} subtitle={character.identitySummary} />
                ))
              ) : (
                <EmptyInline text="暂无角色档案" />
              )}
            </InspectorGroup>

            <InspectorGroup title="一致性检查" meta={`${issues.length} 条`}>
              {issues.length > 0 ? (
                issues.slice(0, 3).map((issue) => (
                  <InspectorRow key={issue.id} title={issue.type} subtitle={issue.suggestion || issue.description} />
                ))
              ) : (
                <EmptyInline text="当前无显著问题" />
              )}
            </InspectorGroup>
          </div>
        </div>
      ) : null}

      {workspaceTab === 'delivery' ? (
        <div style={deliveryGridStyle}>
          <DeliveryPanel title="预演交付">
            <DeliveryMetric label="预演任务" value={String(previewJobs.length)} />
            <DeliveryMetric label="最新状态" value={latestPreview?.status || '未生成'} />
            <DeliveryCopy text={latestPreview?.requestSummary || '生成预演包后，这里会展示最新的交付摘要。'} />
          </DeliveryPanel>

          <DeliveryPanel title="出片任务">
            <DeliveryMetric label="出片队列" value={String(renderJobs.length)} />
            <DeliveryMetric label="最新状态" value={latestRender?.status || '未提交'} />
            <DeliveryCopy text={latestRender?.outputSummary || '提交出片后，这里会展示视频生成状态与输出摘要。'} />
          </DeliveryPanel>

          <DeliveryPanel title="资产与设定">
            <DeliveryMetric label="资产条目" value={String(assets.length)} />
            <DeliveryMetric label="人物设定" value={String(characters.length)} />
            <DeliveryCopy text={assets[0]?.description || '角色设定单、场景板、道具板和风格圣经会统一沉淀在这里。'} />
          </DeliveryPanel>
        </div>
      ) : null}

      {workspaceTab === 'timeline' ? (
        <div style={timelineGridStyle}>
          <TimelinePanel title="版本时间线">
            {versions.length > 0 ? (
              versions
                .slice()
                .reverse()
                .slice(0, 8)
                .map((version) => (
                  <TimelineItem
                    key={version.id}
                    title={`V${version.versionNo} · ${version.action}`}
                    meta={new Date(version.createdAt).toLocaleString('zh-CN')}
                    detail={version.detail}
                  />
                ))
            ) : (
              <EmptyInline text="暂无版本记录" />
            )}
          </TimelinePanel>

          <TimelinePanel title="导入与分片">
            {importJobs.length > 0 || uploadSessions.length > 0 ? (
              <>
                {importJobs.slice().reverse().slice(0, 4).map((job) => (
                  <TimelineItem key={job.id} title={job.title} meta={job.status} detail={job.errorMessage || '导入任务已创建。'} />
                ))}
                {uploadSessions.slice().reverse().slice(0, 4).map((session) => (
                  <TimelineItem
                    key={session.id}
                    title={session.title}
                    meta={`${session.receivedChunks}/${session.totalChunks} 分片`}
                    detail={`状态：${session.status}`}
                  />
                ))}
              </>
            ) : (
              <EmptyInline text="暂无导入会话" />
            )}
          </TimelinePanel>

          <TimelinePanel title="最近更新">
            <TimelineItem
              title="当前工作台状态"
              meta={latestVersion?.stage || 'created'}
              detail="已切换为高级导演桌面布局，后续继续把上传与分析交互收敛到统一体验。"
            />
          </TimelinePanel>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceTab({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={tabStyle(active)}>
      {label}
    </button>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryBadgeStyle}>
      <span style={summaryBadgeLabelStyle}>{label}</span>
      <strong style={summaryBadgeValueStyle}>{value}</strong>
    </div>
  );
}

function AnalysisCard({
  title,
  description,
  tone = 'default'
}: {
  title: string;
  description: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div style={analysisCardStyle(tone)}>
      <div style={analysisTitleStyle(tone)}>{title}</div>
      <div style={analysisTextStyle}>{description}</div>
    </div>
  );
}

function InspectorGroup({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div style={inspectorGroupStyle}>
      <div style={inspectorHeaderStyle}>
        <strong style={inspectorGroupTitleStyle}>{title}</strong>
        <span style={inspectorGroupMetaStyle}>{meta}</span>
      </div>
      <div style={inspectorRowsStyle}>{children}</div>
    </div>
  );
}

function InspectorRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={inspectorRowStyle}>
      <div style={inspectorRowTitleStyle}>{title}</div>
      <div style={inspectorRowSubtitleStyle}>{subtitle}</div>
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div style={emptyInlineStyle}>{text}</div>;
}

function DeliveryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={deliveryPanelStyle}>
      <div style={deliveryTitleStyle}>{title}</div>
      <div style={deliveryStackStyle}>{children}</div>
    </div>
  );
}

function DeliveryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={deliveryMetricStyle}>
      <span style={deliveryMetricLabelStyle}>{label}</span>
      <strong style={deliveryMetricValueStyle}>{value}</strong>
    </div>
  );
}

function DeliveryCopy({ text }: { text: string }) {
  return <div style={deliveryCopyStyle}>{text}</div>;
}

function TimelinePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={timelinePanelStyle}>
      <div style={timelinePanelTitleStyle}>{title}</div>
      <div style={timelinePanelStackStyle}>{children}</div>
    </div>
  );
}

function TimelineItem({
  title,
  meta,
  detail
}: {
  title: string;
  meta: string;
  detail: string;
}) {
  return (
    <div style={timelineItemStyle}>
      <div style={timelineItemHeaderStyle}>
        <strong>{title}</strong>
        <span style={timelineItemMetaStyle}>{meta}</span>
      </div>
      <div style={timelineItemDetailStyle}>{detail}</div>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 32,
  background: 'linear-gradient(180deg, rgba(10,15,24,0.95), rgba(8,12,20,0.96))',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.3)'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'end',
  flexWrap: 'wrap'
};

const eyebrowStyle: React.CSSProperties = {
  color: '#86dfff',
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase'
};

const titleStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 34,
  fontWeight: 900,
  letterSpacing: '-0.05em'
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 6,
  color: 'var(--text-subtle)',
  fontSize: 14,
  lineHeight: 1.8
};

const tabRailStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap'
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: '1px solid',
    borderColor: active ? 'rgba(21,202,255,0.22)' : 'rgba(255,255,255,0.08)',
    background: active ? 'rgba(21,202,255,0.12)' : 'rgba(255,255,255,0.03)',
    color: active ? '#dff6ff' : '#a9bad0',
    padding: '10px 14px',
    borderRadius: 999,
    fontWeight: 700,
    cursor: 'pointer'
  };
}

const directorLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) 320px 240px',
  gap: 16
};

const scriptPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 20,
  borderRadius: 28,
  background: 'rgba(9,15,23,0.9)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const panelHeadingStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'start'
};

const panelEyebrowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const panelTitleStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const whiteBadgeStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.96)',
  color: '#081019',
  fontSize: 12,
  fontWeight: 800
};

const scriptSummaryStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10
};

const summaryBadgeStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const summaryBadgeLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11
};

const summaryBadgeValueStyle: React.CSSProperties = {
  fontSize: 16
};

const scriptDraftStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 28,
  background: 'rgba(244,247,251,0.96)',
  color: '#0f1724',
  boxShadow: '0 24px 60px rgba(0,0,0,0.24)'
};

const scriptBlockStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const scriptBlockTitleStyle: React.CSSProperties = {
  color: '#5d6d82',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const scriptTextStyle: React.CSSProperties = {
  color: '#233143',
  fontSize: 14,
  lineHeight: 1.9
};

const scriptDividerStyle: React.CSSProperties = {
  height: 1,
  background: '#d8e1eb'
};

const scriptColumnsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16
};

const scriptMiniBlockStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const timelineMarkerRailStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap'
};

const timelineMarkerStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  justifyItems: 'center',
  minWidth: 56,
  padding: '10px 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)'
};

const timelineMarkerDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#15caff',
  boxShadow: '0 0 20px rgba(21,202,255,0.7)'
};

const timelineMarkerTextStyle: React.CSSProperties = {
  color: '#dce8f7',
  fontSize: 12,
  fontWeight: 700
};

const analysisColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12
};

function analysisCardStyle(tone: 'default' | 'warning'): React.CSSProperties {
  return {
    display: 'grid',
    gap: 8,
    padding: '18px 18px',
    borderRadius: 22,
    background: 'rgba(12,20,31,0.94)',
    border: `1px solid ${tone === 'warning' ? 'rgba(255,140,107,0.18)' : 'rgba(255,255,255,0.07)'}`,
    boxShadow: '0 18px 40px rgba(0,0,0,0.2)'
  };
}

function analysisTitleStyle(tone: 'default' | 'warning'): React.CSSProperties {
  return {
    color: tone === 'warning' ? '#ffb8a5' : '#8edfff',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase'
  };
}

const analysisTextStyle: React.CSSProperties = {
  color: '#d8e5f6',
  fontSize: 13,
  lineHeight: 1.8
};

const inspectorStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12
};

const inspectorGroupStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)'
};

const inspectorHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center'
};

const inspectorGroupTitleStyle: React.CSSProperties = {
  fontSize: 13
};

const inspectorGroupMetaStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11
};

const inspectorRowsStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8
};

const inspectorRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 5,
  padding: '12px 12px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)'
};

const inspectorRowTitleStyle: React.CSSProperties = {
  color: '#eef5ff',
  fontSize: 13,
  fontWeight: 700
};

const inspectorRowSubtitleStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 12,
  lineHeight: 1.65
};

const emptyInlineStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 12,
  lineHeight: 1.7
};

const emptyTextStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 12
};

const deliveryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16
};

const deliveryPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 20,
  borderRadius: 28,
  background: 'rgba(10,15,24,0.92)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const deliveryTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const deliveryStackStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const deliveryMetricStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)'
};

const deliveryMetricLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 12
};

const deliveryMetricValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800
};

const deliveryCopyStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 13,
  lineHeight: 1.8
};

const timelineGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16
};

const timelinePanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 20,
  borderRadius: 28,
  background: 'rgba(10,15,24,0.92)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const timelinePanelTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const timelinePanelStackStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const timelineItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '14px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)'
};

const timelineItemHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap'
};

const timelineItemMetaStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11
};

const timelineItemDetailStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 13,
  lineHeight: 1.75
};
