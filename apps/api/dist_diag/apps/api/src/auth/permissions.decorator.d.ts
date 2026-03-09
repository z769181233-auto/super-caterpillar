import { SystemPermission, ProjectPermission } from '../permission/permission.constants';
export declare const PERMISSIONS_KEY = "required_permissions";
export type RequiredPermission = SystemPermission | ProjectPermission;
export declare const Permissions: (...perms: RequiredPermission[]) => import("@nestjs/common").CustomDecorator<string>;
