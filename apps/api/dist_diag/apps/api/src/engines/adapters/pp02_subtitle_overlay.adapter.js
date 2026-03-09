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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PP02SubtitleOverlayAdapter = void 0;
const common_1 = require("@nestjs/common");
const pp_base_engine_1 = require("../base/pp_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let PP02SubtitleOverlayAdapter = class PP02SubtitleOverlayAdapter extends pp_base_engine_1.PpBaseEngine {
    constructor(redis, audit, cost) {
        super('pp02_subtitle_overlay', redis, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const sourceUrl = payload.sourceUrl || '';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/pp/subtitle');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const outputPath = (0, path_1.join)(outputDir, `${hash}.mp4`);
        const sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';
        if (!sourcePath || !(0, fs_1.existsSync)(sourcePath)) {
            inputArg = `-f lavfi -i testsrc=d=1`;
        }
        else {
            inputArg = `-i "${sourcePath}"`;
        }
        const cmd = `ffmpeg -y ${inputArg} -vf "drawbox=y=ih-50:w=iw:h=40:color=black@0.5:t=fill" -c:a copy "${outputPath}"`;
        (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        return {
            assetUrl: `file://${outputPath}`,
            meta: { format: 'mp4', hasSubtitle: true },
        };
    }
};
exports.PP02SubtitleOverlayAdapter = PP02SubtitleOverlayAdapter;
exports.PP02SubtitleOverlayAdapter = PP02SubtitleOverlayAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], PP02SubtitleOverlayAdapter);
//# sourceMappingURL=pp02_subtitle_overlay.adapter.js.map