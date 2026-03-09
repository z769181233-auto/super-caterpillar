"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicMetricsController = exports.MonitoringController = void 0;
const common_1 = require("@nestjs/common");
const monitoring_service_1 = require("./monitoring.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const observability_1 = require("@scu/observability");
let MonitoringController = class MonitoringController {
    monitoringService;
    constructor(monitoringService) {
        this.monitoringService = monitoringService;
    }
    async getP1Metrics() {
        return this.monitoringService.getP1Metrics();
    }
};
exports.MonitoringController = MonitoringController;
__decorate([
    (0, common_1.Get)('p1'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MonitoringController.prototype, "getP1Metrics", null);
exports.MonitoringController = MonitoringController = __decorate([
    (0, common_1.Controller)('admin/metrics'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [monitoring_service_1.MonitoringService])
], MonitoringController);
let PublicMetricsController = class PublicMetricsController {
    async getPrometheusMetrics() {
        return observability_1.registry.metrics();
    }
};
exports.PublicMetricsController = PublicMetricsController;
__decorate([
    (0, common_1.Get)('metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublicMetricsController.prototype, "getPrometheusMetrics", null);
exports.PublicMetricsController = PublicMetricsController = __decorate([
    (0, common_1.Controller)()
], PublicMetricsController);
//# sourceMappingURL=monitoring.controller.js.map