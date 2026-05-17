'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { CharacterBibleDTO, ProductionStateDTO } from '@scu/shared-types';
import {
  generateStudioCharacterBibles,
  getStudioCharacterBibles,
  getStudioProductionState,
} from './api';
import { StudioLayout } from './StudioLayout';

interface StudioCharacterBiblePageProps {
  locale: string;
  projectId: string;
}

export function StudioCharacterBiblePage({ locale, projectId }: StudioCharacterBiblePageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [characters, setCharacters] = useState<CharacterBibleDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioCharacterBibles(projectId)])
      .then(([nextState, nextCharacters]) => {
        if (!mounted) return;
        setState(nextState);
        setCharacters(nextCharacters);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const characterStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'characters_ready') || null,
    [state]
  );
  const realCharacters = characters.filter((character) => character.status === 'done');
  const isDone = realCharacters.length > 0;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextCharacters = await generateStudioCharacterBibles(projectId);
      const nextState = await getStudioProductionState(projectId);
      setCharacters(nextCharacters);
      setState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Studio CharacterBible');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <StudioLayout locale={locale} projectId={projectId} state={state}>
      <section
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-panel)',
          padding: '1.5rem',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Phase 2B：只生成 CharacterBible，不接图片/视频
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>角色资产 CharacterBible</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 StoryBible 和小说章节中抽取独立角色资产，生成身份、性格、外貌、三视图提示词、表情提示词和服饰提示词。
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              border: 'none',
              borderRadius: '999px',
              background: 'var(--accent)',
              color: '#0f1115',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              minWidth: '148px',
              padding: '0.85rem 1.15rem',
            }}
          >
            {generating ? '生成中...' : isDone ? '重新生成角色资产' : '生成角色资产'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="角色资产未生成"
            body={
              characterStage?.missingReason ||
              characters[0]?.missingReason ||
              '当前还没有 CharacterBible。这里不会把旧角色摘要或章节文本伪装成角色资产。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成结构化角色文字资产。角色图片、设定卡图、三视图图片、表情图和分镜图仍未生成，assetIds 为空是预期结果。"
        />

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {realCharacters.length > 0 ? (
            realCharacters.map((character) => (
              <CharacterCard key={character.id || character.name} character={character} />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成角色资产" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function CharacterCard({ character }: { character: CharacterBibleDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>{character.name}</h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow label="基础身份" value={character.identity || '未生成'} />
        <InfoRow label="年龄" value={character.age || '未生成'} />
        <InfoRow label="性格" value={character.personality || '未生成'} />
        <InfoRow label="外貌" value={character.appearance || '未生成'} />
        <InfoRow label="角色关系定位" value={character.relationshipRole || '未生成'} />
        <InfoRow label="设定卡提示词" value={character.profilePrompt || '未生成'} />
        <InfoRow label="三视图提示词" value={character.threeViewPrompt || '未生成'} />
        <InfoRow label="表情展示提示词" value={character.expressionPrompt || '未生成'} />
        <InfoRow label="服饰细节提示词" value={character.costumePrompt || '未生成'} />
        <InfoRow label="发型头饰提示词" value={character.hairAccessoryPrompt || '未生成'} />
        <InfoRow label="随身物品提示词" value={character.propPrompt || '未生成'} />
        <InfoRow label="台词口吻" value={character.voiceStyle || '未生成'} />
        <InfoRow
          label="已生成图片资产"
          value={character.assetIds.length > 0 ? character.assetIds.join('\n') : '暂无图片资产'}
        />
        <InfoRow
          label="来源证据"
          value={character.sourceEvidence.length > 0 ? character.sourceEvidence.join('\n') : '未生成'}
        />
        <InfoRow label="协议版本" value={character.version || '未生成'} />
      </div>
    </article>
  );
}

function Callout({ tone, title, body }: { tone: 'error' | 'warn' | 'info'; title: string; body: string }) {
  const color =
    tone === 'error' ? 'var(--hsl-error)' : tone === 'warn' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        marginTop: '1rem',
        padding: '1rem',
      }}
    >
      <strong style={{ color }}>{title}</strong>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>{body}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '0.85rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
