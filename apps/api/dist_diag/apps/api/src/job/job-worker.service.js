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
var JobWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobWorkerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("./job.service");
const config_1 = require("@scu/config");
let JobWorkerService = JobWorkerService_1 = class JobWorkerService {
    prisma;
    jobService;
    logger = new common_1.Logger(JobWorkerService_1.name);
    intervalId = null;
    isProcessing = false;
    constructor(prisma, jobService) {
        this.prisma = prisma;
        this.jobService = jobService;
    }
    async onModuleInit() {
        if (config_1.env.enableInternalJobWorker) {
            this.logger.log(`Job Worker enabled, starting with interval ${config_1.env.jobWorkerInterval} ms`);
            await this.prisma.workerNode.upsert({
                where: { workerId: 'internal-api-worker' },
                update: {
                    status: 'online',
                    lastHeartbeat: new Date(),
                    capabilities: {
                        supportedEngines: [
                            'default_novel_analysis',
                            'ce06_novel_parsing',
                            'ce03_visual_density',
                            'ce04_visual_enrichment',
                            'default_shot_render',
                            'video_merge',
                            'default_video_render',
                        ],
                    },
                },
                create: {
                    workerId: 'internal-api-worker',
                    name: 'Internal API Worker',
                    status: 'online',
                    lastHeartbeat: new Date(),
                    capabilities: {
                        supportedEngines: [
                            'default_novel_analysis',
                            'ce06_novel_parsing',
                            'ce03_visual_density',
                            'ce04_visual_enrichment',
                            'default_shot_render',
                            'video_merge',
                            'default_video_render',
                        ],
                    },
                },
            });
            this.start();
        }
        else {
            this.logger.warn('Job Worker is disabled (JOB_WORKER_ENABLED=false)');
        }
    }
    onModuleDestroy() {
        this.stop();
    }
    start() {
        this.processJobs();
        this.intervalId = setInterval(() => {
            this.processJobs();
        }, config_1.env.jobWorkerInterval);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logger.log('Job Worker stopped');
        }
    }
    async processJobs() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        try {
            const batchSize = config_1.env.jobWorkerBatchSize || 10;
            const claimedJobs = [];
            for (let i = 0; i < batchSize; i++) {
                const job = await this.jobService.getAndMarkNextPendingJob('internal-api-worker');
                if (!job)
                    break;
                claimedJobs.push(job);
            }
            if (claimedJobs.length === 0) {
                return;
            }
            this.logger.log(`[P0 - 4] Internal worker claimed ${claimedJobs.length} jobs atomically.`);
            const processingPromises = claimedJobs.map((job) => this.jobService.processJob(job.id).catch((error) => {
                this.logger.error(`Failed to process job ${job.id}: `, error);
            }));
            await Promise.all(processingPromises);
        }
        catch (error) {
            this.logger.error('Error in Job Worker:', error.stack || error.message || error);
        }
        finally {
            this.isProcessing = false;
        }
    }
};
exports.JobWorkerService = JobWorkerService;
exports.JobWorkerService = JobWorkerService = JobWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        job_service_1.JobService])
], JobWorkerService);
//# sourceMappingURL=job-worker.service.js.map