'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { authApi } from '@/lib/apiClient';
import Link from 'next/link';

// 复制自 login/page.tsx 的安全清洗函数
function sanitizeInput(s: string): string {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 32 || code === 127) continue;
        out += s[i];
    }
    return out.trim();
}

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 提取 locale
    const m = pathname.match(/^\/(zh|en)(\/|$)/);
    const locale = (m?.[1] as 'zh' | 'en') || 'en';

    const redirect = searchParams.get('from');

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const emailSafe = sanitizeInput(email);
            const passwordSafe = sanitizeInput(password);

            if (!emailSafe) throw new Error('请输入有效邮箱');
            if (passwordSafe.length < 6) throw new Error('密码长度不足');

            await authApi.register(emailSafe, passwordSafe);
            // 注册成功自动登录或跳转登录？
            // generateTokens会在注册时返回，通常直接登录成功。
            // 跳转到项目页
            router.push(`/${locale}/projects`);
        } catch (err: any) {
            const message = err.message || '注册失败';
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
                    注册
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

                <form onSubmit={handleRegister}>
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
                        {loading ? '注册中...' : '注册'}
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
                    已有账号？{' '}
                    <Link
                        href={`/${locale}/login`}
                        style={{
                            color: '#0070f3',
                            textDecoration: 'none',
                        }}
                    >
                        登录
                    </Link>
                </div>
            </div>
        </div>
    );
}
