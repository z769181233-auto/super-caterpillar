"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentOrganization = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentOrganization = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const orgIdFromHeader = typeof request.get === 'function'
        ? request.get('x-organization-id')
        : request.headers['x-organization-id'];
    if (orgIdFromHeader)
        return orgIdFromHeader;
    return request.user?.organizationId || request.apiKeyOwnerOrgId || null;
});
//# sourceMappingURL=current-organization.decorator.js.map