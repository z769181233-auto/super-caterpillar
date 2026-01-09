'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { novelImportApi } from '@/lib/apiClient';
import { useTranslations } from 'next-intl';

export default function MinimalImportPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const locale = params.locale as string;
  const t = useTranslations('Projects.Analysis');

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleBack = () => {
    router.push(`/${locale}/projects/${projectId}`);
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      // 最小实现：将文本转为 Blob 并作为文件上传
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], 'quick_import.txt', { type: 'text/plain' });

      setMsg('正在上传文件并解析元数据...');
      const uploadResult = await novelImportApi.importNovelFile(projectId, file);

      // 提交基本信息
      await novelImportApi.importNovel(projectId, {
        novelName: 'Quick Import ' + new Date().toLocaleDateString(),
        author: 'User',
        fileUrl: uploadResult.fileUrl || '',
      });

      // 启动分析
      await novelImportApi.analyzeNovel(projectId);

      setMsg('导入成功，正在启动分析... 即将跳转回项目主页');
      setTimeout(() => {
        router.push(`/${locale}/projects/${projectId}`);
      }, 2000);
    } catch (e: any) {
      console.error('Import Error:', e);
      setMsg('失败: ' + (e.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: '#e5e7eb' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>{t('import')} (Quick Mode)</h1>
        <button onClick={handleBack} className="btn btn-ghost btn-md">
          返回项目
        </button>
      </div>

      <div className="glass-panel p-8 space-y-6 flex flex-col">
        <p style={{ color: '#9ca3af' }}>请直接粘贴小说内容，点击提交后 AI 将开始解析结构。</p>

        <textarea
          style={{
            width: '100%',
            minHeight: '300px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: '#fff',
            border: '1px solid hsla(210, 40%, 98%, 0.1)',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '14px',
            outline: 'none',
          }}
          placeholder="在此处粘贴小说正文..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {msg && <div style={{ color: msg.startsWith('失败') ? '#ef4444' : '#10b981' }}>{msg}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="btn btn-primary btn-lg w-full"
          style={{ opacity: loading || !text.trim() ? 0.5 : 1 }}
        >
          {loading ? '正在处理...' : '确认导入并启动分析'}
        </button>
      </div>

      <style jsx>{`
        .flex {
          display: flex;
        }
        .flex-col {
          flex-direction: column;
        }
        .space-y-6 > * + * {
          margin-top: 1.5rem;
        }
        .p-8 {
          padding: 2rem;
        }
      `}</style>
    </div>
  );
}
