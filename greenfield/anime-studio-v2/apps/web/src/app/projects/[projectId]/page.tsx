import Link from 'next/link';
import { ProjectActionPanel } from '../../../components/project-action-panel';
import { ProjectDetailWorkspace } from '../../../components/project-detail-workspace';
import { SectionCard } from '../../../components/section-card';
import { getProject } from '../../../lib/api';
import { normalizeProjectSnapshot } from '../../../lib/normalize';
import type { ProjectSnapshot } from '../../../lib/types';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const snapshot = normalizeProjectSnapshot(await getProject<ProjectSnapshot>(projectId));

  const {
    storedFiles,
    importJobs,
    uploadSessions,
    assets,
    characters,
    episodeOutlines,
    issues,
    renderJobs,
    previewJobs,
    scenes,
    shots
  } = snapshot;

  const pipelineItems = [
    { label: '原著导入', value: snapshot.novel ? '已完成' : '待处理', active: Boolean(snapshot.novel) },
    { label: '结构理解', value: scenes.length > 0 ? '已完成' : '待处理', active: scenes.length > 0 },
    { label: '导演补写', value: shots.length > 0 ? '已完成' : '待处理', active: shots.length > 0 },
    { label: '预演交付', value: previewJobs.length > 0 ? '已完成' : '待处理', active: previewJobs.length > 0 },
    { label: '出片任务', value: renderJobs.length > 0 ? '队列中' : '待处理', active: renderJobs.length > 0 }
  ];

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={heroInfoStyle}>
          <div style={heroTopbarStyle}>
            <Link href="/" style={backLinkStyle}>
              ← 返回项目列表
            </Link>
            <div style={idBadgeStyle}>项目 ID · {projectId}</div>
          </div>

          <div style={eyebrowStyle}>ANIME DIRECTOR WORKBENCH</div>
          <h1 style={titleStyle}>{snapshot.project.name}</h1>
          <p style={subtitleStyle}>
            把原著理解、导演补写、视频剧本生成、预演准备和出片提交收敛到同一个高级工作台，而不是拆散在普通后台页面里。
          </p>

          <div style={heroMicroStatsStyle}>
            <MicroStat label="原著规模" value={snapshot.novel ? `${snapshot.novel.wordCount.toLocaleString('zh-CN')} 字` : '待导入'} />
            <MicroStat label="脚本产物" value={`${scenes.length} 场 / ${shots.length} 镜`} />
            <MicroStat label="角色资产" value={`${characters.length} 角色 / ${assets.length} 资产`} />
          </div>

          <div style={heroCommandStyle}>
            <div>
              <div style={heroCommandTitleStyle}>上传原著 → 自动分析 → 生成标准动画视频剧本</div>
              <div style={heroCommandTextStyle}>
                重点解决环境画面描写不足、剧情切分不连贯、镜头意图缺失等问题，输出可以直接进入制作链路的标准剧本包。
              </div>
            </div>
            <div style={heroCommandBadgeStyle}>{formatStageLabel(snapshot.project.stage)}</div>
          </div>

          <div style={stepRailStyle}>
            {pipelineItems.map((item) => (
              <PipelineStep key={item.label} label={item.label} value={item.value} active={item.active} />
            ))}
          </div>
        </div>

        <div style={heroPreviewStyle}>
          <div style={heroPreviewShellStyle}>
            <div style={heroPreviewHeaderStyle}>
              <div>
                <div style={previewEyebrowStyle}>制作总览</div>
                <div style={previewHeadlineStyle}>{snapshot.novel ? snapshot.novel.chapterCount.toLocaleString('zh-CN') : '0'} 章已就绪</div>
              </div>
              <div style={previewPillStyle}>{snapshot.novel ? '原著已接入' : '等待导入'}</div>
            </div>

            <div style={previewMetricGridStyle}>
              <PreviewMetric label="分场" value={String(scenes.length)} />
              <PreviewMetric label="镜头" value={String(shots.length)} />
              <PreviewMetric label="预演包" value={String(previewJobs.length)} />
              <PreviewMetric label="文件" value={String(storedFiles.length)} />
            </div>

            <div style={previewSceneCardStyle}>
              <div style={previewSceneEyebrowStyle}>Director Draft</div>
              <div style={previewSceneTitleStyle}>
                {scenes[0]?.title || snapshot.novel?.chapters[0]?.title || '等待生成第一场导演稿'}
              </div>
              <div style={previewSceneTextStyle}>
                {scenes[0]?.actionText ||
                  snapshot.novel?.chapters[0]?.summary ||
                  '导入原著后，这里会展示导演稿主画布与自动补写后的场景描述。'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={summaryStripStyle}>
        <SummaryStat label="导入任务" value={String(importJobs.length)} />
        <SummaryStat label="分片会话" value={String(uploadSessions.length)} />
        <SummaryStat label="预演包" value={String(previewJobs.length)} />
        <SummaryStat label="出片任务" value={String(renderJobs.length)} />
        <SummaryStat label="审校问题" value={String(issues.length)} />
      </section>

      <section style={mainGridStyle}>
        <aside style={leftRailStyle}>
          <div style={railCardStyle}>
            <div style={railTitleStyle}>项目导航</div>
            <div style={railListStyle}>
              <RailRow label="原著总览" meta={snapshot.novel ? `${snapshot.novel.chapterCount.toLocaleString('zh-CN')} 章` : '未导入'} active />
              <RailRow label="角色设定" meta={`${characters.length} 人`} />
              <RailRow label="分场脚本" meta={`${scenes.length} 场`} />
              <RailRow label="镜头建议" meta={`${shots.length} 镜`} />
              <RailRow label="预演交付" meta={`${previewJobs.length} 包`} />
              <RailRow label="出片中心" meta={`${renderJobs.length} 任务`} />
            </div>
          </div>
        </aside>

        <div style={contentColumnStyle}>
          <SectionCard
            eyebrow="Studio Console"
            title="制作调度"
            description="保留现有上传、分析、预演和出片逻辑，把展示层重做成统一的高级创作入口。"
          >
            <ProjectActionPanel
              projectId={projectId}
              hasNovel={Boolean(snapshot.novel)}
              canPreparePreview={episodeOutlines.length > 0 && scenes.length > 0 && shots.length > 0}
              canRender={previewJobs.length > 0}
              storedFiles={storedFiles}
            />
          </SectionCard>

          <ProjectDetailWorkspace
            novel={snapshot.novel}
            scenes={scenes}
            shots={shots}
            episodeOutlines={episodeOutlines}
            previewJobs={previewJobs}
            renderJobs={renderJobs}
            versions={snapshot.versions}
            storedFiles={storedFiles}
            importJobs={importJobs}
            uploadSessions={uploadSessions}
            assets={assets}
            characters={characters}
            issues={issues}
          />
        </div>

        <aside style={rightRailStyle}>
          <div style={railCardStyle}>
            <div style={railTitleStyle}>实时检查</div>
            <div style={sideStackStyle}>
              <InspectorCard
                title="场景补写"
                description={snapshot.novel ? '已启用对环境、动作和镜头语义的自动补足。' : '等待原著导入后启动。'}
              />
              <InspectorCard
                title="连贯性修复"
                description={issues.length > 0 ? `当前发现 ${issues.length} 条待审校问题。` : '当前未发现显著剧情断裂风险。'}
              />
              <InspectorCard
                title="角色一致性"
                description={characters.length > 0 ? `已建立 ${characters.length} 个角色主档。` : '等待自动抽取角色设定。'}
              />
              <InspectorCard
                title="导出规格"
                description="目标输出：标准视频剧本、分场提要、镜头建议、角色设定单。"
              />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PipelineStep({
  label,
  value,
  active
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div style={pipelineStepStyle(active)}>
      <div style={pipelineDotStyle(active)} />
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={pipelineLabelStyle}>{label}</span>
        <span style={pipelineValueStyle(active)}>{value}</span>
      </div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={microStatStyle}>
      <span style={microLabelStyle}>{label}</span>
      <strong style={microValueStyle}>{value}</strong>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={previewMetricStyle}>
      <div style={previewMetricLabelStyle}>{label}</div>
      <div style={previewMetricValueStyle}>{value}</div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryStatStyle}>
      <span style={summaryStatLabelStyle}>{label}</span>
      <strong style={summaryStatValueStyle}>{value}</strong>
    </div>
  );
}

function RailRow({ label, meta, active = false }: { label: string; meta: string; active?: boolean }) {
  return (
    <div style={railRowStyle(active)}>
      <span>{label}</span>
      <span style={railMetaStyle}>{meta}</span>
    </div>
  );
}

function InspectorCard({ title, description }: { title: string; description: string }) {
  return (
    <div style={inspectorCardStyle}>
      <div style={inspectorTitleStyle}>{title}</div>
      <div style={inspectorDescriptionStyle}>{description}</div>
    </div>
  );
}

function formatStageLabel(stage: string): string {
  const stageMap: Record<string, string> = {
    created: '已创建',
    'project created': '已创建',
    novel_imported: '原著已导入',
    analysis_ready: '分析已完成',
    package_generated: '整包已生成',
    preview_prepared: '预演已准备',
    render_queued: '出片队列中',
    reviewed: '已审校',
    render_completed: '已完成出片',
    'render completed': '已完成出片'
  };

  return stageMap[stage] || stage.replace(/_/g, ' ');
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1680,
  margin: '0 auto',
  padding: '28px 24px 88px'
};

const heroStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.14fr) minmax(360px, 0.86fr)',
  gap: 24,
  alignItems: 'stretch',
  padding: 28,
  borderRadius: 36,
  background:
    'radial-gradient(circle at 12% 0%, rgba(21,202,255,0.18), transparent 24%), radial-gradient(circle at 88% 12%, rgba(122,97,255,0.16), transparent 22%), linear-gradient(180deg, rgba(10,14,22,0.95), rgba(8,11,18,0.98))',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 34px 120px rgba(0,0,0,0.42)'
};

const heroInfoStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
  alignContent: 'center'
};

const heroTopbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap'
};

const backLinkStyle: React.CSSProperties = {
  color: '#dff6ff',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700
};

const idBadgeStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--text-muted)',
  fontSize: 12
};

const eyebrowStyle: React.CSSProperties = {
  color: '#86dfff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase'
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 62,
  lineHeight: 0.98,
  letterSpacing: '-0.07em',
  maxWidth: 860
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 800,
  color: 'var(--text-subtle)',
  fontSize: 17,
  lineHeight: 1.9
};

const heroMicroStatsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  maxWidth: 900
};

const microStatStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const microLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const microValueStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.5
};

const heroCommandStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 16,
  alignItems: 'center',
  padding: '18px 20px',
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.08)'
};

const heroCommandTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const heroCommandTextStyle: React.CSSProperties = {
  marginTop: 6,
  color: 'var(--text-subtle)',
  fontSize: 13,
  lineHeight: 1.8
};

const heroCommandBadgeStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 999,
  background: '#15caff',
  color: '#051019',
  fontSize: 12,
  fontWeight: 800
};

const stepRailStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 10
};

function pipelineStepStyle(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '10px 1fr',
    gap: 10,
    alignItems: 'start',
    padding: '14px 14px',
    borderRadius: 20,
    background: active ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${active ? 'rgba(21,202,255,0.14)' : 'rgba(255,255,255,0.06)'}`
  };
}

function pipelineDotStyle(active: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 5,
    background: active ? '#15caff' : '#2f4058',
    boxShadow: active ? '0 0 20px rgba(21,202,255,0.7)' : 'none'
  };
}

const pipelineLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700
};

function pipelineValueStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? '#daf6ff' : 'var(--text-muted)',
    fontSize: 11
  };
}

const heroPreviewStyle: React.CSSProperties = {
  display: 'grid'
};

const heroPreviewShellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  padding: 24,
  borderRadius: 30,
  background:
    'radial-gradient(circle at 75% 10%, rgba(21,202,255,0.2), transparent 20%), radial-gradient(circle at 82% 18%, rgba(122,97,255,0.18), transparent 26%), linear-gradient(180deg, rgba(11,18,30,0.94), rgba(10,14,24,0.96))',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.34)'
};

const heroPreviewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'start'
};

const previewEyebrowStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const previewHeadlineStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: '-0.05em'
};

const previewPillStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#dff6ff',
  fontSize: 12,
  fontWeight: 700
};

const previewMetricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10
};

const previewMetricStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const previewMetricLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11
};

const previewMetricValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const previewSceneCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 20,
  borderRadius: 26,
  background: 'rgba(244,247,251,0.96)',
  color: '#0e1724',
  boxShadow: '0 22px 60px rgba(0,0,0,0.25)'
};

const previewSceneEyebrowStyle: React.CSSProperties = {
  color: '#607086',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const previewSceneTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.04em'
};

const previewSceneTextStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.85,
  color: '#425066'
};

const summaryStripStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 12,
  marginTop: 18
};

const summaryStatStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '18px 20px',
  borderRadius: 22,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)'
};

const summaryStatLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase'
};

const summaryStatValueStyle: React.CSSProperties = {
  fontSize: 18
};

const mainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr) 220px',
  gap: 18,
  alignItems: 'start',
  marginTop: 20
};

const leftRailStyle: React.CSSProperties = {
  position: 'sticky',
  top: 20
};

const rightRailStyle: React.CSSProperties = {
  position: 'sticky',
  top: 20
};

const contentColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18
};

const railCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 28,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)'
};

const railTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '-0.03em'
};

const railListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8
};

function railRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: 18,
    background: active ? 'rgba(21,202,255,0.1)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? 'rgba(21,202,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
    color: active ? '#dff6ff' : '#dbe8f8',
    fontSize: 13
  };
}

const railMetaStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 11
};

const sideStackStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10
};

const inspectorCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '14px 15px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)'
};

const inspectorTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800
};

const inspectorDescriptionStyle: React.CSSProperties = {
  color: 'var(--text-subtle)',
  fontSize: 12,
  lineHeight: 1.7
};
