"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutofillModule = void 0;
const common_1 = require("@nestjs/common");
const autofill_controller_1 = require("./autofill.controller");
const autofill_service_1 = require("./autofill.service");
const prisma_module_1 = require("../prisma/prisma.module");
const project_module_1 = require("../project/project.module");
const organization_module_1 = require("../organization/organization.module");
let AutofillModule = class AutofillModule {
};
exports.AutofillModule = AutofillModule;
exports.AutofillModule = AutofillModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, project_module_1.ProjectModule, organization_module_1.OrganizationModule],
        controllers: [autofill_controller_1.AutofillController],
        providers: [autofill_service_1.AutofillService],
    })
], AutofillModule);
//# sourceMappingURL=autofill.module.js.map