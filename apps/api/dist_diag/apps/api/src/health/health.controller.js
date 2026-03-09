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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const text_safety_metrics_1 = require("../observability/text_safety.metrics");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const database_1 = require("database");
let HealthController = class HealthController {
    prisma;
    redisService;
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
    }
    health() {
        const isStub = process.env.P9_B3_STUB_MODE === '1';
        return {
            ok: true,
            service: 'api',
            mode: isStub ? 'stub' : 'real',
            stub: isStub ? 1 : 0,
            missing_envs: process.missingEnvs || [],
            gate_mode: Number(process.env.GATE_MODE) || 0,
            ts: new Date().toISOString()
        };
    }
    apiHealth() {
        const isStub = process.env.P9_B3_STUB_MODE === '1';
        return {
            ok: true,
            service: 'api',
            status: 'ok',
            mode: isStub ? 'stub' : 'real',
            stub: isStub ? 1 : 0,
            missing_envs: process.missingEnvs || [],
            gate_mode: Number(process.env.GATE_MODE) || 0,
            ts: new Date().toISOString()
        };
    }
    live() {
        return { ok: true, status: 'alive', ts: new Date().toISOString() };
    }
    async ready() {
        const checks = {};
        let allReady = true;
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            checks.database = true;
        }
        catch (error) {
            checks.database = false;
            allReady = false;
        }
        if (this.redisService) {
            checks.redis = this.redisService.isConnected || false;
        }
        else {
            checks.redis = null;
        }
        return {
            ok: allReady,
            status: allReady ? 'ready' : 'not_ready',
            checks,
            ts: new Date().toISOString(),
        };
    }
    gpu() {
        return {
            available: false,
            reason: 'GPU detection not implemented',
            ts: new Date().toISOString(),
        };
    }
    ping() {
        return { ok: true, pong: true, ts: new Date().toISOString() };
    }
    async metrics() {
        const uptime = process.uptime();
        const node = process.version;
        const memUsage = process.memoryUsage();
        const [totalJobs, pendingJobs, runningJobs, failedJobs, videoRenderPending] = await Promise.all([
            this.prisma.shotJob.count(),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.PENDING } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.RUNNING } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.FAILED } }),
            this.prisma.shotJob.count({
                where: {
                    type: database_1.JobType.VIDEO_RENDER,
                    status: database_1.JobStatus.PENDING,
                },
            }),
        ]);
        const globalMetrics = await (await Promise.resolve().then(() => __importStar(require('@scu/observability')))).registry.metrics();
        let workerMetrics = '';
        const workerMetricsPort = process.env.WORKER_METRICS_PORT || 3001;
        try {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
            const workerResp = await axios.get(`http://127.0.0.1:${workerMetricsPort}/metrics`, {
                timeout: 500,
                validateStatus: (status) => status === 200,
            });
            workerMetrics = '\n\n# --- Worker Metrics ---\n' + workerResp.data;
        }
        catch (e) {
            workerMetrics = '\n\n# --- Worker Metrics Unavailable ---';
        }
        return `# scu_api_metrics
# HELP scu_api_uptime_seconds API server uptime in seconds
# TYPE scu_api_uptime_seconds gauge
scu_api_uptime_seconds ${uptime}

# HELP scu_api_node_version Node.js version
# TYPE scu_api_node_version gauge
scu_api_node_version{version="${node}"} 1

# HELP scu_api_memory_heap_used_bytes Heap memory used in bytes
# TYPE scu_api_memory_heap_used_bytes gauge
scu_api_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP scu_api_memory_heap_total_bytes Total heap memory in bytes
# TYPE scu_api_memory_heap_total_bytes gauge
scu_api_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP scu_api_memory_rss_bytes Resident set size in bytes
# TYPE scu_api_memory_rss_bytes gauge
scu_api_memory_rss_bytes ${memUsage.rss}

# HELP scu_api_jobs_total Total number of jobs (API DB snapshot)
# TYPE scu_api_jobs_total gauge
scu_api_jobs_total ${totalJobs}

# HELP scu_api_jobs_pending Number of pending jobs
# TYPE scu_api_jobs_pending gauge
scu_api_jobs_pending ${pendingJobs}

# HELP scu_api_jobs_running Number of running jobs
# TYPE scu_api_jobs_running gauge
scu_api_jobs_running ${runningJobs}

# HELP scu_api_jobs_failed Number of failed jobs
# TYPE scu_api_jobs_failed gauge
scu_api_jobs_failed ${failedJobs}

# HELP scu_api_jobs_video_render_pending Number of pending VIDEO_RENDER jobs
# TYPE scu_api_jobs_video_render_pending gauge
scu_api_jobs_video_render_pending ${videoRenderPending}

${text_safety_metrics_1.TextSafetyMetrics.getPrometheusOutput()}

${globalMetrics}

${workerMetrics}
`;
    }
    readyAlias() {
        return this.ready();
    }
    liveAlias() {
        return this.live();
    }
    gpuAlias() {
        return this.gpu();
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('/api/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "apiHealth", null);
__decorate([
    (0, common_1.Get)('/health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "live", null);
__decorate([
    (0, common_1.Get)('/health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('/health/gpu'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "gpu", null);
__decorate([
    (0, common_1.Get)('/ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('/metrics'),
    (0, common_1.Header)('Content-Type', 'text/plain; charset=utf-8'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "metrics", null);
__decorate([
    (0, common_1.Get)('/api/health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "readyAlias", null);
__decorate([
    (0, common_1.Get)('/api/health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "liveAlias", null);
__decorate([
    (0, common_1.Get)('/api/health/gpu'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "gpuAlias", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], HealthController);
//# sourceMappingURL=health.controller.js.map