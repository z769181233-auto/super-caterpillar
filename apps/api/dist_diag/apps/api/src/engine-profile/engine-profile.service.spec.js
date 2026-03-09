"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const engine_profile_service_1 = require("./engine-profile.service");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
const engine_registry_hub_service_1 = require("../engine-hub/engine-registry-hub.service");
describe('EngineProfileService', () => {
    let service;
    let prisma;
    let jobService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                engine_profile_service_1.EngineProfileService,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        $disconnect: jest.fn().mockResolvedValue(undefined),
                        shotJob: {
                            findMany: jest.fn(),
                        },
                    },
                },
                {
                    provide: job_service_1.JobService,
                    useValue: {
                        extractEngineKeyFromJob: jest.fn(),
                        extractEngineVersionFromJob: jest.fn(),
                    },
                },
                {
                    provide: engine_registry_hub_service_1.EngineRegistryHubService,
                    useValue: {
                        find: jest
                            .fn()
                            .mockReturnValue({ mode: 'local', adapterToken: { name: 'mock_adapter' } }),
                    },
                },
            ],
        }).compile();
        service = module.get(engine_profile_service_1.EngineProfileService);
        prisma = module.get(prisma_service_1.PrismaService);
        jobService = module.get(job_service_1.JobService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('getProfileSummary', () => {
        it('should return empty summaries when no jobs found', async () => {
            jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue([]);
            const result = await service.getProfileSummary({});
            expect(result.summaries).toEqual([]);
            expect(result.total).toBe(0);
        });
        it('should aggregate jobs by engineKey', async () => {
            const mockJobs = [
                {
                    id: 'job-1',
                    type: 'NOVEL_ANALYSIS',
                    status: 'SUCCEEDED',
                    payload: {
                        engineKey: 'default_novel_analysis',
                        result: {
                            quality: { score: 0.9, confidence: 0.95 },
                            metrics: { durationMs: 1000, tokens: 100, costUsd: 0.01 },
                        },
                    },
                    engineConfig: null,
                    retryCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'job-2',
                    type: 'NOVEL_ANALYSIS',
                    status: 'SUCCEEDED',
                    payload: {
                        engineKey: 'default_novel_analysis',
                        result: {
                            quality: { score: 0.8, confidence: 0.9 },
                            metrics: { durationMs: 2000, tokens: 200, costUsd: 0.02 },
                        },
                    },
                    engineConfig: null,
                    retryCount: 0,
                    createdAt: new Date(),
                },
            ];
            jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs);
            jest.spyOn(jobService, 'extractEngineKeyFromJob').mockReturnValue('default_novel_analysis');
            jest.spyOn(jobService, 'extractEngineVersionFromJob').mockReturnValue(null);
            const result = await service.getProfileSummary({});
            expect(result.summaries.length).toBe(1);
            expect(result.summaries[0].engineKey).toBe('default_novel_analysis');
            expect(result.summaries[0].totalJobs).toBe(2);
            expect(result.summaries[0].successCount).toBe(2);
            expect(result.summaries[0].avgQualityScore).toBeCloseTo(0.85, 2);
            expect(result.summaries[0].avgDurationMs).toBeCloseTo(1500, 2);
        });
        it('should filter by engineKey when provided', async () => {
            const mockJobs = [
                {
                    id: 'job-1',
                    type: 'NOVEL_ANALYSIS',
                    status: 'SUCCEEDED',
                    payload: { engineKey: 'default_novel_analysis' },
                    engineConfig: null,
                    retryCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'job-2',
                    type: 'NOVEL_ANALYSIS',
                    status: 'SUCCEEDED',
                    payload: { engineKey: 'http_gemini_v1' },
                    engineConfig: null,
                    retryCount: 0,
                    createdAt: new Date(),
                },
            ];
            jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs);
            jest
                .spyOn(jobService, 'extractEngineKeyFromJob')
                .mockReturnValueOnce('default_novel_analysis')
                .mockReturnValueOnce('http_gemini_v1');
            jest.spyOn(jobService, 'extractEngineVersionFromJob').mockReturnValue(null);
            const result = await service.getProfileSummary({ engineKey: 'default_novel_analysis' });
            expect(result.summaries.length).toBe(1);
            expect(result.summaries[0].engineKey).toBe('default_novel_analysis');
        });
    });
});
//# sourceMappingURL=engine-profile.service.spec.js.map