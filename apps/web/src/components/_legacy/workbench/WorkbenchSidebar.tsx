'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export type WorkbenchModule =
  | 'overview'
  | 'structure'
  | 'pipeline'
  | 'assets'
  | 'tasks'
  | 'quality'
  | 'cost'
  | 'logs';

interface WorkbenchSidebarProps {
  currentModule: WorkbenchModule;
  onModuleChange: (module: WorkbenchModule) => void;
}

export function WorkbenchSidebar({ currentModule, onModuleChange }: WorkbenchSidebarProps) {
  // Using Common namespace for now, can be moved to Workbench specific
  const t = useTranslations('Common');

  const menuItems: { id: WorkbenchModule; label: string; icon: string; disabled?: boolean }[] = [
    { id: 'overview', label: '项目总览', icon: '📊' },
    { id: 'structure', label: '结构视图', icon: '🌲' },
    { id: 'pipeline', label: '生产流程', icon: '🏭' },
    { id: 'assets', label: '资产与模型', icon: '📦', disabled: true },
    { id: 'tasks', label: '任务与执行', icon: '⚡', disabled: true },
    { id: 'quality', label: '质量与校验', icon: '🛡️', disabled: true },
    { id: 'cost', label: '成本与算力', icon: '💰', disabled: true },
    { id: 'logs', label: '日志与审计', icon: '📝', disabled: true },
  ];

  return (
    <div
      style={{
        width: '240px',
        height: '100%',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          padding: '0 20px 20px 20px',
          borderBottom: '1px solid #eee',
          marginBottom: '10px',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#333' }}>控制中枢</h2>
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>Industrial Workbench</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => !item.disabled && onModuleChange(item.id)}
            style={{
              padding: '12px 20px',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              backgroundColor: currentModule === item.id ? '#e6f4ff' : 'transparent',
              color: item.disabled ? '#999' : currentModule === item.id ? '#1677ff' : '#333',
              borderRight:
                currentModule === item.id ? '3px solid #1677ff' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.95rem',
              fontWeight: currentModule === item.id ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.disabled && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  backgroundColor: '#eee',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                Soon
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '20px',
          borderTop: '1px solid #eee',
          fontSize: '0.8rem',
          color: '#999',
          textAlign: 'center',
        }}
      >
        Super Caterpillar v1.0
      </div>
    </div>
  );
}
