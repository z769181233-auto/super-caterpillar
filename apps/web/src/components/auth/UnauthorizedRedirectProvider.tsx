'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Locale = 'zh' | 'en';

function getLocaleFromPath(pathname: string | null): Locale {
    const p = pathname || '';
    const m = p.match(/^\/(zh|en)(\/|$)/);
    return (m?.[1] as Locale) || 'en';
}

function buildFrom(): string {
    if (typeof window === 'undefined') return '/';
    return `${window.location.pathname}${window.location.search}`;
}

function isUnauthorizedError(err: unknown): boolean {
    const e = err as { status?: number; code?: string; message?: string };
    if (e?.status === 401) return true;
    if (e?.code === 'UNAUTHORIZED') return true;
    const msg = String(e?.message || '');
    return msg === 'Unauthorized' || msg.includes('Unauthorized');
}

declare global {
    // eslint-disable-next-line no-var
    var __scu_onUnauthorized: undefined | ((from?: string) => void);
}

export default function UnauthorizedRedirectProvider() {
    const router = useRouter();
    const pathname = usePathname();
    const redirectingRef = useRef(false);

    useEffect(() => {
        const locale = getLocaleFromPath(pathname);

        const doRedirect = (from?: string) => {
            if (redirectingRef.current) return;

            const p = pathname || '';
            if (p.includes('/login') || p.includes('/register')) return;

            redirectingRef.current = true;
            const finalFrom = from || buildFrom();
            // Using searchParams to handle encoding automatically
            const params = new URLSearchParams();
            params.set('from', finalFrom);
            router.replace(`/${locale}/login?${params.toString()}`);
            // 允许后续再次触发（比如用户登出后再进来）
            setTimeout(() => {
                redirectingRef.current = false;
            }, 500);
        };

        // ✅ 提供给业务 catch 主动调用（可选）
        globalThis.__scu_onUnauthorized = doRedirect;

        // ✅ 覆盖事件/Promise 链路（未捕获的 401）
        const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
            if (isUnauthorizedError(ev.reason)) {
                ev.preventDefault?.();
                doRedirect();
            }
        };

        // ✅ 兜底：某些场景走 window.onerror
        const onError = (ev: ErrorEvent) => {
            if (isUnauthorizedError(ev.error)) {
                ev.preventDefault?.();
                doRedirect();
            }
        };

        window.addEventListener('unhandledrejection', onUnhandledRejection);
        window.addEventListener('error', onError);

        return () => {
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            window.removeEventListener('error', onError);
            if (globalThis.__scu_onUnauthorized === doRedirect) {
                globalThis.__scu_onUnauthorized = undefined;
            }
        };
    }, [pathname, router]);

    return null;
}
