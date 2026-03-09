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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var FileParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParserService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs/promises"));
const mammoth = __importStar(require("mammoth"));
const epub2_1 = __importDefault(require("epub2"));
const chardet = __importStar(require("chardet"));
const iconv = __importStar(require("iconv-lite"));
let FileParserService = FileParserService_1 = class FileParserService {
    logger = new common_1.Logger(FileParserService_1.name);
    parseChaptersFromText(text) {
        const chapters = [];
        const chapterPattern = /(第[一二三四五六七八九十\d]+章[：:]\s*.+?)(?=第[一二三四五六七八九十\d]+章|$)/gs;
        let match;
        let lastIndex = 0;
        while ((match = chapterPattern.exec(text)) !== null) {
            const fullMatch = match[0];
            const titleMatch = fullMatch.match(/^(第[一二三四五六七八九十\d]+章[：:]\s*.+?)(?:\n|$)/);
            const title = titleMatch ? titleMatch[1].trim() : `第${chapters.length + 1}章`;
            const content = fullMatch.substring(titleMatch ? titleMatch[0].length : 0).trim();
            if (content.length > 0) {
                chapters.push({ title, content });
            }
            lastIndex = match.index + fullMatch.length;
        }
        if (chapters.length === 0 && text.trim().length > 0) {
            chapters.push({
                title: '第1章',
                content: text.trim(),
            });
        }
        return chapters;
    }
    async parseFile(filePath, fileType, fileName) {
        switch (fileType.toLowerCase()) {
            case 'txt':
                return this.parseTxt(filePath, fileName);
            case 'docx':
                return this.parseDocx(filePath, fileName);
            case 'epub':
                return this.parseEpub(filePath);
            case 'md':
                return this.parseMarkdown(filePath, fileName);
            default:
                throw new common_1.BadRequestException(`Unsupported file type: ${fileType}`);
        }
    }
    extractTitleFromFileName(fileName) {
        if (!fileName)
            return undefined;
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const cleaned = nameWithoutExt
            .replace(/[_\-]\s*v?\d+$/i, '')
            .replace(/[\(（]\d+[\)）]$/, '')
            .replace(/\s*[-_]\s*副本$/, '')
            .trim();
        return cleaned || undefined;
    }
    extractMetadata(text, fileName) {
        const metadata = {};
        if (fileName) {
            metadata.title = this.extractTitleFromFileName(fileName);
        }
        const lines = text.split('\n').slice(0, 200);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!metadata.title) {
                const titleMatch = trimmed.match(/[《]([^》]+)[》]/) || trimmed.match(/书名[：:]\s*(.+)/);
                if (titleMatch) {
                    metadata.title = titleMatch[1].trim();
                }
            }
            if (!metadata.author) {
                const authorMatch = trimmed.match(/作者[：:]\s*(.+)/);
                if (authorMatch) {
                    metadata.author = authorMatch[1].trim();
                }
            }
            if (metadata.title && metadata.author) {
                break;
            }
        }
        return metadata;
    }
    async parseTxt(filePath, fileName) {
        this.logger.log(`Parsing TXT file: ${filePath}`);
        const buffer = await fs.readFile(filePath);
        this.logger.log(`File size: ${buffer.length} bytes`);
        const detectedEncoding = chardet.detect(buffer);
        let encoding = detectedEncoding || 'utf-8';
        this.logger.log(`Detected encoding: ${detectedEncoding}, using: ${encoding}`);
        const encodingLower = encoding.toLowerCase();
        if (encodingLower.includes('gb') ||
            encodingLower.includes('gbk') ||
            encodingLower.includes('gb2312') ||
            encodingLower.includes('gb18030')) {
            encoding = 'gbk';
            this.logger.log(`Normalized to GBK for Chinese encoding`);
        }
        let content;
        try {
            if (encodingLower === 'utf-8' || encodingLower === 'utf8') {
                content = buffer.toString('utf-8');
                this.logger.log(`Decoded as UTF-8`);
            }
            else {
                content = iconv.decode(buffer, encoding);
                this.logger.log(`Decoded from ${encoding} to UTF-8, content length: ${content.length}`);
                const suspiciousChars = content.match(/[]/g);
                if (suspiciousChars && suspiciousChars.length > content.length * 0.1) {
                    this.logger.warn(`Detected ${suspiciousChars.length} suspicious characters, may need different encoding`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to decode with ${encoding}:`, error.message);
            try {
                content = buffer.toString('utf-8');
                this.logger.log(`Fallback to UTF-8`);
            }
            catch (utf8Error) {
                try {
                    content = iconv.decode(buffer, 'gbk');
                    this.logger.log(`Fallback to GBK`);
                }
                catch (gbkError) {
                    content = buffer.toString('latin1');
                    this.logger.warn(`Using latin1 as last resort`);
                }
            }
        }
        try {
            const testBuffer = Buffer.from(content, 'utf-8');
            content = testBuffer.toString('utf-8');
            this.logger.log(`UTF-8 validation passed, final content length: ${content.length}`);
        }
        catch (error) {
            this.logger.error(`[FileParser] UTF-8 validation failed, keeping original content`);
        }
        const metadata = this.extractMetadata(content, fileName);
        const lines = content.split('\n');
        const chapterPatterns = [
            /^第[一二三四五六七八九十百千万\d]+章[^\n]*$/,
            /^第[一二三四五六七八九十百千万\d]+回[^\n]*$/,
            /^Chapter\s+\d+[^\n]*$/i,
            /^Chapter\s+[IVX]+[^\n]*$/i,
            /^\d+[\.\s]+[^\n]+$/,
        ];
        const chapters = [];
        let currentChapter = null;
        for (const line of lines) {
            const trimmedLine = line.trim();
            const isChapterTitle = chapterPatterns.some((pattern) => pattern.test(trimmedLine));
            if (isChapterTitle && trimmedLine.length < 100) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                currentChapter = {
                    title: trimmedLine,
                    content: '',
                    index: chapters.length + 1,
                };
            }
            else if (currentChapter) {
                currentChapter.content += line + '\n';
            }
            else if (chapters.length === 0) {
                if (!currentChapter) {
                    currentChapter = {
                        title: '第一章',
                        content: '',
                        index: 1,
                    };
                }
                currentChapter.content += line + '\n';
            }
        }
        if (currentChapter) {
            chapters.push(currentChapter);
        }
        if (chapters.length === 0) {
            chapters.push({
                title: '第一章',
                content,
                index: 1,
            });
        }
        const rawText = chapters.map((ch) => `${ch.title}\n\n${ch.content}`).join('\n\n');
        return {
            title: metadata.title,
            author: metadata.author,
            rawText,
            chapters,
            characterCount: rawText.length,
            chapterCount: chapters.length,
            metadata: {
                ...metadata,
                originalEncoding: encoding,
                convertedToUtf8: encoding.toLowerCase() !== 'utf-8',
            },
        };
    }
    async parseDocx(filePath, fileName) {
        const result = await mammoth.extractRawText({ path: filePath });
        const content = result.value;
        const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);
        const chapters = [];
        let currentChapter = null;
        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (trimmed.length < 50 &&
                (trimmed.match(/^第[一二三四五六七八九十百千万\d]+章/) ||
                    trimmed.match(/^Chapter\s+\d+/i) ||
                    trimmed.match(/^\d+[\.\s]/))) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                currentChapter = {
                    title: trimmed,
                    content: '',
                    index: chapters.length + 1,
                };
            }
            else if (currentChapter) {
                currentChapter.content += para + '\n\n';
            }
            else {
                currentChapter = {
                    title: trimmed.length < 50 ? trimmed : '第一章',
                    content: trimmed.length < 50 ? '' : trimmed + '\n\n',
                    index: 1,
                };
            }
        }
        if (currentChapter) {
            chapters.push(currentChapter);
        }
        if (chapters.length === 0) {
            chapters.push({
                title: '第一章',
                content,
                index: 1,
            });
        }
        const rawText = chapters.map((ch) => `${ch.title}\n\n${ch.content}`).join('\n\n');
        const metadata = this.extractMetadata(content, fileName);
        return {
            title: metadata.title,
            author: metadata.author,
            rawText,
            chapters,
            characterCount: rawText.length,
            chapterCount: chapters.length,
            metadata: {
                ...metadata,
                fileType: 'docx',
            },
        };
    }
    async parseEpub(filePath) {
        return new Promise((resolve, reject) => {
            const epub = new epub2_1.default(filePath);
            epub.on('end', async () => {
                try {
                    const metadata = {
                        title: epub.metadata.title,
                        creator: epub.metadata.creator,
                        subject: epub.metadata.subject,
                        description: epub.metadata.description,
                        publisher: epub.metadata.publisher,
                        date: epub.metadata.date,
                    };
                    const chapters = [];
                    const chapterPromises = epub.flow.map((item) => {
                        return new Promise((resolveChapter) => {
                            if (!item.id) {
                                return resolveChapter();
                            }
                            epub.getChapter(item.id, (err, text) => {
                                if (!err && text) {
                                    chapters.push({
                                        title: item.title || `Chapter ${chapters.length + 1}`,
                                        content: text,
                                        index: chapters.length + 1,
                                    });
                                }
                                resolveChapter();
                            });
                        });
                    });
                    await Promise.all(chapterPromises);
                    if (chapters.length === 0) {
                        reject(new common_1.BadRequestException('EPUB file contains no chapters'));
                        return;
                    }
                    const rawText = chapters.map((ch) => `${ch.title}\n\n${ch.content}`).join('\n\n');
                    resolve({
                        title: metadata.title?.[0] || undefined,
                        author: metadata.creator?.[0] || undefined,
                        rawText,
                        chapters,
                        characterCount: rawText.length,
                        chapterCount: chapters.length,
                        metadata,
                    });
                }
                catch (error) {
                    reject(error);
                }
            });
            epub.on('error', (err) => {
                reject(new common_1.BadRequestException(`Failed to parse EPUB: ${err.message}`));
            });
            epub.parse();
        });
    }
    async parseMarkdown(filePath, fileName) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const chapters = [];
        let currentChapter = null;
        for (const line of lines) {
            if (line.trim().startsWith('# ')) {
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                currentChapter = {
                    title: line.trim().substring(2).trim(),
                    content: '',
                    index: chapters.length + 1,
                };
            }
            else if (currentChapter) {
                currentChapter.content += line + '\n';
            }
            else {
                currentChapter = {
                    title: line.trim().startsWith('#') ? line.trim().substring(1).trim() : '第一章',
                    content: line.trim().startsWith('#') ? '' : line + '\n',
                    index: 1,
                };
            }
        }
        if (currentChapter) {
            chapters.push(currentChapter);
        }
        if (chapters.length === 0) {
            chapters.push({
                title: '第一章',
                content,
                index: 1,
            });
        }
        const rawText = chapters.map((ch) => `${ch.title}\n\n${ch.content}`).join('\n\n');
        const metadata = this.extractMetadata(content, fileName);
        return {
            title: metadata.title,
            author: metadata.author,
            rawText,
            chapters,
            characterCount: rawText.length,
            chapterCount: chapters.length,
            metadata: {
                ...metadata,
                fileType: 'md',
            },
        };
    }
};
exports.FileParserService = FileParserService;
exports.FileParserService = FileParserService = FileParserService_1 = __decorate([
    (0, common_1.Injectable)()
], FileParserService);
//# sourceMappingURL=file-parser.service.js.map