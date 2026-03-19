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
export interface UserPermissions {
  system: SystemPermission[];
  project: ProjectPermission[];
}
