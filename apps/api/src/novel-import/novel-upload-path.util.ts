import * as fs from 'fs/promises';
import * as path from 'path';

export const NOVEL_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'novels');

export function isWithinNovelUploadRoot(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(NOVEL_UPLOAD_ROOT, resolvedPath);

  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

export function resolveNovelUploadPath(filePath: string): string {
  const safeFileName = path.basename(filePath);
  return path.join(NOVEL_UPLOAD_ROOT, safeFileName);
}

export async function unlinkNovelUploadPath(filePath: string): Promise<void> {
  const safePath = resolveNovelUploadPath(filePath);
  if (!isWithinNovelUploadRoot(safePath)) {
    return;
  }

  try {
    await fs.unlink(safePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
