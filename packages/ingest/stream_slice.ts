import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Read specific lines from a file using streams.
 * 0-indexed startLine (inclusive) to endLine (inclusive).
 */
export async function streamSliceLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let currentLine = 0;
  const lines: string[] = [];

  for await (const line of rl) {
    if (currentLine >= startLine && currentLine <= endLine) {
      lines.push(line);
    }

    if (currentLine > endLine) {
      rl.close();
      fileStream.destroy();
      break;
    }
    currentLine++;
  }

  return lines.join('\n');
}
