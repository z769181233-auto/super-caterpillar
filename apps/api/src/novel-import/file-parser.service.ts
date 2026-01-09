/* eslint-disable @typescript-eslint/ban-ts-comment, no-useless-escape, no-empty-character-class */
import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mammoth from 'mammoth';
import EPub from 'epub2';
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';

interface ParsedChapter {
  title: string;
  content: string;
  index: number;
}

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

@Injectable()
export class FileParserService {
  /**
   * 从文本中解析章节（简单规则：按 "第X章" 分割）
   * @param text 原始文本
   * @returns 章节列表
   */
  parseChaptersFromText(text: string): Array<{ title: string; content: string }> {
    const chapters: Array<{ title: string; content: string }> = [];

    // 匹配 "第X章" 或 "第一章" 等格式
    const chapterPattern =
      /(第[一二三四五六七八九十\d]+章[：:]\s*.+?)(?=第[一二三四五六七八九十\d]+章|$)/gs;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = chapterPattern.exec(text)) !== null) {
      // 提取章节标题和内容
      const fullMatch = match[0];
      const titleMatch = fullMatch.match(/^(第[一二三四五六七八九十\d]+章[：:]\s*.+?)(?:\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : `第${chapters.length + 1}章`;
      const content = fullMatch.substring(titleMatch ? titleMatch[0].length : 0).trim();

      if (content.length > 0) {
        chapters.push({ title, content });
      }
      lastIndex = match.index + fullMatch.length;
    }

    // 如果没有找到章节标记，将整个文本作为一个章节
    if (chapters.length === 0 && text.trim().length > 0) {
      chapters.push({
        title: '第1章',
        content: text.trim(),
      });
    }

    return chapters;
  }

  /**
   * 解析小说文件
   * @param filePath 文件路径
   * @param fileType 文件类型
   * @param fileName 原始文件名（用于提取作品名）
   */
  async parseFile(filePath: string, fileType: string, fileName?: string): Promise<ParsedNovel> {
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
        throw new BadRequestException(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * 从文件名提取作品名
   * 去除扩展名和常见后缀
   */
  extractTitleFromFileName(fileName: string): string | undefined {
    if (!fileName) return undefined;

    // 去除扩展名
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // 去除常见后缀（如：_v1, -副本, (1) 等）
    const cleaned = nameWithoutExt
      .replace(/[_\-]\s*v?\d+$/i, '') // 去除 _v1, -1 等
      .replace(/[\(（]\d+[\)）]$/, '') // 去除 (1), （1）等
      .replace(/\s*[-_]\s*副本$/, '') // 去除 -副本
      .trim();

    return cleaned || undefined;
  }

  /**
   * 提取元数据（小说名、作者）
   * 从前 200 行文本中提取
   */
  private extractMetadata(text: string, fileName?: string): { title?: string; author?: string } {
    const metadata: { title?: string; author?: string } = {};

    // 优先从文件名提取作品名
    if (fileName) {
      metadata.title = this.extractTitleFromFileName(fileName);
    }

    const lines = text.split('\n').slice(0, 200);

    for (const line of lines) {
      const trimmed = line.trim();

      // 提取小说名：支持《书名》或 "书名：" 格式（如果文件名没提取到）
      if (!metadata.title) {
        const titleMatch = trimmed.match(/[《]([^》]+)[》]/) || trimmed.match(/书名[：:]\s*(.+)/);
        if (titleMatch) {
          metadata.title = titleMatch[1].trim();
        }
      }

      // 提取作者：支持 "作者：" 格式
      if (!metadata.author) {
        const authorMatch = trimmed.match(/作者[：:]\s*(.+)/);
        if (authorMatch) {
          metadata.author = authorMatch[1].trim();
        }
      }

      // 如果都找到了，提前退出
      if (metadata.title && metadata.author) {
        break;
      }
    }

    return metadata;
  }

  /**
   * 解析 TXT 文件
   * 按章节标题拆分（支持多种章节格式）
   * 自动识别编码，统一转换为 UTF-8
   */
  private async parseTxt(filePath: string, fileName?: string): Promise<ParsedNovel> {
    console.log(`[FileParser] Parsing TXT file: ${filePath}`);

    // 读取文件为 Buffer（必须用 Buffer，不能直接用 utf-8）
    const buffer = await fs.readFile(filePath);
    console.log(`[FileParser] File size: ${buffer.length} bytes`);

    // 使用 chardet 检测编码
    const detectedEncoding = chardet.detect(buffer);
    let encoding = detectedEncoding || 'utf-8';
    console.log(`[FileParser] Detected encoding: ${detectedEncoding}, using: ${encoding}`);

    // 统一处理常见中文编码
    const encodingLower = encoding.toLowerCase();
    if (
      encodingLower.includes('gb') ||
      encodingLower.includes('gbk') ||
      encodingLower.includes('gb2312') ||
      encodingLower.includes('gb18030')
    ) {
      encoding = 'gbk'; // iconv-lite 使用 gbk 可以处理 gb2312/gb18030
      console.log(`[FileParser] Normalized to GBK for Chinese encoding`);
    }

    // 使用 iconv-lite 按检测到的编码解码，统一转换为 UTF-8
    let content: string;
    try {
      if (encodingLower === 'utf-8' || encodingLower === 'utf8') {
        content = buffer.toString('utf-8');
        console.log(`[FileParser] Decoded as UTF-8`);
      } else {
        // 从其他编码转换为 UTF-8
        content = iconv.decode(buffer, encoding);
        console.log(
          `[FileParser] Decoded from ${encoding} to UTF-8, content length: ${content.length}`
        );

        // 验证解码结果是否包含乱码（简单检查：如果全是问号或特殊字符，可能解码失败）
        const suspiciousChars = content.match(/[]/g);
        if (suspiciousChars && suspiciousChars.length > content.length * 0.1) {
          console.warn(
            `[FileParser] Warning: Detected ${suspiciousChars.length} suspicious characters, may need different encoding`
          );
        }
      }
    } catch (error) {
      console.error(`[FileParser] Failed to decode with ${encoding}:`, error);
      // 如果解码失败，尝试使用 UTF-8
      try {
        content = buffer.toString('utf-8');
        console.log(`[FileParser] Fallback to UTF-8`);
      } catch (utf8Error) {
        // 如果 UTF-8 也失败，尝试 GBK（中文常见）
        try {
          content = iconv.decode(buffer, 'gbk');
          console.log(`[FileParser] Fallback to GBK`);
        } catch (gbkError) {
          // 最后尝试 latin1（最宽松的编码）
          content = buffer.toString('latin1');
          console.warn(`[FileParser] Using latin1 as last resort`);
        }
      }
    }

    // 确保内容是有效的 UTF-8（清理无效字符）
    // 先尝试重新编码验证
    try {
      const testBuffer = Buffer.from(content, 'utf-8');
      content = testBuffer.toString('utf-8');
      console.log(`[FileParser] UTF-8 validation passed, final content length: ${content.length}`);
    } catch (error) {
      console.error(`[FileParser] UTF-8 validation failed, keeping original content`);
    }

    // 提取元数据（传入文件名）
    const metadata = this.extractMetadata(content, fileName);

    const lines = content.split('\n');

    // 章节标题正则（支持多种格式）
    const chapterPatterns = [
      /^第[一二三四五六七八九十百千万\d]+章[^\n]*$/,
      /^第[一二三四五六七八九十百千万\d]+回[^\n]*$/,
      /^Chapter\s+\d+[^\n]*$/i,
      /^Chapter\s+[IVX]+[^\n]*$/i,
      /^\d+[\.\s]+[^\n]+$/,
    ];

    const chapters: ParsedChapter[] = [];
    let currentChapter: ParsedChapter | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const isChapterTitle = chapterPatterns.some((pattern) => pattern.test(trimmedLine));

      if (isChapterTitle && trimmedLine.length < 100) {
        // 保存上一章
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        // 开始新章
        currentChapter = {
          title: trimmedLine,
          content: '',
          index: chapters.length + 1,
        };
      } else if (currentChapter) {
        currentChapter.content += line + '\n';
      } else if (chapters.length === 0) {
        // 如果没有找到章节标题，将整个文件作为第一章
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

    // 保存最后一章
    if (currentChapter) {
      chapters.push(currentChapter);
    }

    // 如果没有章节，将整个文件作为一章
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
      rawText, // 确保是 UTF-8 编码的干净文本
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

  /**
   * 解析 DOCX 文件
   * 识别一级标题作为章节
   */
  private async parseDocx(filePath: string, fileName?: string): Promise<ParsedNovel> {
    const result = await mammoth.extractRawText({ path: filePath });
    const content = result.value;

    // 简单处理：按段落拆分，识别一级标题
    const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);
    const chapters: ParsedChapter[] = [];
    let currentChapter: ParsedChapter | null = null;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      // 简单判断：短行且包含"第X章"或"Chapter"可能是章节标题
      if (
        trimmed.length < 50 &&
        (trimmed.match(/^第[一二三四五六七八九十百千万\d]+章/) ||
          trimmed.match(/^Chapter\s+\d+/i) ||
          trimmed.match(/^\d+[\.\s]/))
      ) {
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        currentChapter = {
          title: trimmed,
          content: '',
          index: chapters.length + 1,
        };
      } else if (currentChapter) {
        currentChapter.content += para + '\n\n';
      } else {
        // 第一段作为章节标题
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

    // 提取元数据
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

  /**
   * 解析 EPUB 文件
   * 读取 metadata 和章节列表
   */
  private async parseEpub(filePath: string): Promise<ParsedNovel> {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);

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

          const chapters: ParsedChapter[] = [];
          const chapterPromises = epub.flow.map((item) => {
            return new Promise<void>((resolveChapter) => {
              if (!item.id) {
                // 没有 id 的章节直接跳过
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
            reject(new BadRequestException('EPUB file contains no chapters'));
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
        } catch (error) {
          reject(error);
        }
      });

      epub.on('error', (err) => {
        reject(new BadRequestException(`Failed to parse EPUB: ${err.message}`));
      });

      epub.parse();
    });
  }

  /**
   * 解析 Markdown 文件
   * 按一级标题（#）拆分章节
   */
  private async parseMarkdown(filePath: string, fileName?: string): Promise<ParsedNovel> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const chapters: ParsedChapter[] = [];
    let currentChapter: ParsedChapter | null = null;

    for (const line of lines) {
      if (line.trim().startsWith('# ')) {
        // 一级标题
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        currentChapter = {
          title: line.trim().substring(2).trim(),
          content: '',
          index: chapters.length + 1,
        };
      } else if (currentChapter) {
        currentChapter.content += line + '\n';
      } else {
        // 第一行作为章节标题
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

    // 提取元数据
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
}
