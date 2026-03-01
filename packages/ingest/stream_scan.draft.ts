import * as fs from 'fs';
import { StringDecoder } from 'string_decoder';

export interface ScanResult {
  title: string;
  startLine?: number;
  endLine?: number;
  startByte: number; // Absolute byte offset in file
  endByte: number; // Absolute byte offset of the last byte of this chapter
}

/**
 * Stage 4 "The Shredder" Stream Scanner
 * Scans a file for chapter titles and returns byte ranges.
 * Uses strict byte tracking to allow random-access reading in Worker.
 */
export async function streamScanFile(
  filePath: string,
  onChapterFound?: (chapter: ScanResult) => void
): Promise<ScanResult[]> {
  const decoder = new StringDecoder('utf8');
  const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 }); // 64KB chunks

  const episodes: ScanResult[] = [];

  // State
  let absoluteByteOffset = 0;
  let buffer = '';
  let lastChapterStartByte = 0;
  let currentTitle = '序章/前言';

  // Regex for Chapter Headers
  // Must match start of line. Since we split by \n, logic checks each "line".
  // Allow strict matching to avoid false positives in dialogue.
  const chapterPattern = /^第\s*([0-9一二三四五六七八九十百千]+)\s*[章回集]/;

  for await (const chunk of stream) {
    const textChunk = decoder.write(chunk as Buffer);

    // Append new chunk to buffer
    buffer += textChunk;

    // Find all newlines in buffer
    let searchPos = 0;
    while (true) {
      const newlineIndex = buffer.indexOf('\n', searchPos);
      if (newlineIndex === -1) {
        break;
      }

      const lineStr = buffer.substring(searchPos, newlineIndex);
      // Calculate byte length of this line INCLUDING the newline char (\n)
      // Note: standardizing on \n. If file has \r\n, the \r is part of lineStr.
      // We need exact bytes.
      // Buffer.byteLength(lineStr) + 1 (for \n) is an approximation if we re-encoded.
      // BUT: The chunk boundaries might have split bytes.
      // The most robust way to track bytes is to track bytes consumed from the *source chunk*?
      // No, because existing string might be from previous chunk.
      // Reliable way: Buffer.byteLength verification.
      const lineBytes = Buffer.byteLength(lineStr, 'utf8') + 1; // +1 for \n

      const trimmed = lineStr.trim();
      if (chapterPattern.test(trimmed)) {
        // Found new chapter!
        // The previous chapter ends at current global offset - 1
        const prevEndByte =
          absoluteByteOffset + searchPos + Buffer.byteLength(lineStr, 'utf8') - lineBytes; // Logic allows gaps? No.
        // Actually: previous chapter ends right before this title line starts.
        // Current Title Line Start = absoluteByteOffset + searchPos (in decoded space? No.)

        // REA-THINK: Mixing decoded strings and byte offsets is dangerous for exact ranges.
        // If we want EXACT byte ranges, we should scan Buffer, not String?
        // But Regex on Buffer is hard (encoding).

        // Hybrid approach:
        // We know we processed X bytes from the file stream.
        // But StringDecoder buffers partial sequences.

        // Correct approach for Stage 4:
        // We accumulate a "working buffer" of string.
        // We keep track of "bytes belonging to the string in the buffer".
        // This is hard with StringDecoder.

        // SIMPLIFIED APPROACH:
        // Read file as strict UTF8.
        // We assume valid UTF8.
        // Buffer.byteLength(string) IS accurate for UTF8.

        const validLineStartByte = absoluteByteOffset;
        // Wait, absoluteByteOffset needs to track the start of the `buffer` relative to file?
        // No.

        // Let's refactor the loop to be line-based but stateful.
      }

      searchPos = newlineIndex + 1;
    }

    // Keep the remainder in buffer
    // Update absoluteByteOffset by the bytes we *discarded* from buffer?
    // This is getting complicated.
  }

  // ...
  return [];
}
