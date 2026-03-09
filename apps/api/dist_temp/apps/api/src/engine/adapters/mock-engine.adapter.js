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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEngineAdapter = void 0;
const common_1 = require("@nestjs/common");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const shared_types_1 = require("@scu/shared-types");
let MockEngineAdapter = class MockEngineAdapter {
    name = 'mock';
    supports(engineKey) {
        return (engineKey === 'mock' ||
            engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render' ||
            engineKey === 'ce11_shot_generator_mock');
    }
    async invoke(input) {
        const isVideoJob = input.jobType === 'VIDEO_RENDER';
        const isShotJob = input.jobType === 'SHOT_RENDER';
        const isCE11Job = input.jobType === 'CE11_SHOT_GENERATOR' || input.engineKey === 'ce11_shot_generator_mock';
        if (isCE11Job) {
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: {
                    shots: [
                        {
                            shot_type: 'MEDIUM_SHOT',
                            camera_movement: 'STATIC',
                            visual_prompt: 'Mock Shot 1: A scene from the novel',
                            action_description: 'Character stands still',
                            duration_sec: 3.0,
                        },
                        {
                            shot_type: 'CLOSE_UP',
                            camera_movement: 'ZOOM_IN',
                            visual_prompt: 'Mock Shot 2: Detailed face',
                            action_description: 'Character smiles',
                            duration_sec: 3.0,
                        },
                    ],
                    billing_usage: { model: 'mock-ce11', cost: 0 },
                },
            };
        }
        if (isShotJob) {
            const cwd = process.cwd();
            const hasApps = fs.existsSync(path.join(cwd, 'apps'));
            const hasPackages = fs.existsSync(path.join(cwd, 'packages'));
            let repoRoot = cwd;
            if (!hasApps || !hasPackages) {
                repoRoot = path.resolve(cwd, '../..');
            }
            const storageRoot = path.join(repoRoot, '.data/storage');
            const relativePath = path.join('temp', 'gates', 'mock_shot_render.png');
            const absPath = path.join(storageRoot, relativePath);
            if (!fs.existsSync(path.dirname(absPath))) {
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
            }
            const violetPngHex = '89504e470d0a1a0a0000000d49484452000001000000010008030000005708892100000003504c54458a2be2d525420000000174524e53ff52d765e90000002f49444154789cedc101010000008220ffaf6e16fe010000000000000000000000000000000000000000000000000000002800018a381831cbb269980000000049454e44ae426082';
            const pngBuffer = Buffer.from(violetPngHex, 'hex');
            fs.writeFileSync(absPath, pngBuffer);
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: {
                    message: 'Mock Shot Render Success',
                    asset: {
                        uri: relativePath,
                        type: 'image/png',
                        sha256: 'mock-sha256-' + Date.now().toString(),
                    },
                },
            };
        }
        return {
            status: shared_types_1.EngineInvokeStatus.SUCCESS,
            output: {
                message: 'Mock engine executed successfully',
                jobType: input.jobType,
                videoUrl: isVideoJob
                    ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
                    : undefined,
                storageKey: isVideoJob
                    ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
                    : undefined,
            },
        };
    }
};
exports.MockEngineAdapter = MockEngineAdapter;
exports.MockEngineAdapter = MockEngineAdapter = __decorate([
    (0, common_1.Injectable)()
], MockEngineAdapter);
//# sourceMappingURL=mock-engine.adapter.js.map