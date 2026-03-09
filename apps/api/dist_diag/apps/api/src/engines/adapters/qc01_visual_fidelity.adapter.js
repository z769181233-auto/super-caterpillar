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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QC01VisualFidelityAdapter = void 0;
const common_1 = require("@nestjs/common");
const qc_base_engine_1 = require("../base/qc_base.engine");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const sharp_1 = __importDefault(require("sharp"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let QC01VisualFidelityAdapter = class QC01VisualFidelityAdapter extends qc_base_engine_1.QcBaseEngine {
    constructor(redis, audit, cost) {
        super('qc01_visual_fidelity', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload || {});
    }
    async processLogic(payload, input) {
        const url = payload.url || (payload.output && (payload.output.url || payload.output.assetUrl)) || '';
        if (!url) {
            return {
                status: 'FAIL',
                metrics: { score: 0, reasons: ['No URL provided'] },
            };
        }
        const filePath = url.startsWith('file://') ? url.replace('file://', '') : url;
        try {
            const { stdout } = await execAsync(`ffprobe -v error -show_streams -show_format -of json "${filePath}"`);
            const probe = JSON.parse(stdout);
            const videoStream = probe.streams?.find((s) => s.codec_type === 'video');
            const duration = parseFloat(probe.format?.duration || '0');
            const width = videoStream?.width || 0;
            const height = videoStream?.height || 0;
            const codec = videoStream?.codec_name || 'unknown';
            let score = 100;
            const reasons = [];
            if (duration <= 0) {
                score -= 50;
                reasons.push('Invalid duration');
            }
            if (width < 640 || height < 480) {
                score -= 30;
                reasons.push('Resolution too low');
            }
            if (codec === 'unknown') {
                score -= 20;
                reasons.push('Codec unidentified');
            }
            const hash = (0, crypto_1.createHash)('sha256')
                .update(JSON.stringify(payload))
                .digest('hex')
                .substring(0, 16);
            const outputDir = (0, path_1.join)(process.cwd(), 'storage/qc/visual');
            const reportPath = (0, path_1.join)(outputDir, `qc01_${hash}.json`);
            (0, fs_1.mkdirSync)(outputDir, { recursive: true });
            const frameDir = (0, path_1.join)(outputDir, `frames_${hash}`);
            let sharpnessMetrics = { p50: 0, p10: 0, scores: [] };
            try {
                if (duration > 0) {
                    (0, fs_1.mkdirSync)(frameDir, { recursive: true });
                    await execAsync(`ffmpeg -y -i "${filePath}" -vf "fps=30/${duration}" -vframes 30 "${(0, path_1.join)(frameDir, 'frame_%03d.jpg')}"`);
                    const frameFiles = (await (0, util_1.promisify)(fs_1.readdir)(frameDir))
                        .filter((f) => f.endsWith('.jpg'))
                        .map((f) => (0, path_1.join)(frameDir, f));
                    if (frameFiles.length > 0) {
                        const scores = [];
                        const kernel = {
                            width: 3,
                            height: 3,
                            kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
                        };
                        for (const frame of frameFiles) {
                            const { data, info } = await (0, sharp_1.default)(frame)
                                .grayscale()
                                .raw()
                                .toBuffer({ resolveWithObject: true });
                            const width = info.width;
                            const height = info.height;
                            const stats = await (0, sharp_1.default)(frame).grayscale().convolve(kernel).stats();
                            const stdev = stats.channels[0].stdev;
                            const variance = stdev * stdev;
                            scores.push(variance);
                        }
                        scores.sort((a, b) => a - b);
                        const p50 = scores[Math.floor(scores.length * 0.5)] || 0;
                        const p10 = scores[Math.floor(scores.length * 0.1)] || 0;
                        sharpnessMetrics = { p50, p10, scores };
                        await Promise.all(frameFiles.map((f) => (0, util_1.promisify)(fs_1.unlink)(f)));
                        await (0, util_1.promisify)(fs_1.rmdir)(frameDir);
                    }
                }
            }
            catch (e) {
                this.logger.warn(`[QC01] Sharpness analysis failed: ${e.message}`);
                reasons.push(`Sharpness check failed: ${e.message}`);
            }
            if (sharpnessMetrics.p50 < 360) {
                score -= 40;
                reasons.push(`Low Sharpness (P50=${sharpnessMetrics.p50.toFixed(1)} < 360)`);
            }
            if (sharpnessMetrics.p10 < 300) {
                score -= 10;
                reasons.push(`Inconsistent Sharpness (P10=${sharpnessMetrics.p10.toFixed(1)} < 300)`);
            }
            const report = {
                score,
                checks: {
                    resolution: `${width}x${height}`,
                    codec,
                    duration: `${duration}s`,
                    sharpness_p50: sharpnessMetrics.p50,
                    sharpness_p10: sharpnessMetrics.p10,
                    integrity: score >= 80 ? 'Verified' : 'Degraded',
                },
                reasons,
                ffprobe_output: probe,
                timestamp: new Date().toISOString(),
            };
            (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
            return {
                status: score >= 80 ? 'PASS' : score >= 60 ? 'WARN' : 'FAIL',
                reportUrl: `file://${reportPath}`,
                metrics: { score, reasons, sharpness: sharpnessMetrics },
            };
        }
        catch (err) {
            return {
                status: 'FAIL',
                metrics: { score: 0, reasons: [`ffprobe error: ${err.message}`] },
            };
        }
    }
};
exports.QC01VisualFidelityAdapter = QC01VisualFidelityAdapter;
exports.QC01VisualFidelityAdapter = QC01VisualFidelityAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, audit_service_1.AuditService, cost_ledger_service_1.CostLedgerService])
], QC01VisualFidelityAdapter);
//# sourceMappingURL=qc01_visual_fidelity.adapter.js.map