"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetModule = void 0;
const common_1 = require("@nestjs/common");
const asset_controller_1 = require("./asset.controller");
const asset_service_1 = require("./asset.service");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const auth_module_1 = require("../auth/auth.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const permission_module_1 = require("../permission/permission.module");
const asset_delivery_controller_1 = require("./asset-delivery.controller");
const internal_asset_controller_1 = require("./internal-asset.controller");
let AssetModule = class AssetModule {
};
exports.AssetModule = AssetModule;
exports.AssetModule = AssetModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_log_module_1.AuditLogModule, auth_module_1.AuthModule, api_security_module_1.ApiSecurityModule, permission_module_1.PermissionModule],
        controllers: [asset_controller_1.AssetController, asset_delivery_controller_1.AssetDeliveryController, internal_asset_controller_1.InternalAssetController],
        providers: [asset_service_1.AssetService],
        exports: [asset_service_1.AssetService],
    })
], AssetModule);
//# sourceMappingURL=asset.module.js.map