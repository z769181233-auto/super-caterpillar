import * as fs from 'fs/promises';
import * as path from 'path';
import {
  isWithinNovelUploadRoot,
  NOVEL_UPLOAD_ROOT,
  resolveNovelUploadPath,
  unlinkNovelUploadPath,
} from './novel-upload-path.util';

describe('novel-upload-path.util', () => {
  it('accepts files under the novel upload root', () => {
    const safePath = path.join(NOVEL_UPLOAD_ROOT, 'job-1', 'chapter.txt');

    expect(isWithinNovelUploadRoot(safePath)).toBe(true);
    expect(resolveNovelUploadPath(safePath)).toBe(path.join(NOVEL_UPLOAD_ROOT, 'chapter.txt'));
  });

  it('rejects sibling paths that only share the same prefix', () => {
    const unsafePath = `${NOVEL_UPLOAD_ROOT}-archive/chapter.txt`;

    expect(isWithinNovelUploadRoot(unsafePath)).toBe(false);
  });

  it('rejects traversal outside the upload root', () => {
    const unsafePath = path.join(NOVEL_UPLOAD_ROOT, '..', '..', 'etc', 'passwd');

    expect(isWithinNovelUploadRoot(unsafePath)).toBe(false);
  });

  it('normalizes absolute or traversal input back to upload root by basename', () => {
    expect(resolveNovelUploadPath('/tmp/evil.txt')).toBe(path.join(NOVEL_UPLOAD_ROOT, 'evil.txt'));
    expect(resolveNovelUploadPath('../escape.md')).toBe(path.join(NOVEL_UPLOAD_ROOT, 'escape.md'));
  });

  it('deletes files only through normalized upload paths', async () => {
    const safePath = path.join(NOVEL_UPLOAD_ROOT, 'unlink-me.txt');
    await fs.mkdir(NOVEL_UPLOAD_ROOT, { recursive: true });
    await fs.writeFile(safePath, 'ok');

    await expect(unlinkNovelUploadPath('/tmp/unlink-me.txt')).resolves.toBeUndefined();
    await expect(fs.access(safePath)).rejects.toThrow();
  });
});
