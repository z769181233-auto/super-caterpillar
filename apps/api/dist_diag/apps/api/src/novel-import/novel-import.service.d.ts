import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';
export declare class NovelImportService {
    private readonly prisma;
    private readonly projectService;
    private readonly analysisProcessor;
    private readonly logger;
    constructor(prisma: PrismaService, projectService: ProjectService, analysisProcessor: NovelAnalysisProcessorService);
    analyzeChapter(chapterId: string): Promise<void>;
    analyzeNovelAndGenerateStructure(novelSourceId: string, projectId: string, userId: string, organizationId: string, chapters?: Array<{
        title: string;
        content: string;
    }>, savedChapters?: Array<{
        id: string;
        index: number;
        title: string;
        rawText: string;
    }>): Promise<void>;
    private callLLMForOutlineWithChapters;
    private callLLMForOutline;
    triggerShredderWorkflow(novelSourceId: string, projectId: string, organizationId: string, userId: string, filePath: string, title: string, traceId?: string, isVerification?: boolean): Promise<any>;
    private inferShotType;
}
