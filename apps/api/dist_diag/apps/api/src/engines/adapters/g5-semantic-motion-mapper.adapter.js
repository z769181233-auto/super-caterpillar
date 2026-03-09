"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var G5SemanticMotionMapperAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.G5SemanticMotionMapperAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let G5SemanticMotionMapperAdapter = G5SemanticMotionMapperAdapter_1 = class G5SemanticMotionMapperAdapter {
    name = 'g5_semantic_motion';
    logger = new common_1.Logger(G5SemanticMotionMapperAdapter_1.name);
    TEMPLATE_LIB = {
        idle_breathing: { amplitude: 0.02, frequency: 0.3 },
        nod_agree: { head_dy: 5, cycles: 1 },
        gesture_talk: { arm_amplitude: 0.05 },
        static: { amplitude: 0, frequency: 0 },
    };
    supports(engineKey) {
        return engineKey === 'g5_semantic_motion';
    }
    async invoke(input) {
        const started = Date.now();
        try {
            const { renderPlan, outputDir } = input.payload;
            if (!renderPlan) {
                throw new Error('G5_SEMANTIC_MOTION: Missing renderPlan in payload');
            }
            const shots = renderPlan.renderShots || renderPlan.shots || [];
            const assignments = [];
            const driftViolationCount = 0;
            shots.forEach((shot) => {
                const shotId = shot.id || `shot-${shot.sequence_no || 0}`;
                const action = (shot.action || '').toLowerCase();
                const isStanding = action.includes('stand') || action.includes('idle') || action.includes('静止') || !action;
                let templateId = 'idle_breathing';
                if (action.includes('点') || action.includes('听'))
                    templateId = 'nod_agree';
                if (action.includes('交谈') || action.includes('说'))
                    templateId = 'gesture_talk';
                const verticalDrift = isStanding ? 0.0 : 0.05;
                assignments.push({
                    shotId,
                    templateId,
                    params: this.TEMPLATE_LIB[templateId] ||
                        this.TEMPLATE_LIB['idle_breathing'],
                    verticalDrift: parseFloat(verticalDrift.toFixed(3)),
                    isStanding,
                });
            });
            const result = {
                assignments,
                total_shots: shots.length,
                standing_drift_ok: true,
            };
            if (outputDir) {
                const outPath = path.join(outputDir, 'motion_plan.json');
                fs.mkdirSync(outputDir, { recursive: true });
                fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
            }
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: result,
                metrics: {
                    durationMs: Date.now() - started,
                    driftViolations: driftViolationCount,
                },
            };
        }
        catch (error) {
            this.logger.error(`[G5-MOTION] Error: ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    code: 'G5_MOTION_ERROR',
                    message: error.message,
                },
            };
        }
    }
};
exports.G5SemanticMotionMapperAdapter = G5SemanticMotionMapperAdapter;
exports.G5SemanticMotionMapperAdapter = G5SemanticMotionMapperAdapter = G5SemanticMotionMapperAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], G5SemanticMotionMapperAdapter);
//# sourceMappingURL=g5-semantic-motion-mapper.adapter.js.map