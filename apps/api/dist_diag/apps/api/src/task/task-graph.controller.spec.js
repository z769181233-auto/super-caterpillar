"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const task_graph_controller_1 = require("./task-graph.controller");
const task_graph_service_1 = require("./task-graph.service");
const quality_score_service_1 = require("../quality/quality-score.service");
const quality_feedback_service_1 = require("../quality/quality-feedback.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
describe('TaskGraphController - S3-C.3 Phase 1', () => {
    let controller;
    let taskGraphService;
    let prismaService;
    let jobService;
    const mockTaskGraphService = {
        findTaskGraph: jest.fn(),
    };
    const mockPrismaService = {
        $disconnect: jest.fn().mockResolvedValue(undefined),
        shotJob: {
            findMany: jest.fn(),
        },
        task: {
            findUnique: jest.fn(),
        },
    };
    const mockJobService = {
        extractEngineKeyFromJob: jest.fn(),
        extractEngineVersionFromJob: jest.fn(),
    };
    const mockQualityScoreService = {
        buildQualityScoreFromJob: jest.fn(),
    };
    const mockQualityFeedbackService = {
        evaluateQualityScores: jest.fn(),
    };
    const mockEngineRegistry = {
        getAdapter: jest.fn(),
    };
    const mockEngineConfigStore = {
        findByEngineKey: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [task_graph_controller_1.TaskGraphController],
            providers: [
                { provide: task_graph_service_1.TaskGraphService, useValue: mockTaskGraphService },
                { provide: quality_score_service_1.QualityScoreService, useValue: mockQualityScoreService },
                { provide: quality_feedback_service_1.QualityFeedbackService, useValue: mockQualityFeedbackService },
                { provide: engine_registry_service_1.EngineRegistry, useValue: mockEngineRegistry },
                { provide: engine_config_store_service_1.EngineConfigStoreService, useValue: mockEngineConfigStore },
                { provide: prisma_service_1.PrismaService, useValue: mockPrismaService },
                { provide: job_service_1.JobService, useValue: mockJobService },
            ],
        }).compile();
        controller = module.get(task_graph_controller_1.TaskGraphController);
        taskGraphService = module.get(task_graph_service_1.TaskGraphService);
        prismaService = module.get(prisma_service_1.PrismaService);
        jobService = module.get(job_service_1.JobService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('getTaskGraph - 引擎信息字段验证', () => {
        it('应该返回包含完整引擎信息的 Job 节点（有 payload.engineKey 和 payload.engineVersion）', async () => {
            const taskId = 'test-task-id';
            const mockGraph = {
                taskId,
                projectId: 'test-project-id',
                taskType: 'NOVEL_ANALYSIS',
                status: 'SUCCEEDED',
                jobs: [
                    {
                        jobId: 'job-1',
                        jobType: 'NOVEL_ANALYSIS',
                        status: 'SUCCEEDED',
                        attempts: 1,
                        retryCount: 0,
                        maxRetry: null,
                        createdAt: '2025-12-11T00:00:00Z',
                        startedAt: '2025-12-11T00:01:00Z',
                        finishedAt: '2025-12-11T00:02:00Z',
                    },
                ],
            };
            const mockRawJob = {
                id: 'job-1',
                type: 'NOVEL_ANALYSIS',
                payload: {
                    engineKey: 'http_gemini_v1',
                    engineVersion: 'v1.0',
                    result: {
                        quality: {
                            score: 0.85,
                            confidence: 0.9,
                        },
                        metrics: {
                            durationMs: 2000,
                            costUsd: 0.001,
                            tokens: 1000,
                        },
                    },
                },
            };
            const mockQualityScore = {
                taskId,
                jobId: 'job-1',
                engineKey: 'http_gemini_v1',
                adapterName: 'http',
                quality: {
                    score: 0.85,
                    confidence: 0.9,
                },
                metrics: {
                    durationMs: 2000,
                    costUsd: 0.001,
                    tokens: 1000,
                },
            };
            mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
            mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
            mockJobService.extractEngineKeyFromJob.mockReturnValue('http_gemini_v1');
            mockJobService.extractEngineVersionFromJob.mockReturnValue('v1.0');
            mockEngineRegistry.getAdapter.mockReturnValue({ name: 'http' });
            mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(mockQualityScore);
            mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
                avgScore: 0.85,
                avgConfidence: 0.9,
                total: 1,
            });
            const result = await controller.getTaskGraph(taskId);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.jobs).toHaveLength(1);
            const job = result.data?.jobs[0];
            expect(job).toBeDefined();
            expect(job.engineKey).toBe('http_gemini_v1');
            expect(job.engineVersion).toBe('v1.0');
            expect(job.adapterName).toBe('http');
            expect(job.qualityScore).toBeDefined();
            expect(job.qualityScore.score).toBe(0.85);
            expect(job.qualityScore.confidence).toBe(0.9);
            expect(job.metrics).toBeDefined();
            expect(job.metrics.durationMs).toBe(2000);
            expect(job.metrics.costUsd).toBe(0.001);
            expect(job.metrics.tokens).toBe(1000);
        });
        it('应该返回包含默认引擎信息的 Job 节点（没有显式 engineKey）', async () => {
            const taskId = 'test-task-id';
            const mockGraph = {
                taskId,
                projectId: 'test-project-id',
                taskType: 'NOVEL_ANALYSIS',
                status: 'SUCCEEDED',
                jobs: [
                    {
                        jobId: 'job-2',
                        jobType: 'NOVEL_ANALYSIS',
                        status: 'SUCCEEDED',
                        attempts: 1,
                        retryCount: 0,
                        maxRetry: null,
                        createdAt: '2025-12-11T00:00:00Z',
                        startedAt: '2025-12-11T00:01:00Z',
                        finishedAt: '2025-12-11T00:02:00Z',
                    },
                ],
            };
            const mockRawJob = {
                id: 'job-2',
                type: 'NOVEL_ANALYSIS',
                payload: {
                    result: {
                        quality: {
                            score: 0.75,
                            confidence: 0.8,
                        },
                    },
                },
            };
            const mockQualityScore = {
                taskId,
                jobId: 'job-2',
                engineKey: 'default_novel_analysis',
                adapterName: 'default_novel_analysis',
                quality: {
                    score: 0.75,
                    confidence: 0.8,
                },
                metrics: {},
            };
            mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
            mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
            mockJobService.extractEngineKeyFromJob.mockReturnValue('default_novel_analysis');
            mockJobService.extractEngineVersionFromJob.mockReturnValue(null);
            mockEngineRegistry.getAdapter.mockReturnValue({ name: 'default_novel_analysis' });
            mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(mockQualityScore);
            mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
                avgScore: 0.75,
                avgConfidence: 0.8,
                total: 1,
            });
            const result = await controller.getTaskGraph(taskId);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            const job = result.data?.jobs[0];
            expect(job).toBeDefined();
            expect(job.engineKey).toBe('default_novel_analysis');
            expect(job.engineVersion).toBe(null);
            expect(job.adapterName).toBe('default_novel_analysis');
        });
        it('应该正确处理没有质量信息的 Job（所有字段应为 null）', async () => {
            const taskId = 'test-task-id';
            const mockGraph = {
                taskId,
                projectId: 'test-project-id',
                taskType: 'NOVEL_ANALYSIS',
                status: 'SUCCEEDED',
                jobs: [
                    {
                        jobId: 'job-3',
                        jobType: 'NOVEL_ANALYSIS',
                        status: 'PENDING',
                        attempts: 0,
                        retryCount: 0,
                        maxRetry: null,
                        createdAt: '2025-12-11T00:00:00Z',
                        startedAt: null,
                        finishedAt: null,
                    },
                ],
            };
            const mockRawJob = {
                id: 'job-3',
                type: 'NOVEL_ANALYSIS',
                payload: {
                    engineKey: 'default_novel_analysis',
                },
            };
            mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
            mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
            mockJobService.extractEngineKeyFromJob.mockReturnValue('default_novel_analysis');
            mockJobService.extractEngineVersionFromJob.mockReturnValue(null);
            mockEngineRegistry.getAdapter.mockReturnValue({ name: 'default_novel_analysis' });
            mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(null);
            mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
                avgScore: null,
                avgConfidence: null,
                total: 0,
            });
            const result = await controller.getTaskGraph(taskId);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            const job = result.data?.jobs[0];
            expect(job).toBeDefined();
            expect(job.engineKey).toBe('default_novel_analysis');
            expect(job.qualityScore).toBe(null);
            expect(job.metrics).toBe(null);
        });
    });
});
//# sourceMappingURL=task-graph.controller.spec.js.map