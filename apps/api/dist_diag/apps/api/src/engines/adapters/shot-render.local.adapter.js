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
exports.ShotRenderLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto = __importStar(require("crypto"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ShotRenderLocalAdapter {
    name = 'shot_render_local';
    logger = new common_1.Logger(ShotRenderLocalAdapter.name);
    supports(engineKey) {
        return (engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render' ||
            engineKey === 'http_shot_render');
    }
    async invoke(input) {
        this.logger.log(`[ShotRenderLocal] REAL Invocation for ${input.engineKey} (JobType=${input.jobType})`);
        try {
            const shotId = (input.context?.shotId || input.payload?.shotId);
            const traceId = (input.context?.traceId || input.payload?.traceId);
            const projectId = input.payload.projectId;
            const sceneId = input.context?.sceneId;
            if (!projectId || !sceneId) {
                throw new Error(`[ShotRenderLocal] Missing Identity: projectId=${projectId}, sceneId=${sceneId}. Cannot persist asset safely.`);
            }
            const storageRoot = path.resolve(process.env.STORAGE_ROOT || '.data/storage');
            const outputDir = path.join(storageRoot, 'renders', projectId, 'scenes', sceneId);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const outputFilename = 'source.mp4';
            const outputPath = path.join(outputDir, outputFilename);
            const absOutputPath = path.resolve(outputPath);
            const sourceImagePath = input.payload.sourceImagePath;
            if (!sourceImagePath || !fs.existsSync(sourceImagePath)) {
                throw new Error(`[ShotRenderLocal] Missing/Invalid sourceImagePath=${sourceImagePath}`);
            }
            this.logger.log(`[ShotRenderLocal] Rendering 2.5D Motion from: ${sourceImagePath}`);
            const motion = (input.payload.cameraMovement || 'ZOOM_IN').toUpperCase();
            let zoompanFilter = '';
            switch (motion) {
                case 'ZOOM_OUT':
                    zoompanFilter = `zoompan=z='max(1.15-on*0.001,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30`;
                    break;
                case 'PAN_LEFT':
                    zoompanFilter = `zoompan=z=1.15:x='(iw-iw/zoom)*(1-on/150)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30`;
                    break;
                case 'PAN_RIGHT':
                    zoompanFilter = `zoompan=z=1.15:x='(iw-iw/zoom)*(on/150)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30`;
                    break;
                case 'TILT_UP':
                    zoompanFilter = `zoompan=z=1.15:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/150)':d=150:s=1920x1080:fps=30`;
                    break;
                case 'TILT_DOWN':
                    zoompanFilter = `zoompan=z=1.15:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(on/150)':d=150:s=1920x1080:fps=30`;
                    break;
                default:
                    zoompanFilter = `zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30`;
            }
            const ffmpegCmd = [
                `ffmpeg -hide_banner -y`,
                `-loop 1 -i "${sourceImagePath}"`,
                `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
                `-shortest`,
                `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,${zoompanFilter}"`,
                `-t 5`,
                `-c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow`,
                `-c:a aac -b:a 192k`,
                `"${absOutputPath}"`,
            ].join(' ');
            this.logger.log(`[ShotRenderLocal] Executing FFmpeg: ${ffmpegCmd}`);
            await execAsync(ffmpegCmd, {
                maxBuffer: 1024 * 1024 * 10,
                timeout: 60000,
            });
            this.logger.log(`[ShotRenderLocal] FFmpeg execution completed.`);
            const stats = fs.statSync(absOutputPath);
            if (stats.size < 10000) {
                throw new Error(`[ShotRenderLocal] Rendered video is too small (${stats.size} bytes). Likely corrupted.`);
            }
            const blackDetectCmd = `ffmpeg -i "${absOutputPath}" -vf "blackdetect=d=0.1:pix_th=0.1" -f null - 2>&1`;
            const { stderr } = await execAsync(blackDetectCmd);
            if (stderr.includes('black_start:0') && stderr.includes('black_end:5')) {
                throw new Error(`[ShotRenderLocal] Black video detected! The entire output is black.`);
            }
            this.logger.log(`[ShotRenderLocal] Generated Asset Size: ${stats.size} bytes`);
            const storageKey = path.relative(storageRoot, absOutputPath);
            const fileBuffer = fs.readFileSync(absOutputPath);
            const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const result = {
                render_meta: {
                    model: 'local-ffmpeg-hifi',
                    duration: 5,
                    width: 1920,
                    height: 1080,
                },
                audit_trail: {},
                storageKey: storageKey,
                localPath: absOutputPath,
                sha256: sha256,
            };
            if (result.audit_trail) {
                result.audit_trail.providerSelected =
                    result.render_meta?.model || 'sdxl-turbo-local';
            }
            return {
                status: 'SUCCESS',
                output: result,
            };
        }
        catch (error) {
            this.logger.error(`[ShotRenderLocal] REAL Invocation Failed: ${error.message}`);
            return {
                status: 'FAILED',
                error: {
                    code: 'SHOT_RENDER_REAL_FAILED',
                    message: error.message,
                },
            };
        }
    }
}
exports.ShotRenderLocalAdapter = ShotRenderLocalAdapter;
//# sourceMappingURL=shot-render.local.adapter.js.map