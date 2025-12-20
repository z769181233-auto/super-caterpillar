'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { authApi } from '@/lib/apiClient';
import Link from 'next/link';

function getSafeFrom(raw: string | null): string {
  if (!raw) return '';

  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    // keep raw
  }

  v = v.trim();

  // 禁止控制字符（CR/LF/NULL 等）
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code < 32 || code === 127) return '';
  }

  // 必须是站内绝对路径
  if (!v.startsWith('/')) return '';
  if (v.startsWith('//')) return '';

  // 禁止反斜杠路径/混淆
  if (v.includes('\\')) return '';
  if (v.startsWith('/\\')) return '';

  // 禁止跳到 Next/内部接口
  if (v.startsWith('/api') || v.startsWith('/_next')) return '';

  return v;
}

// 替代 regex 的安全清洗函数（不使用 control regex avoid eslint warning）
function sanitizeInput(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // 允许：TAB(9), LF(10), CR(13) 可按需保留；这里简单剔除 < 32 和 DEL(127)
    if (code < 32 || code === 127) continue;
    out += s[i];
  }
  return out.trim();
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 提取 locale，供跳转和注册链接使用
  const m = pathname.match(/^\/(zh|en)(\/|$)/);
  const locale = (m?.[1] as 'zh' | 'en') || 'en';

  const redirect = getSafeFrom(searchParams.get('from'));

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const emailSafe = sanitizeInput(email);
      const passwordSafe = sanitizeInput(password);

      if (!emailSafe) throw new Error('请输入有效邮箱');
      if (passwordSafe.length < 6) throw new Error('密码长度不足');

      await authApi.login(emailSafe, passwordSafe);
      // PREVENT_FLICKER: Use replace if we want to replace login in history, but push is standard.
      // Plan says: 'handleLogin 成功后 router.push(redirect || ...)'
      router.push(redirect || `/${locale}/projects`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#fafafa',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h1
          style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.5rem',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          登录
        </h1>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#333',
              }}
            >
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#333',
              }}
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
              placeholder="至少 6 个字符"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: 'white',
              backgroundColor: loading ? '#999' : '#0070f3',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#666',
          }}
        >
          还没有账号？{' '}
          <Link
            href={`/${locale}/register`}
            style={{
              color: '#0070f3',
              textDecoration: 'none',
            }}
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  );
}

