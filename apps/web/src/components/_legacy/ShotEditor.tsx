'use client';

import { useState, useEffect, useCallback } from 'react';
import { projectApi, jobApi } from '@/lib/apiClient';

interface Shot {
  id: string;
  index: number;
  type: string;
  status: string;
  title?: string;
  description?: string;
  dialogue?: string;
  prompt?: string;
  reviewStatus?: string;
  reviewNote?: string;
  previewUrl?: string;
  generatedAt?: string;
  reviewedAt?: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  result?: any;
  attempts?: number;
  maxAttempts?: number;
  lastError?: string;
}

interface ShotEditorProps {
  shot: Shot | null;
  onUpdate: () => void;
}

export default function ShotEditor({ shot, onUpdate }: ShotEditorProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<string>('mock'); // Studio v0.6: 引擎选择
  const [reviewing, setReviewing] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dialogue: '',
    prompt: '',
  });

  const loadJobs = useCallback(async () => {
    if (!shot) return;
    try {
      setLoadingJobs(true);
      const result = await projectApi.getJobsByShot(shot.id);
      setJobs(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, [shot]);

  useEffect(() => {
    if (shot) {
      setFormData({
        title: shot.title || '',
        description: shot.description || '',
        dialogue: shot.dialogue || '',
        prompt: shot.prompt || '',
      });
      setEditing(false);
      loadJobs();
    }
  }, [shot, loadJobs]);

  const handleSave = async () => {
    if (!shot) return;
    try {
      setSaving(true);
      await projectApi.updateShot(shot.id, {
        title: formData.title,
        description: formData.description,
        dialogue: formData.dialogue,
        prompt: formData.prompt,
      });
      setEditing(false);
      onUpdate();
    } catch (error: unknown) {
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!shot) return;
    try {
      setGenerating(true);
      // Studio v0.6: 使用 jobApi.createJob 并传递 engine
      await jobApi.createJob(
        shot.id,
        'IMAGE',
        {
          prompt: formData.prompt || formData.description,
          style: shot.type,
        },
        selectedEngine
      );
      // 等待一下让后端处理
      setTimeout(() => {
        onUpdate();
        loadJobs();
        setGenerating(false);
      }, 2000);
    } catch (error: unknown) {
      alert((error as Error).message || '生成失败');
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!shot) return;
    try {
      setReviewing(true);
      await projectApi.updateShot(shot.id, {
        reviewStatus: 'APPROVED',
        reviewedAt: new Date().toISOString(),
      });
      onUpdate();
      setReviewing(false);
    } catch (error: unknown) {
      alert((error as Error).message || '审核失败');
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!shot) return;
    if (!rejectNote.trim()) {
      alert('请输入驳回原因');
      return;
    }
    try {
      setReviewing(true);
      await projectApi.updateShot(shot.id, {
        reviewStatus: 'REJECTED',
        reviewNote: rejectNote,
        reviewedAt: new Date().toISOString(),
      });
      setShowRejectDialog(false);
      setRejectNote('');
      onUpdate();
      setReviewing(false);
    } catch (error: unknown) {
      alert((error as Error).message || '审核失败');
      setReviewing(false);
    }
  };

  if (!shot) {
    return (
      <div
        style={{
          width: '400px',
          borderLeft: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        选择一个 Shot 开始编辑
      </div>
    );
  }

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
    <div
      style={{
        width: '400px',
        borderLeft: '1px solid #e0e0e0',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e0e0e0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Shot {shot.index}</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              编辑
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
          <span
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              backgroundColor: reviewStatusColors[shot.reviewStatus || 'PENDING'] || '#999',
              color: 'white',
              borderRadius: '4px',
            }}
          >
            {shot.reviewStatus || 'PENDING'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {editing ? (
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
                标题
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
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
                对白
              </label>
              <textarea
                value={formData.dialogue}
                onChange={(e) => setFormData({ ...formData, dialogue: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
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
                Prompt
              </label>
              <textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: saving ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  if (shot) {
                    setFormData({
                      title: shot.title || '',
                      description: shot.description || '',
                      dialogue: shot.dialogue || '',
                      prompt: shot.prompt || '',
                    });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {shot.title && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  标题
                </div>
                <div style={{ fontSize: '0.875rem' }}>{shot.title}</div>
              </div>
            )}

            {shot.description && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  描述
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {shot.description}
                </div>
              </div>
            )}

            {shot.dialogue && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  对白
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{shot.dialogue}</div>
              </div>
            )}

            {shot.prompt && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  Prompt
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: '#666' }}>
                  {shot.prompt}
                </div>
              </div>
            )}

            {shot.previewUrl && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  预览
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.open(shot.previewUrl, '_blank')}
                >
                  <span style={{ color: '#666' }}>点击查看预览</span>
                </div>
              </div>
            )}

            {shot.reviewNote && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                  审核意见
                </div>
                <div style={{ fontSize: '0.875rem', color: '#F44336', whiteSpace: 'pre-wrap' }}>
                  {shot.reviewNote}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {!editing && (
          <div
            style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {/* Studio v0.6: 引擎选择 */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                引擎
              </label>
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem',
                }}
              >
                <option value="mock">Mock（模拟）</option>
                <option value="real-http">Real HTTP（真实引擎骨架）</option>
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || shot.status === 'GENERATING'}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: generating || shot.status === 'GENERATING' ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: generating || shot.status === 'GENERATING' ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {generating || shot.status === 'GENERATING' ? '生成中...' : '发起生成'}
            </button>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#666',
                marginTop: '0.5rem',
                textAlign: 'center',
              }}
            >
              任务将在后台队列中处理，请稍后刷新查看状态
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleApprove}
                disabled={reviewing || shot.reviewStatus === 'APPROVED'}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor:
                    reviewing || shot.reviewStatus === 'APPROVED' ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: reviewing || shot.reviewStatus === 'APPROVED' ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                通过
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={reviewing || shot.reviewStatus === 'REJECTED'}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor:
                    reviewing || shot.reviewStatus === 'REJECTED' ? '#ccc' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: reviewing || shot.reviewStatus === 'REJECTED' ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                驳回
              </button>
            </div>
          </div>
        )}

        {/* Job 历史 */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            生成历史
          </div>
          {loadingJobs ? (
            <div style={{ fontSize: '0.8125rem', color: '#999' }}>加载中...</div>
          ) : jobs.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: '#999' }}>暂无生成记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{job.type}</span>
                    <span
                      style={{
                        padding: '0.125rem 0.375rem',
                        fontSize: '0.75rem',
                        backgroundColor:
                          job.status === 'SUCCEEDED'
                            ? '#4CAF50'
                            : job.status === 'FAILED'
                              ? '#F44336'
                              : '#FF9800',
                        color: 'white',
                        borderRadius: '4px',
                      }}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    {new Date(job.createdAt).toLocaleString('zh-CN')}
                  </div>
                  {/* Studio v0.4: 显示重试信息 */}
                  {(job.attempts !== undefined || job.maxAttempts !== undefined) && (
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                      尝试: {job.attempts || 0} / {job.maxAttempts || 3}
                    </div>
                  )}
                  {job.lastError && (
                    <div style={{ fontSize: '0.75rem', color: '#F44336', marginTop: '0.25rem' }}>
                      错误: {job.lastError}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>驳回原因</h3>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="请输入驳回原因或修改建议"
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
                onClick={handleReject}
                disabled={reviewing}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: reviewing ? '#ccc' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: reviewing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {reviewing ? '提交中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
