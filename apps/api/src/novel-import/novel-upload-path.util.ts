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
  return path.resolve(filePath);
}
