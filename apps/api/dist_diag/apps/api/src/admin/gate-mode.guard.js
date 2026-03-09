"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateModeGuard = void 0;
const common_1 = require("@nestjs/common");
let GateModeGuard = class GateModeGuard {
    canActivate(_ctx) {
        if (process.env.GATE_MODE === '1' || process.env.GATE_MODE === 'test')
            return true;
        throw new common_1.ForbiddenException('GATE_MODE required');
    }
};
exports.GateModeGuard = GateModeGuard;
exports.GateModeGuard = GateModeGuard = __decorate([
    (0, common_1.Injectable)()
], GateModeGuard);
//# sourceMappingURL=gate-mode.guard.js.map