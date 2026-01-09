'use client';

import { useState } from 'react';
// TODO: autofillApi 未实现，暂时注释
// import { autofillApi } from '@/lib/apiClient';

export default function AutofillPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAutofill = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // TODO: autofillApi 未实现，暂时返回占位数据
      // const response = await autofillApi.runAutofill();
      const response = { message: 'Autofill API not implemented yet' };
      setResult(response);
      console.log('Autofill result:', response);
    } catch (err: any) {
      const errorMessage = err?.message || 'Autofill failed';
      setError(errorMessage);
      console.error('Autofill error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>自动填充数据（Auto Fill）</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        此工具将自动创建完整的 Season / Episode / Scene / Shot 数据结构。
      </p>

      <button
        onClick={handleAutofill}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '2rem',
        }}
      >
        {loading ? '填充中...' : '开始自动填充'}
      </button>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
            marginBottom: '1rem',
          }}
        >
          错误: {error}
        </div>
      )}

      {result && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '4px',
            marginTop: '1rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>完成填充</h2>
          <div style={{ marginTop: '1rem' }}>
            <p>
              <strong>Seasons:</strong> {result.data?.seasons || result.seasons}
            </p>
            <p>
              <strong>Episodes per Season:</strong>{' '}
              {result.data?.episodes_per_season || result.episodes_per_season}
            </p>
            <p>
              <strong>Scenes per Episode:</strong>{' '}
              {result.data?.scenes_per_episode || result.scenes_per_episode}
            </p>
            <p>
              <strong>Shots per Scene:</strong>{' '}
              {result.data?.shots_per_scene || result.shots_per_scene}
            </p>
            {result.data?.projectId && (
              <p>
                <strong>Project ID:</strong> {result.data.projectId}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
