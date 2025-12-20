import { redirect } from 'next/navigation';

/**
 * Studio 根路由（遵循产品规范：Studio 默认入口必须跳转到主功能页）
 * 禁止写业务逻辑，只允许保持轻量级重定向。
 */
export default function StudioIndexPage() {
  redirect('/projects');
}

