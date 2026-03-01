'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { userApi, authApi, organizationApi } from '@/lib/apiClient';
import { useRouter } from 'next/navigation';

import { UserDTO } from '@/types/dto';

export default function UserInfo() {
  const router = useRouter();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [organizations, setOrganizations] = useState<
    Array<{
      id: string;
      name: string;
      slug?: string;
      role: string;
      joinedAt: string;
    }>
  >([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, orgsData] = await Promise.all([
          userApi.getCurrentUser(),
          organizationApi.getUserOrganizations(),
        ]);
        setUser(userData as UserDTO);
        setOrganizations(orgsData);
        // 设置当前组织（优先使用 defaultOrganizationId，否则使用第一个）
        if ((userData as UserDTO).currentOrganizationId) {
          setCurrentOrganizationId((userData as UserDTO).currentOrganizationId!);
        } else if (orgsData.length > 0) {
          setCurrentOrganizationId(orgsData[0].id);
        }
      } catch (error: unknown) {
        // 401 时自动跳转登录
        if (typeof window !== 'undefined') {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await authApi.logout();
    router.push('/login');
  };

  const handleSwitchOrganization = async (organizationId: string) => {
    try {
      await organizationApi.switchOrganization(organizationId);
      // 切换成功后刷新页面，让后端重新解析组织上下文
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch organization:', error);
      alert('切换组织失败，请重试');
    }
  };

  const currentOrganization = organizations.find((org) => org.id === currentOrganizationId);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Link
        href="/projects"
        style={{
          fontSize: '0.875rem',
          color: '#0070f3',
          textDecoration: 'none',
          marginRight: '0.5rem',
        }}
      >
        项目
      </Link>
      <Link
        href="/studio/review"
        style={{
          fontSize: '0.875rem',
          color: '#0070f3',
          textDecoration: 'none',
          marginRight: '0.5rem',
        }}
      >
        导演工作台
      </Link>
      <Link
        href="/studio/jobs"
        style={{
          fontSize: '0.875rem',
          color: '#0070f3',
          textDecoration: 'none',
          marginRight: '0.5rem',
        }}
      >
        任务监控
      </Link>
      {/* Studio v0.7: 组织切换 */}
      {currentOrganization && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>组织:</span>
          {organizations.length > 1 ? (
            <select
              value={currentOrganizationId || ''}
              onChange={(e) => handleSwitchOrganization(e.target.value)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.875rem' }}>{currentOrganization.name}</span>
          )}
        </div>
      )}
      <span style={{ fontSize: '0.875rem' }}>{user.email}</span>
      <button
        onClick={handleLogout}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#f33',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        退出
      </button>
    </div>
  );
}
