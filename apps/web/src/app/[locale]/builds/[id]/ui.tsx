// apps/web/src/app/[locale]/builds/[id]/ui.tsx
'use client';

import React from 'react';
import {
  BuildSummary,
  ScriptNode,
  InsightsPayload,
  ShotReaderPayload,
} from '@/features/studio/types';
import { fetchShotReader } from '@/features/studio/api';
import { StudioShell } from '@/features/studio/components/StudioShell';

export default function BuildStudioClient(props: {
  summary: BuildSummary;
  tree: ScriptNode[];
  insights: InsightsPayload;
}) {
  const [selectedShot, setSelectedShot] = React.useState<ShotReaderPayload | null>(null);
  const [loading, setLoading] = React.useState(false);

  // 状态同步：左树点击触发中间阅读器加载
  const onSelectShot = async (shotId: string) => {
    setLoading(true);
    try {
      const payload = await fetchShotReader(shotId);
      setSelectedShot(payload);
    } catch (e) {
      console.error('Failed to load shot source:', e);
    } finally {
      setLoading(false);
    }
  };

  const onExportCSV = () => {
    alert('正在准备全量物理指纹剧本导出包 (industrial_script_sealed.csv)...');
  };

  return (
    <StudioShell
      summary={props.summary}
      tree={props.tree}
      insights={props.insights}
      onSelectShot={onSelectShot}
      selectedShot={selectedShot}
      loadingShot={loading}
      onExportCSV={onExportCSV}
    />
  );
}
