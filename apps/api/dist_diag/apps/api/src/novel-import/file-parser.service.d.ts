export interface ParsedNovel {
    title?: string;
    author?: string;
    rawText: string;
    chapters: Array<{
        title: string;
        content: string;
    }>;
    characterCount: number;
    chapterCount: number;
    metadata?: Record<string, any>;
}
export declare class FileParserService {
    private readonly logger;
    parseChaptersFromText(text: string): Array<{
        title: string;
        content: string;
    }>;
    parseFile(filePath: string, fileType: string, fileName?: string): Promise<ParsedNovel>;
    extractTitleFromFileName(fileName: string): string | undefined;
    private extractMetadata;
    private parseTxt;
    private parseDocx;
    private parseEpub;
    private parseMarkdown;
}
