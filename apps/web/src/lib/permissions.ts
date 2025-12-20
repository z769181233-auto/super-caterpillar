/**
 * 权限常量（与后端对齐）
 * 禁止硬编码权限字符串
 */

// 系统级权限
export const SystemPermissions = {
  AUTH: 'auth',
  AUDIT: 'audit',
  MODEL_USE: 'model.use',
  BILLING: 'billing',
} as const;

// 项目级权限
export const ProjectPermissions = {
  PROJECT_READ: 'project.read',
  PROJECT_WRITE: 'project.write',
  PROJECT_GENERATE: 'project.generate',
  PROJECT_REVIEW: 'project.review',
  PROJECT_PUBLISH: 'project.publish',
  PROJECT_DELETE: 'project.delete',
} as const;

export type SystemPermission = (typeof SystemPermissions)[keyof typeof SystemPermissions];
export type ProjectPermission = (typeof ProjectPermissions)[keyof typeof ProjectPermissions];

/**
 * TODO: 权限获取接口（占位实现）
 * 
 * 当前权限判断为占位逻辑，所有权限默认返回 true。
 * 
 * 未来接入真实权限时，需要：
 * 1. 从用户信息或权限接口获取当前用户的权限列表
 * 2. 实现 usePermissions(projectId) hook 或从 userStore 中读取
 * 3. 统一在此处判断权限，不要在组件内部写死权限字符串或随意判断
 * 
 * 示例实现（未来）：
 * ```typescript
 * export async function getUserPermissions(userId: string, projectId?: string): Promise<{
 *   system: SystemPermission[];
 *   project: ProjectPermission[];
 * }> {
 *   // 从 API 获取权限
 *   const response = await fetch(`/api/users/${userId}/permissions${projectId ? `?projectId=${projectId}` : ''}`);
 *   return response.json();
 * }
 * ```
 */
export interface UserPermissions {
  system: SystemPermission[];
  project: ProjectPermission[];
}

/**
 * 占位实现：默认返回所有权限
 * TODO: 替换为真实权限获取逻辑
 */
export function getDefaultPermissions(): UserPermissions {
  return {
    system: Object.values(SystemPermissions),
    project: Object.values(ProjectPermissions),
  };
}

/**
 * 检查用户是否有指定权限
 * TODO: 替换为真实权限检查逻辑
 */
export function hasPermission(
  userPermissions: UserPermissions | null,
  permission: SystemPermission | ProjectPermission
): boolean {
  if (!userPermissions) {
    // 占位实现：默认有权限
    return true;
  }
  
  return (
    userPermissions.system.includes(permission as SystemPermission) ||
    userPermissions.project.includes(permission as ProjectPermission)
  );
}

