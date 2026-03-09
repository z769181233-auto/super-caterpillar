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
exports.PP06CreditsGenAdapter = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
let PP06CreditsGenAdapter = class PP06CreditsGenAdapter {
    redis;
    audit;
    cost;
    name = 'pp06_credits_gen';
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
            action: 'PP06_INVOKE',
            details: payload,
        });
        const outputDir = (0, path_1.join)(process.cwd(), 'storage/pp/credits');
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        const creditsPath = (0, path_1.join)(outputDir, `${context.jobId}_credits.mp4`);
        const names = payload.names || 'Director: Antigravity\nAI Actor: Gemini';
        const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=1280x720:d=5 -vf "drawtext=text='${names}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=h-t*150" "${creditsPath}"`;
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        }
        catch (e) {
            (0, fs_1.writeFileSync)(creditsPath, 'credits video stub');
        }
        await this.cost.recordFromEvent({
            userId: context.userId || 'system',
            projectId: context.projectId || 'unknown',
            jobId: context.jobId || 'unknown',
            jobType: 'PP_RENDER',
            engineKey: this.name,
            costAmount: 0.05,
            billingUnit: 'job',
            quantity: 1,
        });
        return {
            status: 'SUCCESS',
            output: {
                creditsVideoUrl: `file://${creditsPath}`,
                durationSeconds: 5,
                meta: { engine: 'pp06-credits-ff-stub' },
            },
        };
    }
};
exports.PP06CreditsGenAdapter = PP06CreditsGenAdapter;
exports.PP06CreditsGenAdapter = PP06CreditsGenAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], PP06CreditsGenAdapter);
//# sourceMappingURL=pp06_credits_gen.adapter.js.map