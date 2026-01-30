import * as fs from 'fs';
import * as util from 'util';

const readFileAsync = util.promisify(fs.readFile);
const statAsync = util.promisify(fs.stat);

/**
 * Safely read a file with a size limit check.
 * Throws if file size exceeds maxBytes.
 * Uses async/await to avoid blocking event loop.
 */
export async function readFileUnderLimit(
  filePath: string,
  maxBytes: number = 5 * 1024 * 1024 // Default 5MB
): Promise<string> {
  const stats = await statAsync(filePath);

  if (stats.size > maxBytes) {
    throw new Error(
      `FILE_SIZE_EXCEEDED: File ${filePath} is ${stats.size} bytes, limit is ${maxBytes} bytes. Use streams.`
    );
  }

  // Safe to read into memory
  return await readFileAsync(filePath, 'utf-8');
}

/**
 * Buffer version of readFileUnderLimit
 */
export async function readBufferUnderLimit(
  filePath: string,
  maxBytes: number = 5 * 1024 * 1024
): Promise<Buffer> {
  const stats = await statAsync(filePath);

  if (stats.size > maxBytes) {
    throw new Error(
      `FILE_SIZE_EXCEEDED: File ${filePath} is ${stats.size} bytes, limit is ${maxBytes} bytes. Use streams.`
    );
  }

  return await readFileAsync(filePath);
}
