"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const throttler_1 = require("@nestjs/throttler");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const config_1 = require("@scu/config");
const api_security_guard_1 = require("./security/api-security/api-security.guard");
const trace_middleware_1 = require("./observability/trace.middleware");
const operational_gate_guard_1 = require("./common/guards/operational-gate.guard");
const bible_alias_controller_1 = require("./bible/bible-alias.controller");
const JOB_WORKER_ENABLED = config_1.env.enableInternalJobWorker;
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(trace_middleware_1.TraceMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [
            app_controller_1.AppController,
            bible_alias_controller_1.BibleAliasController,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: api_security_guard_1.ApiSecurityGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: operational_gate_guard_1.OperationalGateGuard,
            },
            {
                provide: core_1.APP_FILTER,
                useClass: all_exceptions_filter_1.AllExceptionsFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map