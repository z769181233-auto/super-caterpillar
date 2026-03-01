import React from 'react';
import { StudioShellPage } from '@/features/studio/pages/StudioShellPage';

export function generateStaticParams() {
  return [{ id: 'demo' }];
}

/**
 * 为了对齐 UI_MAP.md 规范与生产环境逻辑路径映射，
 * 显式建立 /studio/[id] 验证入口。
 */
export default function StudioPage() {
  return <StudioShellPage />;
}
