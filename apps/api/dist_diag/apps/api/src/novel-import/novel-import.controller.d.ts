import { NovelImportService } from './novel-import.service';
import { FileParserService } from './file-parser.service';
import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';
import { ImportNovelDto } from './dto/import-novel.dto';
import { ImportNovelFileDto } from './dto/import-novel-file.dto';
import { ProjectService } from '../project/project.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { EngineTaskService } from '../task/engine-task.service';
import { JobService } from '../job/job.service';
import { StructureGenerateService } from '../project/structure-generate.service';
import { SceneGraphService } from '../project/scene-graph.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Request } from 'express';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
export declare class NovelImportController {
    private readonly novelImportService;
    private readonly fileParserService;
    private readonly analysisProcessor;
    private readonly projectService;
    private readonly prisma;
    private readonly taskService;
    private readonly engineTaskService;
    private readonly jobService;
    private readonly structureGenerateService;
    private readonly sceneGraphService;
    private readonly auditLogService;
    private readonly featureFlagService;
    private readonly textSafetyService;
    private readonly logger;
    private readonly uploadDir;
    private readonly SHREDDER_THRESHOLD_CHARACTERS;
    constructor(novelImportService: NovelImportService, fileParserService: FileParserService, analysisProcessor: NovelAnalysisProcessorService, projectService: ProjectService, prisma: PrismaService, taskService: TaskService, engineTaskService: EngineTaskService, jobService: JobService, structureGenerateService: StructureGenerateService, sceneGraphService: SceneGraphService, auditLogService: AuditLogService, featureFlagService: FeatureFlagService, textSafetyService: TextSafetyService);
    private performSafetyCheck;
    importNovelFile(projectId: string, file: Express.Multer.File, importNovelFileDto: ImportNovelFileDto, user: {
        userId: string;
    }, organizationId: string | null, request: Request): Promise<{
        success: boolean;
        data: {
            jobId: any;
            taskId: any;
            novelSourceId: any;
            mode: string;
            analysisJobId?: undefined;
            title?: undefined;
            author?: undefined;
            characterCount?: undefined;
            chapterCount?: undefined;
        };
        message: string;
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    } | {
        success: boolean;
        data: {
            jobId: string;
            analysisJobId: string;
            novelSourceId: string;
            title: string;
            author: string;
            characterCount: number;
            chapterCount: number;
            taskId?: undefined;
            mode?: undefined;
        };
        message: string;
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    importNovel(projectId: string, importNovelDto: ImportNovelDto, user: {
        userId: string;
    }, organizationId: string | null, request: Request): Promise<{
        success: boolean;
        data: {
            jobId: any;
            taskId: any;
            novelSourceId: any;
            mode: string;
            chapterCount?: undefined;
        };
        message: string;
    } | {
        success: boolean;
        data: {
            jobId: string;
            taskId: string;
            novelSourceId: string;
            chapterCount: number;
            mode?: undefined;
        };
        message: string;
    }>;
    getAnalysisJobs(projectId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: {
            jobs: {
                id: string;
                createdAt: Date;
                errorMessage: string | null;
                status: import("database").$Enums.NovelAnalysisStatus;
                updatedAt: Date;
                projectId: string;
                jobType: import("database").$Enums.NovelAnalysisJobType;
                chapterId: string | null;
                novelSourceId: string | null;
                progress: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            }[];
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
    getStatus(projectId: string, user: {
        userId: string;
    }, organizationId: string | null): Promise<{
        success: boolean;
        data: {
            id: string;
            status: import("database").$Enums.NovelSourceStatus;
            totalChapters: number;
            processedChunks: number;
            progress: number;
            error: string | null;
            updatedAt: Date;
        };
    }>;
    analyzeNovel(projectId: string, body: {
        chapterId?: string;
    }, user: {
        userId: string;
    }, organizationId: string | null, request: Request): Promise<{
        success: boolean;
        data: {
            jobId: string;
            taskId: string;
        };
        message: string;
    }>;
}
