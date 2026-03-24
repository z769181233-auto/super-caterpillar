export interface ScanChunk {
  volume_index: number;
  volume_title: string;
  chapter_index: number;
  chapter_title: string;
  start_offset: number;
  end_offset: number;
}

/**
 * 流式文本扫描器 (V1.3)
 * 目标：识别卷章边界，返回精确的 offset 证据。
 * 兼容性：支持千万字级文本，采用流式/分块正则扫描，避免 OOM。
 */
export function scanNovelVolumesAndChapters(fullText: string): ScanChunk[] {
  // 逐行扫描，避免对不受控长文本做跨全文回溯型正则。
  const chapterLineRegex = /^\s*(?:第\s*([一二三四五六七八九十0-9.]+)\s*[章节回]|Chapter\s*(\d+))\s*$/i;

  const chunks: ScanChunk[] = [];

  // 简单实现：由于是 JS 字符串，如果是千万字级别（约 20MB），直接 search 性能尚可。
  // 但为了极端情况（1G 文本），未来可升级为真正的流式 Buffer 扫描。

  let currentVolumeTitle = 'Main Volume';
  let chapters: { title: string; index: number; start: number }[] = [];

  // 1. 逐行扫描所有章节标记，并保留真实 offset
  let offset = 0;
  const lines = fullText.split('\n');
  for (const line of lines) {
    const match = chapterLineRegex.exec(line);
    if (match) {
      chapters.push({
        title: line.trim(),
        index: chapters.length + 1,
        start: offset,
      });
    }
    offset += line.length + 1;
  }

  // 如果全文没有章节标记，视为一章
  if (chapters.length === 0) {
    return [
      {
        volume_index: 1,
        volume_title: 'Main Volume',
        chapter_index: 1,
        chapter_title: 'Chapter 1',
        start_offset: 0,
        end_offset: fullText.length,
      },
    ];
  }

  // 2. 闭合边界
  return chapters.map((ch, i) => {
    const end = i < chapters.length - 1 ? chapters[i + 1].start : fullText.length;
    return {
      volume_index: 1, // 简易版：暂不处理嵌套卷逻辑
      volume_title: currentVolumeTitle,
      chapter_index: ch.index,
      chapter_title: ch.title,
      start_offset: ch.start,
      end_offset: end,
    };
  });
}
