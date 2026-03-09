"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotPlanningLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
let ShotPlanningLocalAdapter = class ShotPlanningLocalAdapter {
    name = 'ShotPlanningLocalAdapter';
    mode = 'local';
    supports(engineKey) {
        return engineKey === 'shot_planning';
    }
    async invoke(input) {
        const payload = input.payload;
        void payload;
        return {
            status: shared_types_1.EngineInvokeStatus.SUCCESS,
            output: {
                shotType: { primary: 'medium', confidence: 0.5 },
                movement: { primary: 'static', confidence: 0.5 },
            },
        };
    }
};
exports.ShotPlanningLocalAdapter = ShotPlanningLocalAdapter;
exports.ShotPlanningLocalAdapter = ShotPlanningLocalAdapter = __decorate([
    (0, common_1.Injectable)()
], ShotPlanningLocalAdapter);
//# sourceMappingURL=shot-planning.local-adapter.js.map