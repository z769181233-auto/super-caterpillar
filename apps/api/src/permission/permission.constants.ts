// 权限枚举（固定，不得硬编码字符串）
export const SystemPermissions = {
  AUTH: 'auth',
  AUDIT: 'audit',
  MODEL_USE: 'model.use',
  BILLING: 'billing',
  PROJECT_CREATE: 'project.create',
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',
  MODEL_USE_BASE: 'model.use.base',
  NOVEL_UPLOAD: 'novel.upload',
  NOVEL_READ: 'novel.read',
  NOVEL_UPDATE: 'novel.update',
  STRUCTURE_READ: 'structure.read',
} as const;

export const ProjectPermissions = {
  PROJECT_READ: 'project.read',
  PROJECT_WRITE: 'project.write',
  PROJECT_UPDATE: 'project.update',
  PROJECT_GENERATE: 'project.generate',
  PROJECT_REVIEW: 'project.review',
  PROJECT_PUBLISH: 'project.publish',
  PROJECT_DELETE: 'project.delete',
} as const;

export type SystemPermission = (typeof SystemPermissions)[keyof typeof SystemPermissions];
export type ProjectPermission = (typeof ProjectPermissions)[keyof typeof ProjectPermissions];
