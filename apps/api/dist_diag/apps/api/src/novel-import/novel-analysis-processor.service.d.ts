import { PrismaService } from '../prisma/prisma.service';
export declare class NovelAnalysisProcessorService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    analyzeChapter(chapterId: string): Promise<void>;
    private extractLocation;
}
