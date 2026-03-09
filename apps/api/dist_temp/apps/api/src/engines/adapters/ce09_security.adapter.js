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
var CE09SecurityLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE09SecurityLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const os_exec_1 = require("../../../../../packages/shared/os_exec");
const fs_safe_1 = require("../../../../../packages/shared/fs_safe");
const hash_1 = require("../../../../../packages/shared/hash");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const perf_hooks_1 = require("perf_hooks");
let CE09SecurityLocalAdapter = CE09SecurityLocalAdapter_1 = class CE09SecurityLocalAdapter {
    name = 'ce09_security';
    logger = new common_1.Logger(CE09SecurityLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'ce09_security' || engineKey === 'ce09_security_real';
    }
    async invoke(input) {
        const { videoPath, watermarkText, projectId, pipelineRunId } = input.payload;
        const t0 = perf_hooks_1.performance.now();
        try {
            const root = path.resolve(process.cwd());
            const repoRoot = root.includes('apps/') ? path.dirname(path.dirname(root)) : root;
            const storageRoot = path.join(repoRoot, '.runtime');
            const absInput = (0, fs_safe_1.safeJoin)(storageRoot, videoPath);
            const secureRelativeDir = `secure/${projectId}/${pipelineRunId}`;
            const secureAbsDir = (0, fs_safe_1.safeJoin)(storageRoot, secureRelativeDir);
            await fs_1.promises.mkdir(secureAbsDir, { recursive: true });
            const outRelative = path.join(secureRelativeDir, `secure_${path.basename(videoPath)}`);
            const outPath = (0, fs_safe_1.safeJoin)(storageRoot, outRelative);
            const hlsPlaylistRelative = path.join(secureRelativeDir, 'hls/master.m3u8');
            const hlsPlaylistAbs = (0, fs_safe_1.safeJoin)(storageRoot, hlsPlaylistRelative);
            const screenshotRelative = outRelative + '.thumb.jpg';
            const md5Relative = outRelative + '.framemd5.txt';
            await fs_1.promises.mkdir(path.dirname(hlsPlaylistAbs), { recursive: true });
            if (!(await fs_1.promises
                .access(absInput)
                .then(() => true)
                .catch(() => false))) {
                throw new Error(`SECURITY_INPUT_MISSING: ${videoPath}`);
            }
            const wmArgs = [
                '-y',
                '-i',
                absInput,
                '-vf',
                `drawtext=text='${watermarkText || 'SUPER_CATERPILLAR'}':x=10:y=H-th-10:fontsize=24:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`,
                '-c:v',
                'libx264',
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'copy',
                outPath,
            ];
            const wmRes = await (0, os_exec_1.execAsync)('ffmpeg', wmArgs);
            if (wmRes.code !== 0)
                throw new Error(`WATERMARK_FAIL: ${wmRes.stderr}`);
            await Promise.all([
                (0, os_exec_1.execAsync)('ffmpeg', [
                    '-y',
                    '-i',
                    outPath,
                    '-c',
                    'copy',
                    '-start_number',
                    '0',
                    '-hls_time',
                    '10',
                    '-hls_list_size',
                    '0',
                    '-f',
                    'hls',
                    hlsPlaylistAbs,
                ]),
                (0, os_exec_1.execAsync)('ffmpeg', [
                    '-y',
                    '-i',
                    outPath,
                    '-ss',
                    '00:00:01',
                    '-vframes',
                    '1',
                    (0, fs_safe_1.safeJoin)(storageRoot, screenshotRelative),
                ]),
                (0, os_exec_1.execAsync)('ffmpeg', [
                    '-y',
                    '-i',
                    outPath,
                    '-f',
                    'framemd5',
                    (0, fs_safe_1.safeJoin)(storageRoot, md5Relative),
                ]),
            ]);
            const [outStat, hash] = await Promise.all([fs_1.promises.stat(outPath), (0, hash_1.sha256File)(outPath)]);
            return {
                status: 'SUCCESS',
                output: {
                    storageKey: outRelative,
                    hlsPlaylistKey: hlsPlaylistRelative,
                    screenshotKey: screenshotRelative,
                    framemd5Key: md5Relative,
                    sha256: hash,
                    watermarkMode: 'SCU_VISIBLE_V1_ASYNC',
                    provider: 'ffmpeg-secure-v2-hls',
                },
                metrics: {
                    durationMs: Math.round(perf_hooks_1.performance.now() - t0),
                },
            };
        }
        catch (error) {
            this.logger.error(`[SECURITY_FAIL] ${error.message}`);
            return {
                status: 'FAILED',
                error: { code: 'CE09_SECURITY_FAIL', message: error.message },
            };
        }
    }
};
exports.CE09SecurityLocalAdapter = CE09SecurityLocalAdapter;
exports.CE09SecurityLocalAdapter = CE09SecurityLocalAdapter = CE09SecurityLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CE09SecurityLocalAdapter);
//# sourceMappingURL=ce09_security.adapter.js.map