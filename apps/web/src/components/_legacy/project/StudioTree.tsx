'use client';

import React from 'react';
import { ProjectSceneGraph, SeasonNode, EpisodeNode, SceneNode } from '@scu/shared-types';

type Ids = {
  seasonId?: string;
  episodeId?: string;
  sceneId?: string;
  shotId?: string;
};

interface StudioTreeProps {
  treeData?: ProjectSceneGraph | null;
  selectedIds: Ids;
  onSelect: (type: 'season' | 'episode' | 'scene' | 'shot', id: string) => void;
}

const itemStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: '8px',
  backgroundColor: active ? '#dbeafe' : 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontWeight: active ? 600 : 400,
  color: active ? '#1e40af' : '#374151',
});

const indent = (level: number): React.CSSProperties => ({
  paddingLeft: `${level * 12}px`,
});

export default function StudioTree({ treeData, selectedIds, onSelect }: StudioTreeProps) {
  const seasons = treeData?.seasons || [];
  const legacyEpisodes = treeData?.episodes || [];

  if (seasons.length === 0 && legacyEpisodes.length === 0) {
    return (
      <div
        className="p-4 text-sm text-balance text-center"
        style={{ color: 'hsl(var(--hsl-text-muted))' }}
      >
        暂无结构，请先完成分析或生成结构。
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 140px)',
      }}
    >
      {seasons.map((season: SeasonNode, si: number) => {
        const seasonLabel = season.title || `Season ${season.index ?? si + 1}`;
        const seasonActive = selectedIds.seasonId === season.id;
        return (
          <div key={season.id}>
            <TreeItem
              label={seasonLabel}
              active={seasonActive}
              level={0}
              onClick={() => onSelect('season', season.id)}
              type="season"
            />
            {season.episodes?.map((ep: EpisodeNode, ei: number) => {
              const epLabel = ep.name || `Episode ${ep.index ?? ei + 1}`;
              const epActive = selectedIds.episodeId === ep.id;
              return (
                <div key={ep.id}>
                  <TreeItem
                    label={epLabel}
                    active={epActive}
                    level={1}
                    onClick={() => onSelect('episode', ep.id)}
                    type="episode"
                  />
                  {ep.scenes?.map((sc: SceneNode, sci: number) => {
                    const scLabel = sc.title || `Scene ${sc.index ?? sci + 1}`;
                    const scActive = selectedIds.sceneId === sc.id;
                    return (
                      <div key={sc.id}>
                        <TreeItem
                          label={scLabel}
                          active={scActive}
                          level={2}
                          onClick={() => onSelect('scene', sc.id)}
                          type="scene"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      {seasons.length === 0 &&
        legacyEpisodes.map((ep: EpisodeNode, ei: number) => {
          const epLabel = ep.name || `Episode ${ep.index ?? ei + 1}`;
          const epActive = selectedIds.episodeId === ep.id;
          return (
            <div key={ep.id}>
              <TreeItem
                label={epLabel}
                active={epActive}
                level={0}
                onClick={() => onSelect('episode', ep.id)}
                type="episode"
              />
              {ep.scenes?.map((sc: SceneNode, sci: number) => {
                const scLabel = sc.title || `Scene ${sc.index ?? sci + 1}`;
                const scActive = selectedIds.sceneId === sc.id;
                return (
                  <div key={sc.id}>
                    <TreeItem
                      label={scLabel}
                      active={scActive}
                      level={1}
                      onClick={() => onSelect('scene', sc.id)}
                      type="scene"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

function TreeItem({
  label,
  active,
  level,
  onClick,
  type,
}: {
  label: string;
  active: boolean;
  level: number;
  onClick: () => void;
  type: string;
}) {
  const isSeason = type === 'season';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.5rem 0.75rem',
        paddingLeft: `${level * 12 + 12}px`,
        borderRadius: 'var(--radius-md)',
        backgroundColor: active ? 'hsla(var(--hsl-primary), 0.15)' : 'transparent',
        color: active ? 'hsl(var(--hsl-primary-glow))' : 'hsl(var(--hsl-text-muted))',
        fontSize: isSeason ? '0.95rem' : '0.875rem',
        fontWeight: active || isSeason ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: active ? '2px solid hsl(var(--hsl-primary))' : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
      className="hover:bg-white/5"
    >
      {/* Icon based on type */}
      <span style={{ opacity: active ? 1 : 0.5, fontSize: '0.8em' }}>
        {type === 'season' && '🛸'}
        {type === 'episode' && '🎬'}
        {type === 'scene' && '🎬'}
      </span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  );
}
