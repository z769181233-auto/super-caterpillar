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
exports.PP05PosterGenAdapter = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let PP05PosterGenAdapter = class PP05PosterGenAdapter {
    redis;
    audit;
    cost;
    name = 'pp05_poster_gen';
    constructor(redis, audit, cost) {
        this.redis = redis;
        this.audit = audit;
        this.cost = cost;
    }
    supports(engineKey) {
        return engineKey === this.name;
    }
    async invoke(input) {
        const { payload, context } = input;
        await this.audit.log({
            userId: context.userId,
            traceId: context.traceId,
            resourceType: 'project',
            resourceId: context.projectId,
            action: 'PP05_INVOKE',
            details: payload,
        });
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/pp/posters');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const posterPath = (0, path_1.join)(outputDir, `${context.jobId}_poster.jpg`);
        const title = payload.title || 'Super Caterpillar';
        const cmd = `ffmpeg -y -f lavfi -i color=c=navy:s=720x1080 -vf "drawtext=text='${title}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 "${posterPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (e) {
            (0, fs_1.writeFileSync)(posterPath, 'dummy poster');
        }
        await this.cost.recordFromEvent({
            userId: context.userId || 'system',
            projectId: context.projectId || 'unknown',
            jobId: context.jobId || 'unknown',
            jobType: 'PP_RENDER',
            engineKey: this.name,
            costAmount: 0.1,
            billingUnit: 'job',
            quantity: 1,
        });
        return {
            status: 'SUCCESS',
            output: {
                posterUrl: `file://${posterPath}`,
                resolution: '720x1080',
                meta: { engine: 'pp05-poster-magick-stub' },
            },
        };
    }
};
exports.PP05PosterGenAdapter = PP05PosterGenAdapter;
exports.PP05PosterGenAdapter = PP05PosterGenAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], PP05PosterGenAdapter);
//# sourceMappingURL=pp05_poster_gen.adapter.js.map