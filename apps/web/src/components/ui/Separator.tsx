// apps/web/src/components/ui/Separator.tsx
// P6.3.2: 隐形分隔墙 — Token-only，禁止硬编码 rgba/hex
'use client';

import React from 'react';

type SeparatorProps = {
  orientation?: 'horizontal' | 'vertical';
  /** 外层 margin，使用像素数字（会转为 marginBlockStart/End 或 marginInlineStart/End） */
  spacing?: number;
  style?: React.CSSProperties;
};

/**
 * 极弱分隔线组件。
 * 颜色强制使用 var(--line-separator)，只允许通过 spacing / style 控制间距。
 * 禁止直接传入 color / background 等覆盖色值。
 */
export function Separator({ orientation = 'horizontal', spacing = 0, style }: SeparatorProps) {
  if (orientation === 'horizontal') {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        style={{
          height: 1,
          background: 'var(--line-separator)',
          marginTop: spacing,
          marginBottom: spacing,
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      style={{
        width: 1,
        background: 'var(--line-separator)',
        marginLeft: spacing,
        marginRight: spacing,
        flexShrink: 0,
        alignSelf: 'stretch',
        ...style,
      }}
    />
  );
}
