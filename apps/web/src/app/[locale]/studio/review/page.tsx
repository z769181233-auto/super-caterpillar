'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';
import Link from 'next/link';

interface Shot {
  id: string;
  index: number;
  type: string;
  title?: string;
  status: string;
  reviewStatus?: string;
  previewUrl?: string;
  generatedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  seasonId: string;
  seasonName: string;
  episodeId: string;
  episodeName: string;
  sceneId: string;
  sceneIndex: number;
}

export default function StudioReviewPage() {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set());
  const [batchOperating, setBatchOperating] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // 过滤条件
  const [filters, setFilters] = useState({
    projectId: '',
    seasonId: '',
    episodeId: '',
    sceneId: '',
    status: '',
    reviewStatus: '',
    q: '',
    page: 1,
    pageSize: 20,
  });

  const [stats, setStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    byReviewStatus: {} as Record<string, number>,
  });

  const loadShots = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await projectApi.listShots(filters);
      setShots(Array.isArray(result?.shots) ? result.shots : []);

      // 计算统计
      const total = result?.total || 0;
      const byStatus: Record<string, number> = {};
      const byReviewStatus: Record<string, number> = {};

      result?.shots?.forEach((shot: Shot) => {
        byStatus[shot.status] = (byStatus[shot.status] || 0) + 1;
        byReviewStatus[shot.reviewStatus || 'PENDING'] =
          (byReviewStatus[shot.reviewStatus || 'PENDING'] || 0) + 1;
      });

      setStats({ total, byStatus, byReviewStatus });
    } catch (err: unknown) {
      if ((err as any).statusCode === 401) {
        router.push('/login');
      } else {
        setError((err as Error).message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, router]);

  useEffect(() => {
    loadShots();
  }, [loadShots]);

  const handleSelectShot = (shotId: string) => {
    const newSelected = new Set(selectedShots);
    if (newSelected.has(shotId)) {
      newSelected.delete(shotId);
    } else {
      newSelected.add(shotId);
    }
    setSelectedShots(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedShots.size === shots.length) {
      setSelectedShots(new Set());
    } else {
      setSelectedShots(new Set(shots.map((s) => s.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedShots.size === 0) return;
    try {
      setBatchOperating(true);
      await projectApi.batchReview(Array.from(selectedShots), 'APPROVED');
      setSelectedShots(new Set());
      await loadShots();
    } catch (err: unknown) {
      alert((err as Error).message || '批量审核失败');
    } finally {
      setBatchOperating(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedShots.size === 0) return;
    if (!rejectNote.trim()) {
      alert('请输入驳回原因');
      return;
    }
    try {
      setBatchOperating(true);
      await projectApi.batchReview(Array.from(selectedShots), 'REJECTED', rejectNote);
      setSelectedShots(new Set());
      setShowRejectDialog(false);
      setRejectNote('');
      await loadShots();
    } catch (err: unknown) {
      alert((err as Error).message || '批量驳回失败');
    } finally {
      setBatchOperating(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (selectedShots.size === 0) return;
    try {
      setBatchOperating(true);
      const result = await projectApi.batchGenerate(Array.from(selectedShots), 'IMAGE');
      setSelectedShots(new Set());
      // 显示提示信息
      if (result?.message) {
        alert(result.message);
      }
      // 等待一下让 Worker 处理
      setTimeout(() => {
        loadShots();
        setBatchOperating(false);
      }, 2000);
    } catch (err: unknown) {
      alert((err as Error).message || '批量生成失败');
      setBatchOperating(false);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: '#999',
    READY: '#2196F3',
    GENERATING: '#FF9800',
    GENERATED: '#4CAF50',
    FAILED: '#F44336',
  };

  const reviewStatusColors: Record<string, string> = {
    PENDING: '#999',
    APPROVED: '#4CAF50',
    REJECTED: '#F44336',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* 左侧过滤栏 */}
      <div
        style={{
          width: '280px',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          padding: '1.5rem',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>筛选条件</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              关键词搜索
            </label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })}
              placeholder="搜索 title/description/dialogue"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              生成状态
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">全部</option>
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
              <option value="GENERATING">GENERATING</option>
              <option value="GENERATED">GENERATED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              审核状态
            </label>
            <select
              value={filters.reviewStatus}
              onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">全部</option>
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              项目 ID
            </label>
            <input
              type="text"
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value, page: 1 })}
              placeholder="项目 ID"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <button
            onClick={() => {
              setFilters({
                projectId: '',
                seasonId: '',
                episodeId: '',
                sceneId: '',
                status: '',
                reviewStatus: '',
                q: '',
                page: 1,
                pageSize: 20,
              });
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            清除筛选
          </button>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 统计条 */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: 'white',
            display: 'flex',
            gap: '2rem',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>总计: </span>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>{stats.total}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status}>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>{status}: </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: statusColors[status] || '#666',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {Object.entries(stats.byReviewStatus).map(([status, count]) => (
              <div key={status}>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>{status}: </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: reviewStatusColors[status] || '#666',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedShots.size > 0 && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: '#e3f2fd',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>
              已选择 {selectedShots.size} 项
            </span>
            <button
              onClick={handleBatchApprove}
              disabled={batchOperating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: batchOperating ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchOperating ? 'not-allowed' : 'pointer',
              }}
            >
              批量通过
            </button>
            <button
              onClick={() => setShowRejectDialog(true)}
              disabled={batchOperating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: batchOperating ? '#ccc' : '#F44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchOperating ? 'not-allowed' : 'pointer',
              }}
            >
              批量驳回
            </button>
            <button
              onClick={handleBatchGenerate}
              disabled={batchOperating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: batchOperating ? '#ccc' : '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchOperating ? 'not-allowed' : 'pointer',
              }}
            >
              批量生成
            </button>
            <button
              onClick={() => setSelectedShots(new Set())}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: '#f0f0f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              取消选择
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              margin: '1rem 1.5rem',
              padding: '0.75rem',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Shots 表格 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>加载中...</div>
          ) : shots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>暂无数据</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={selectedShots.size === shots.length && shots.length > 0}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>标题</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    所属层级
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>状态</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    审核状态
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    生成时间
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((shot) => (
                  <tr
                    key={shot.id}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: selectedShots.has(shot.id) ? '#e3f2fd' : 'white',
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedShots.has(shot.id)}
                        onChange={() => handleSelectShot(shot.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>{shot.title || `Shot ${shot.index}`}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
                      <div>{shot.projectName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {shot.seasonName} / {shot.episodeName} / Scene {shot.sceneIndex}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor: statusColors[shot.status] || '#999',
                          color: 'white',
                          borderRadius: '4px',
                        }}
                      >
                        {shot.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor:
                            reviewStatusColors[shot.reviewStatus || 'PENDING'] || '#999',
                          color: 'white',
                          borderRadius: '4px',
                        }}
                      >
                        {shot.reviewStatus || 'PENDING'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
                      {shot.generatedAt ? new Date(shot.generatedAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {shot.previewUrl && (
                          <a
                            href={shot.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.8125rem',
                              color: '#0070f3',
                              textDecoration: 'none',
                            }}
                          >
                            预览
                          </a>
                        )}
                        <Link
                          href={`/projects/${shot.projectId}`}
                          style={{
                            fontSize: '0.8125rem',
                            color: '#0070f3',
                            textDecoration: 'none',
                          }}
                        >
                          打开项目
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页 */}
        {!loading && shots.length > 0 && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              第 {filters.page} 页，共 {Math.ceil(stats.total / filters.pageSize)} 页
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: filters.page === 1 ? '#f0f0f0' : '#0070f3',
                  color: filters.page === 1 ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: filters.page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                上一页
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= Math.ceil(stats.total / filters.pageSize)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor:
                    filters.page >= Math.ceil(stats.total / filters.pageSize)
                      ? '#f0f0f0'
                      : '#0070f3',
                  color:
                    filters.page >= Math.ceil(stats.total / filters.pageSize) ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    filters.page >= Math.ceil(stats.total / filters.pageSize)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 驳回对话框 */}
      {showRejectDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRejectDialog(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              width: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>批量驳回</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="请输入统一的驳回原因或修改建议"
              rows={4}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectNote('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                取消
              </button>
              <button
                onClick={handleBatchReject}
                disabled={batchOperating}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: batchOperating ? '#ccc' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: batchOperating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {batchOperating ? '提交中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
