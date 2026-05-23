'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ProjectStructureEpisodeNode,
  ProjectStructureProductionScript,
  ProjectStructureSceneNode,
  ProjectStructureShotNode,
  ProjectStructureTree,
} from '@scu/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { projectApi } from '@/lib/apiClient';
import { deriveProductionBreakdown, EpisodeStoryboardBoard } from './project-production-breakdown';
import {
  getScriptedSceneReferences,
  hasProductionScript,
  hasText,
  hasVideoScriptFields,
} from './project-structure-script-selection';

interface ProjectStructureResultsPanelProps {
  projectId: string;
  projectName: string;
}

function flattenEpisodes(structure: ProjectStructureTree | null): ProjectStructureEpisodeNode[] {
  if (!structure) return [];

  return structure.tree.flatMap((node) => {
    if (node.type === 'season') return node.episodes;
    return node;
  });
}

function normalizeCharacterValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => normalizeCharacterValue(item));
  if (typeof value === 'string') {
    return value
      .split(/[、,，/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const name = record.name || record.characterName || record.canonicalName || record.label;
    if (typeof name === 'string' && name.trim()) return [name.trim()];
    return Object.values(record).flatMap((item) => normalizeCharacterValue(item));
  }
  return [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value || value === '--') return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cardTitleStyle(): React.CSSProperties {
  return {
    fontSize: '1.15rem',
    fontWeight: 900,
    color: 'var(--text-primary)',
    margin: 0,
  };
}

function mutedTextStyle(): React.CSSProperties {
  return {
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
  };
}

function getShotSourceText(shot: ProjectStructureShotNode): string {
  return (
    shot.novelQuote ||
    shot.content ||
    shot.description ||
    shot.actionDescription ||
    shot.visualDescription ||
    '暂无原文依据'
  );
}

function getShotVisualText(shot: ProjectStructureShotNode): string {
  return (
    shot.visualDescription ||
    shot.visualPrompt ||
    getScriptField(shot.productionScript, 'artDirection') ||
    shot.description ||
    '暂无画面描述'
  );
}

function getShotActionText(shot: ProjectStructureShotNode): string {
  return (
    shot.actionDescription ||
    getScriptField(shot.productionScript, 'sceneBeat') ||
    shot.description ||
    shot.content ||
    '暂无动作/剧情描述'
  );
}

function getShotDurationText(shot: ProjectStructureShotNode): string | null {
  const value = shot.durationSec ?? shot.durationSeconds;
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `${value} 秒`;
}

function getShotImageAssetUrl(shot: ProjectStructureShotNode): string {
  const value = (shot as ProjectStructureShotNode & { resultImageUrl?: unknown }).resultImageUrl;
  return typeof value === 'string' ? value.trim() : '';
}

function getScriptField(
  script: ProjectStructureProductionScript | null | undefined,
  key: keyof ProjectStructureProductionScript
): string {
  const value = script?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function ProjectStructureResultsPanel({
  projectId,
  projectName,
}: ProjectStructureResultsPanelProps) {
  const [structure, setStructure] = useState<ProjectStructureTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStructure() {
      try {
        setLoading(true);
        setError('');
        const result = await projectApi.getProjectStructure(projectId);
        if (!cancelled) {
          setStructure(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '结构结果加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStructure();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const episodes = useMemo(() => flattenEpisodes(structure), [structure]);
  const productionBreakdown = useMemo(() => deriveProductionBreakdown(episodes), [episodes]);
  const scriptedSceneReferences = useMemo(() => getScriptedSceneReferences(episodes), [episodes]);
  const hasVideoScript = scriptedSceneReferences.length > 0;
  const scriptedShotCount = scriptedSceneReferences.reduce(
    (sum, item) => sum + item.scriptedShots.length,
    0
  );
  const imageAssetCount = productionBreakdown.episodeBoards.reduce(
    (sum, board) => sum + board.imageAssetCount,
    0
  );

  const selectedEpisode = useMemo(() => {
    return episodes.find((episode) => episode.id === selectedEpisodeId) || episodes[0] || null;
  }, [episodes, selectedEpisodeId]);

  const scenes = useMemo(() => selectedEpisode?.scenes ?? [], [selectedEpisode]);
  const selectedScene = useMemo(() => {
    return scenes.find((scene) => scene.id === selectedSceneId) || scenes[0] || null;
  }, [scenes, selectedSceneId]);

  useEffect(() => {
    if (!selectedEpisode && episodes[0]) {
      setSelectedEpisodeId(episodes[0].id);
      return;
    }
    if (selectedEpisode && selectedEpisodeId !== selectedEpisode.id) {
      setSelectedEpisodeId(selectedEpisode.id);
    }
  }, [episodes, selectedEpisode, selectedEpisodeId]);

  useEffect(() => {
    if (!selectedScene && scenes[0]) {
      setSelectedSceneId(scenes[0].id);
      return;
    }
    if (selectedScene && selectedSceneId !== selectedScene.id) {
      setSelectedSceneId(selectedScene.id);
    }
  }, [scenes, selectedScene, selectedSceneId]);

  if (loading) {
    return <Card style={{ padding: '2rem', color: 'var(--text-secondary)' }}>正在加载结构结果...</Card>;
  }

  if (error) {
    return (
      <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={cardTitleStyle()}>结构结果加载失败</h2>
        <p style={mutedTextStyle()}>{error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          重新加载
        </Button>
      </Card>
    );
  }

  if (!structure || episodes.length === 0) {
    return (
      <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={cardTitleStyle()}>还没有小说分析结果</h2>
        <p style={mutedTextStyle()}>
          当前项目还没有可展示的章节、场景和镜头结构。请先使用旧小说导入入口完成导入与分析。
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              {hasVideoScript ? '结构结果与文字镜头脚本' : '小说分析结构结果'}
            </h1>
            <p style={{ ...mutedTextStyle(), margin: '0.5rem 0 0' }}>
              《{structure.projectName || projectName}》当前展示的是只读结构数据。本页不会触发图片生成、视频生成或 worker 任务。
            </p>
          </div>
          <StatusPill level={hasVideoScript ? 'GOLD' : 'DEFAULT'}>
            {hasVideoScript ? '已有文字镜头脚本' : '仅有结构/原文切片'}
          </StatusPill>
        </div>

        {!hasVideoScript && (
          <div
            style={{
              border: '1px solid rgba(255, 193, 7, 0.45)',
              borderRadius: 'var(--r-md)',
              background: 'rgba(255, 193, 7, 0.08)',
              padding: '1rem',
              color: 'var(--text-primary)',
              lineHeight: 1.7,
            }}
          >
            当前还不是大型动漫公司级导演剧本或镜头台本。这里只能说明小说已经被拆成章节、场景和原文切片；后续需要独立生成
            DirectorScript / ShotScript / StoryboardAsset。
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <ResultMetric label="章节" value={structure.counts.episodes} />
          <ResultMetric label="场景" value={structure.counts.scenes} />
          <ResultMetric label="镜头/切片" value={structure.counts.shots} />
          <ResultMetric label="文字镜头脚本" value={scriptedShotCount || '未生成'} />
          <ResultMetric label="已有图片资产" value={imageAssetCount || '无'} />
        </div>
      </Card>

      <ProductionDeliveryPackage
        boards={productionBreakdown.episodeBoards}
        characterCards={productionBreakdown.characterCards}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 0.85fr) minmax(260px, 1fr) minmax(320px, 1.35fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={cardTitleStyle()}>章节目录</h2>
          <p style={{ ...mutedTextStyle(), margin: 0, fontSize: '0.85rem' }}>
            这里是小说拆章结果，不等同于最终剧集规划。
          </p>
          {episodes.map((episode) => (
            <SelectionButton
              key={episode.id}
              active={episode.id === selectedEpisode?.id}
              title={`第 ${episode.index} 章 · ${episode.name}`}
              description={episode.summary || '本章暂无摘要'}
              onClick={() => {
                setSelectedEpisodeId(episode.id);
                setSelectedSceneId(episode.scenes[0]?.id ?? null);
              }}
            />
          ))}
        </Card>

        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={cardTitleStyle()}>场景候选</h2>
          <p style={{ ...mutedTextStyle(), margin: 0, fontSize: '0.85rem' }}>
            这里是从章节中识别出的场景候选，不等同于可拍摄场景资产。
          </p>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              当前场景人物
            </div>
            <CharacterChips characters={unique(normalizeCharacterValue(selectedScene?.characters))} />
          </div>
          {scenes.map((scene) => (
            <SelectionButton
              key={scene.id}
              active={scene.id === selectedScene?.id}
              title={`场景 ${scene.index} · ${scene.title || '未命名场景'}`}
              description={scene.summary || scene.directingNotes || scene.enrichedText || '该场景暂无摘要'}
              onClick={() => setSelectedSceneId(scene.id)}
            />
          ))}
        </Card>

        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={cardTitleStyle()}>
            {selectedScene?.shots.some((shot) => hasVideoScriptFields(shot))
              ? '文字镜头脚本'
              : '原文切片'}
          </h2>
          {selectedScene ? (
            <SceneShotList scene={selectedScene} />
          ) : (
            <p style={mutedTextStyle()}>请选择一个场景查看镜头/原文切片。</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function SelectionButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: `1px solid ${active ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--r-md)',
        background: active ? 'rgba(198, 168, 94, 0.12)' : 'transparent',
        color: 'var(--text-primary)',
        padding: '0.85rem',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.55, marginTop: '0.4rem' }}>
        {description}
      </div>
    </button>
  );
}

function ProductionDeliveryPackage({
  boards,
  characterCards,
}: {
  boards: EpisodeStoryboardBoard[];
  characterCards: ReturnType<typeof deriveProductionBreakdown>['characterCards'];
}) {
  return (
    <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ ...cardTitleStyle(), fontSize: '1.3rem' }}>动画制作只读拆解</h2>
        <p style={{ ...mutedTextStyle(), margin: '0.45rem 0 0' }}>
          下面只展示当前旧结构中能兼容映射出的角色文字线索和分集镜头列表。没有生成图片、视频或新资产。
        </p>
      </div>

      <CharacterDesignCards cards={characterCards} />
      <EpisodeBoards boards={boards} />
    </Card>
  );
}

function CharacterDesignCards({
  cards,
}: {
  cards: ReturnType<typeof deriveProductionBreakdown>['characterCards'];
}) {
  if (cards.length === 0) {
    return (
      <div style={{ border: '1px solid rgba(255, 193, 7, 0.35)', borderRadius: 'var(--r-md)', padding: '1rem', ...mutedTextStyle() }}>
        角色设定卡未生成：当前结构树还没有稳定角色字段，不能伪造成 CharacterBible。
      </div>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ ...cardTitleStyle(), fontSize: '1.05rem' }}>角色文字线索</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {cards.slice(0, 6).map((card) => (
          <article
            key={card.name}
            style={{
              border: '1px solid rgba(198, 168, 94, 0.38)',
              borderRadius: 'var(--r-lg)',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.025)',
            }}
          >
            <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', margin: 0 }}>{card.name}</h4>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {card.firstAppearance} · {card.episodeCount} 章 / {card.sceneCount} 场
            </div>
            <ScriptField label="剧情定位线索" value={card.roleLine} />
            <ScriptField label="视觉参考线索" value={card.visualReference} />
            <ScriptField label="服装与道具线索" value={card.costumeAndProps} />
          </article>
        ))}
      </div>
    </section>
  );
}

function EpisodeBoards({ boards }: { boards: EpisodeStoryboardBoard[] }) {
  if (boards.length === 0) {
    return <p style={mutedTextStyle()}>暂无分集镜头列表。</p>;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ ...cardTitleStyle(), fontSize: '1.05rem' }}>分集镜头列表</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {boards.slice(0, 4).map((board) => (
          <article
            key={board.episode.id}
            style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '1rem' }}
          >
            <div style={{ color: 'var(--text-primary)', fontWeight: 900 }}>
              第 {board.episode.index} 章 · {board.episode.name}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              {board.sceneCount} 场 / {board.shotCount} 镜头或切片
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.82rem' }}>
              文字脚本 {board.scriptedShotCount} · 已有图片资产 {board.imageAssetCount}
            </div>
            {board.scenes.slice(0, 3).map(({ scene, shots }) => (
              <div
                key={scene.id}
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                }}
              >
                场景 {scene.index}：{shots.filter((item) => item.status !== 'PENDING').length}/{shots.length} 已有文本或资产
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function SceneShotList({ scene }: { scene: ProjectStructureSceneNode }) {
  return (
    <>
      <div style={mutedTextStyle()}>
        当前：场景 {scene.index} · {scene.title || '未命名场景'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {scene.shots.map((shot) => {
          const hasScript = hasVideoScriptFields(shot);
          return (
            <div
              key={shot.id}
              style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '0.95rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                  镜头/切片 {shot.index} · {shot.title || shot.shotType || '未命名'}
                </div>
                <span style={{ color: hasScript ? 'var(--gold-primary)' : 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 800 }}>
                  {hasText(getShotImageAssetUrl(shot)) ? '已有图片资产' : hasScript ? '文字脚本线索' : '原文切片'}
                </span>
              </div>
              {hasProductionScript(shot.productionScript) && (
                <ProductionScriptFields script={shot.productionScript} />
              )}
              <ScriptField label="画面" value={getShotVisualText(shot)} />
              <ScriptField label="动作/剧情" value={getShotActionText(shot)} />
              {shot.dialogueContent && <ScriptField label="台词" value={shot.dialogueContent} accent />}
              {(shot.cameraMovement || shot.cameraAngle || shot.lightingPreset) && (
                <ScriptField
                  label="镜头调度"
                  value={[shot.cameraMovement, shot.cameraAngle, shot.lightingPreset].filter(Boolean).join(' / ')}
                />
              )}
              {shot.soundFx && !getScriptField(shot.productionScript, 'soundDesign') && (
                <ScriptField label="声音设计" value={shot.soundFx} />
              )}
              {getShotDurationText(shot) && <ScriptField label="预计时长" value={getShotDurationText(shot) ?? ''} />}
              {getShotImageAssetUrl(shot) && (
                <ScriptField label="已有图片资产 URL" value={getShotImageAssetUrl(shot)} muted />
              )}
              <ScriptField label="原文依据" value={getShotSourceText(shot)} muted />
            </div>
          );
        })}
      </div>
    </>
  );
}

function ProductionScriptFields({
  script,
}: {
  script: ProjectStructureProductionScript | null | undefined;
}) {
  const fields: Array<[keyof ProjectStructureProductionScript, string]> = [
    ['sceneBeat', '剧情节拍'],
    ['characterBlocking', '人物调度'],
    ['performanceNote', '表演备注'],
    ['artDirection', '美术设定'],
    ['soundDesign', '声音设计'],
    ['editNote', '剪辑备注'],
    ['continuity', '连续性检查'],
    ['productionRemark', '制作备注'],
  ];

  return (
    <div
      style={{
        marginTop: '0.75rem',
        border: '1px solid rgba(198, 168, 94, 0.35)',
        borderRadius: 'var(--r-md)',
        padding: '0.85rem',
        background: 'rgba(198, 168, 94, 0.06)',
      }}
    >
      <div style={{ color: 'var(--gold-primary)', fontWeight: 900, fontSize: '0.9rem', marginBottom: '0.45rem' }}>
        已有 productionScript 字段
      </div>
      {fields.map(([key, label]) => {
        const value = getScriptField(script, key);
        if (!value) return null;
        return <ScriptField key={String(key)} label={label} value={value} />;
      })}
    </div>
  );
}

function ScriptField({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ marginTop: '0.55rem' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div
        style={{
          color: accent ? 'var(--gold-primary)' : muted ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontSize: '0.9rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '1rem' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function CharacterChips({ characters }: { characters: string[] }) {
  if (characters.length === 0) {
    return <span style={{ color: 'var(--text-muted)' }}>暂无明确人物</span>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {characters.map((name) => (
        <span
          key={name}
          style={{
            border: '1px solid rgba(198, 168, 94, 0.45)',
            borderRadius: '999px',
            color: 'var(--gold-primary)',
            padding: '0.25rem 0.6rem',
            fontSize: '0.82rem',
            background: 'rgba(198, 168, 94, 0.08)',
          }}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

export const __projectStructureResultsPanelTestUtils = {
  flattenEpisodes,
  formatMaybeDate,
};
