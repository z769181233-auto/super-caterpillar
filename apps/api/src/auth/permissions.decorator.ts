import { SetMetadata } from '@nestjs/common';
import { SystemPermission, ProjectPermission } from '../permission/permission.constants';

export const PERMISSIONS_KEY = 'required_permissions';
export type RequiredPermission = SystemPermission | ProjectPermission;

/**
 * @Permissions
 * 用于声明当前路由所需权限（系统级或项目级）
 */
export const Permissions = (...perms: RequiredPermission[]) => SetMetadata(PERMISSIONS_KEY, perms);

