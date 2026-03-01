'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function getLocaleFromPath(pathname: string | null): 'zh' | 'en' {
  const p = pathname || '';
  const m = p.match(/^\/(zh|en)(\/|$)/);
  return (m?.[1] as 'zh' | 'en') || 'en';
}

interface CustomError {
  status?: number;
  code?: string;
  message?: string;
}

function isUnauthorizedError(err: unknown): boolean {
  const e = err as CustomError;
  // ✅ 优先用结构化字段判断（最稳）
  if (e?.status === 401) return true;
  if (e?.code === 'UNAUTHORIZED') return true;

  // 兜底：兼容历史实现（但不作为主路径）
  const msg = String(e?.message || '');
  return msg === 'Unauthorized' || msg.includes('Unauthorized');
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string; status?: number; code?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const locale = getLocaleFromPath(pathname);
  const unauthorized = isUnauthorizedError(error);

  useEffect(() => {
    if (!unauthorized) return;

    // ✅ 防止在登录页/注册页循环重定向
    const p = pathname || '';
    if (p.includes('/login') || p.includes('/register')) return;

    // ✅ 带上 from（包含 query）
    const from =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : pathname || '/';

    router.replace(`/${locale}/login?from=${encodeURIComponent(from)}`);
  }, [unauthorized, pathname, router, locale]);

  // Unauthorized：不渲染错误堆栈，避免闪烁
  if (unauthorized) return null;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>页面发生错误</h2>
      <p style={{ marginTop: 8, opacity: 0.8 }}>{error?.message || 'Unknown error'}</p>
      <button
        onClick={() => reset()}
        style={{ marginTop: 16, padding: '8px 12px', cursor: 'pointer' }}
      >
        重试
      </button>
    </div>
  );
}
