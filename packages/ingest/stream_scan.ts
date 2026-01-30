import * as fs from 'fs';
import * as readline from 'readline';

export interface ScanResult {
  title: string;
  startLine: number;
  endLine: number;
}

/**
 * Scan a novel file for chapters using streams.
 * Guaranteed constant memory usage.
 */
export async function streamScanFile(
  filePath: string,
  onChapterFound?: (chapter: ScanResult) => void
): Promise<ScanResult[]> {
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const episodes: ScanResult[] = [];
  let currentEp = { title: '序章/开始', startLine: 0, endLine: 0 };

  // Regex for Chapter Headers (e.g., 第1章, 第一回)
  const chapterPattern = /第\s*([0-9一二三四五六七八九十百千]+)\s*[章回集]/;

  let index = 0;
  for await (const line of rl) {
    if (chapterPattern.test(line)) {
      // Close previous chapter
      currentEp.endLine = index - 1;

      // Valid chapter check
      if (currentEp.endLine >= currentEp.startLine) {
        if (onChapterFound) onChapterFound({ ...currentEp });
        episodes.push({ ...currentEp });
      }

      // Start new chapter
      currentEp = { title: line.trim(), startLine: index, endLine: index };
    }
    index++;
  }

  // Close last chapter
  currentEp.endLine = index - 1;
  if (currentEp.endLine >= currentEp.startLine) {
    if (onChapterFound) onChapterFound({ ...currentEp });
    episodes.push(currentEp);
  }

  return episodes;
}
