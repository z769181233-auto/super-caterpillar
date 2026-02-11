import * as fs from 'fs';
import { StringDecoder } from 'string_decoder';

export interface ScanResult {
  title: string;
  startByte: number; // Absolute byte offset in file (inclusive)
  endByte: number;   // Absolute byte offset of the last byte of this chapter (exclusive of next chapter start)
}

/**
 * Stage 4 "The Shredder" Stream Scanner
 * Scans a file for chapter titles and returns exact byte ranges.
 * Uses strict byte tracking to allow random-access reading in Worker.
 * 
 * Logic:
 * 1. Read file in chunks.
 * 2. Decode to UTF-8 strings (handling multi-byte char boundaries).
 * 3. Scan for newlines/chapter patterns.
 * 4. Track absolute byte offset.
 */
export async function streamScanFile(
  filePath: string,
  onChapterFound?: (chapter: ScanResult) => void
): Promise<ScanResult[]> {
  const decoder = new StringDecoder('utf8');
  const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

  const episodes: ScanResult[] = [];

  // State
  let absoluteByteOffset = 0;
  let buffer = '';
  // The start byte of the *current* chapter we are accumulating
  let currentChapterStartByte = 0;
  let currentChapterTitle = '序章/开始';

  // Regex for Chapter Headers
  // Matches "第N章" or similar patterns.
  // Note: We trim the line before checking, but byte calculation uses strict raw line.
  // Regex for Chapter Headers
  // Matches "第N章", "第N卷", "第N回", "Chapter N", etc.
  const chapterPattern = /^(第\s*[0-9一二三四五六七八九十百千]+\s*[章节回卷集篇]|Chapter\s*[0-9]+|Section\s*[0-9]+)/i;

  for await (const chunk of stream) {
    // Decode chunk to string, handling incomplete multibyte sequences
    const textChunk = decoder.write(chunk as Buffer);
    buffer += textChunk;

    // Process all lines in buffer
    let searchPos = 0;
    while (true) {
      const newlineIndex = buffer.indexOf('\n', searchPos);
      if (newlineIndex === -1) {
        break;
      }

      const lineStr = buffer.substring(searchPos, newlineIndex);
      // Byte length of this line content + 1 for the '\n' we stripped
      // Note: If CRLF, \r is in lineStr, so byteLength includes it.
      const lineTotalBytes = Buffer.byteLength(lineStr, 'utf8') + 1;

      // Check for chapter title
      const trimmed = lineStr.trim();
      if (chapterPattern.test(trimmed)) {
        // Found NEW chapter.
        // 1. Close previous chapter
        // formatting: previous chapter ends exactly where this line begins
        const prevChapterEndByte = absoluteByteOffset;

        if (prevChapterEndByte > currentChapterStartByte) {
          const ep: ScanResult = {
            title: currentChapterTitle,
            startByte: currentChapterStartByte,
            endByte: prevChapterEndByte // Exclusive end (start of next)
          };
          episodes.push(ep);
          if (onChapterFound) onChapterFound(ep);
        }

        // 2. Start new chapter
        currentChapterTitle = trimmed;
        currentChapterStartByte = absoluteByteOffset;
      }

      // Advance byte offset by this line
      absoluteByteOffset += lineTotalBytes;
      searchPos = newlineIndex + 1;
    }

    // Keep remaining incomplete line in buffer
    buffer = buffer.substring(searchPos);
  }

  // Handle remaining bytes (flush decoder)
  const remainder = decoder.end();
  buffer += remainder;

  if (buffer.length > 0) {
    // If there is no final newline, we still have content.
    // Or if there are multiple lines left.
    // Simple approach: treat the rest as one block or split by \n again?
    // flush() usually returns the last chars.
    // Be robust: treat buffer as final content.

    // We might have multiple lines if last chunk didn't end with \n
    // Same logic loop for remaining newlines
    let searchPos = 0;
    while (true) {
      const newlineIndex = buffer.indexOf('\n', searchPos);
      if (newlineIndex === -1) {
        break;
      }
      const lineStr = buffer.substring(searchPos, newlineIndex);
      const lineTotalBytes = Buffer.byteLength(lineStr, 'utf8') + 1;
      const trimmed = lineStr.trim();

      if (chapterPattern.test(trimmed)) {
        const prevChapterEndByte = absoluteByteOffset;
        if (prevChapterEndByte > currentChapterStartByte) {
          const ep = { title: currentChapterTitle, startByte: currentChapterStartByte, endByte: prevChapterEndByte };
          episodes.push(ep);
          if (onChapterFound) onChapterFound(ep);
        }
        currentChapterTitle = trimmed;
        currentChapterStartByte = absoluteByteOffset;
      }
      absoluteByteOffset += lineTotalBytes;
      searchPos = newlineIndex + 1;
    }

    // Handle very last segment (no newline at EOF)
    const lastSegment = buffer.substring(searchPos);
    if (lastSegment.length > 0) {
      const segBytes = Buffer.byteLength(lastSegment, 'utf8');

      // Check if last segment is a title (rare, but possible)
      const trimmed = lastSegment.trim();
      if (chapterPattern.test(trimmed)) {
        // Close previous
        const prevChapterEndByte = absoluteByteOffset;
        if (prevChapterEndByte > currentChapterStartByte) {
          const ep = { title: currentChapterTitle, startByte: currentChapterStartByte, endByte: prevChapterEndByte };
          episodes.push(ep);
          if (onChapterFound) onChapterFound(ep);
        }
        currentChapterTitle = trimmed;
        currentChapterStartByte = absoluteByteOffset;
      }

      absoluteByteOffset += segBytes;
    }
  }

  // Close the final chapter
  if (absoluteByteOffset > currentChapterStartByte) {
    const ep: ScanResult = {
      title: currentChapterTitle,
      startByte: currentChapterStartByte,
      endByte: absoluteByteOffset
    };
    episodes.push(ep);
    if (onChapterFound) onChapterFound(ep);
  }

  return episodes;
}
