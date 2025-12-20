'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { engineApi } from '@/lib/apiClient';

interface Engine {
  engineKey: string;
  adapterName: string;
  adapterType: string;
  defaultVersion: string | null;
  enabled: boolean;
}

interface EngineFilterProps {
  /**
   * URL query 参数名，默认为 'engineKey'
   */
  queryParam?: string;
  /**
   * 是否显示"全部"选项，默认为 true
   */
  showAll?: boolean;
  /**
   * 默认选中的 engineKey（如果 URL 中没有）
   */
  defaultValue?: string | null;
  /**
   * 选择变化时的回调
   */
  onChange?: (engineKey: string | null) => void;
  /**
   * 自定义样式类名
   */
  className?: string;
}

/**
 * S3-C.1: Engine 筛选器组件
 * 
 * 功能：
 * - 从 /api/engines 读取所有 engineKey
 * - 支持选择 "全部"
 * - 选择后更新 URL Query (?engineKey=xxx)
 * - 与 URL Query 同步（支持浏览器前进/后退）
 */
export default function EngineFilter({
  queryParam = 'engineKey',
  showAll = true,
  defaultValue = null,
  onChange,
  className = '',
}: EngineFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [engines, setEngines] = useState<Engine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEngineKey, setSelectedEngineKey] = useState<string | null>(null);

  // 从 URL Query 读取当前选中的 engineKey
  useEffect(() => {
    const urlEngineKey = searchParams?.get(queryParam);
    setSelectedEngineKey(urlEngineKey || defaultValue);
  }, [searchParams, queryParam, defaultValue]);

  // 加载引擎列表
  useEffect(() => {
    async function loadEngines() {
      try {
        setLoading(true);
        const data = await engineApi.listEngines();
        // 只显示启用的引擎
        const enabledEngines = (data || []).filter((e: Engine) => e.enabled !== false);
        setEngines(enabledEngines);
      } catch (error) {
        console.error('Failed to load engines:', error);
        setEngines([]);
      } finally {
        setLoading(false);
      }
    }
    loadEngines();
  }, []);

  // 处理选择变化
  const handleChange = (engineKey: string) => {
    const newValue = engineKey === '' ? null : engineKey;
    setSelectedEngineKey(newValue);

    // 更新 URL Query
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (newValue) {
      params.set(queryParam, newValue);
    } else {
      params.delete(queryParam);
    }

    // 更新 URL（不刷新页面）
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });

    // 触发回调
    if (onChange) {
      onChange(newValue);
    }
  };

  if (loading) {
    return (
      <select className={className} disabled>
        <option>加载中...</option>
      </select>
    );
  }

  return (
    <select
      value={selectedEngineKey || ''}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
    >
      {showAll && <option value="">全部</option>}
      {engines.map((engine) => (
        <option key={engine.engineKey} value={engine.engineKey}>
          {engine.engineKey} {engine.adapterName ? `(${engine.adapterName})` : ''}
        </option>
      ))}
    </select>
  );
}

