'use client';

import { useEffect, useState } from 'react';
import { getWorkerMonitorStats } from '@/lib/apiClient';

export default function WorkerMonitorPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getWorkerMonitorStats().then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Worker 监控面板</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>总数：{stats.total}</div>
        <div>在线：{stats.online}</div>
        <div>离线：{stats.offline}</div>
        <div>空闲：{stats.idle}</div>
        <div>繁忙：{stats.busy}</div>
      </div>

      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border p-2">ID</th>
            <th className="border p-2">状态</th>
            <th className="border p-2">是否在线</th>
            <th className="border p-2">运行任务数</th>
            {/* S3-C.1: 新增当前引擎列 */}
            <th className="border p-2">当前引擎</th>
            <th className="border p-2">最后心跳</th>
          </tr>
        </thead>
        <tbody>
          {stats.workers.map((w: any) => (
            <tr key={w.id}>
              <td className="border p-2">{w.id}</td>
              <td className="border p-2">{w.status}</td>
              <td className="border p-2">{w.isOnline ? '在线' : '离线'}</td>
              <td className="border p-2">{w.tasksRunning}</td>
              {/* S3-C.1: 显示当前引擎 */}
              <td className="border p-2 font-mono text-sm">
                {w.currentEngineKey || '-'}
              </td>
              <td className="border p-2">{w.lastHeartbeat}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

