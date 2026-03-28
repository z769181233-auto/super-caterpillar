import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '../lib/api';
import type { ProjectSnapshot } from '../lib/types';

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('项目名不能为空');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const snapshot = await createProject<ProjectSnapshot>({
        name: name.trim(),
        description: description.trim() || undefined
      });

      setName('');
      setDescription('');
      router.push(`/projects/${snapshot.project.id}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '创建项目失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="create-form">
      <div className="form-head">
        <h3 className="form-title">建立新的导演工程</h3>
        <p className="form-hint">创建后将直接进入原著导入与导演工作台。</p>
      </div>

      <div className="field">
        <label className="label">项目名称</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：万古神帝 · 动画改编"
          className="input"
        />
      </div>

      <div className="field">
        <label className="label">制作目标 (可选)</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="描述本次制作的视觉风格或核心目标。"
          rows={4}
          className="textarea"
        />
      </div>

      <button type="submit" disabled={submitting} className="submit-btn btn-primary">
        {submitting ? '正在初始化工作台...' : '创建并进入'}
      </button>

      {error ? <div className="error-msg">{error}</div> : null}

      <style jsx>{`
        .create-form {
          display: grid;
          gap: 24px;
        }

        .form-head {
          margin-bottom: 8px;
        }

        .form-title {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .form-hint {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-subtle);
        }

        .input, .textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          color: var(--text-main);
          padding: 14px 16px;
          font-size: 15px;
          transition: var(--transition-normal);
        }

        .input:focus, .textarea:focus {
          outline: none;
          border-color: var(--accent);
          background: rgba(0,0,0, 0.4);
        }

        .submit-btn {
          width: 100%;
          border: none;
          padding: 16px;
          border-radius: var(--radius-full);
          font-weight: 800;
          cursor: pointer;
          transition: var(--transition-normal);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .error-msg {
          padding: 12px 16px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.2);
          color: #ff8e8e;
          border-radius: var(--radius-md);
          font-size: 13px;
        }
      `}</style>
    </form>
  );
}

