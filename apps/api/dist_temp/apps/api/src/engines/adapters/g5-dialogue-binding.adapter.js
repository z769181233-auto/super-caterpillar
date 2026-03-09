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
var G5DialogueBindingAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.G5DialogueBindingAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let G5DialogueBindingAdapter = G5DialogueBindingAdapter_1 = class G5DialogueBindingAdapter {
    name = 'g5_dialogue_binding';
    logger = new common_1.Logger(G5DialogueBindingAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'g5_dialogue_binding';
    }
    async invoke(input) {
        const started = Date.now();
        try {
            const { story, renderPlan, outputDir } = input.payload;
            if (!story || !renderPlan) {
                throw new Error('G5_DIALOGUE_BINDING: Missing story or renderPlan in payload');
            }
            this.logger.log(`[G5-DIALOGUE] Processing ${renderPlan.episodeId || 'unknown'}...`);
            const dialogues = [];
            const beats = story.beats || [];
            const shots = renderPlan.renderShots || renderPlan.shots || [];
            const START_BUFFER = 0.5;
            const END_BUFFER = 0.5;
            beats.forEach((beat) => {
                const beatId = beat.id;
                const associatedShots = shots.filter((s) => s.beatId === beatId);
                if (associatedShots.length === 0) {
                    this.logger.warn(`[G5-DIALOGUE] Beat ${beatId} has no associated shots. Skipping.`);
                    return;
                }
                const firstShot = associatedShots[0];
                const shotId = firstShot.id || `shot-${firstShot.sequence_no || 0}`;
                const text = beat.dialogue || beat.text || `[旁白] ${beat.goal || '正在发生'}`;
                const speaker = beat.speaker && beat.speaker !== 'UNKNOWN' ? beat.speaker : 'NARRATOR';
                const shotStart = firstShot.startSec || 0;
                const shotDuration = firstShot.duration_sec ||
                    (firstShot.durationFrames ? firstShot.durationFrames / 24 : 3.0);
                const dStart = shotStart + START_BUFFER;
                const dEnd = Math.min(shotStart + shotDuration - END_BUFFER, dStart + (beat.durationSec || 2.0));
                dialogues.push({
                    shotId,
                    speaker,
                    text,
                    startSec: parseFloat(dStart.toFixed(3)),
                    endSec: parseFloat(dEnd.toFixed(3)),
                    beatId,
                });
            });
            const result = {
                dialogue_plan: dialogues,
                total_dialogues: dialogues.length,
                coverage_pct: beats.length > 0 ? dialogues.length / beats.length : 1.0,
            };
            if (outputDir) {
                const outPath = path.join(outputDir, 'dialogue_plan.json');
                fs.mkdirSync(outputDir, { recursive: true });
                fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
            }
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: result,
                metrics: {
                    durationMs: Date.now() - started,
                    count: dialogues.length,
                },
            };
        }
        catch (error) {
            this.logger.error(`[G5-DIALOGUE] Error: ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    code: 'G5_DIALOGUE_ERROR',
                    message: error.message,
                },
            };
        }
    }
};
exports.G5DialogueBindingAdapter = G5DialogueBindingAdapter;
exports.G5DialogueBindingAdapter = G5DialogueBindingAdapter = G5DialogueBindingAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], G5DialogueBindingAdapter);
//# sourceMappingURL=g5-dialogue-binding.adapter.js.map