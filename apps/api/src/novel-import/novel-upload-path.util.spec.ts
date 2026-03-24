import * as path from 'path';
import {
  isWithinNovelUploadRoot,
  NOVEL_UPLOAD_ROOT,
  resolveNovelUploadPath,
} from './novel-upload-path.util';

describe('novel-upload-path.util', () => {
  it('accepts files under the novel upload root', () => {
    const safePath = path.join(NOVEL_UPLOAD_ROOT, 'job-1', 'chapter.txt');

    expect(isWithinNovelUploadRoot(safePath)).toBe(true);
    expect(resolveNovelUploadPath(safePath)).toBe(path.resolve(safePath));
  });

  it('rejects sibling paths that only share the same prefix', () => {
    const unsafePath = `${NOVEL_UPLOAD_ROOT}-archive/chapter.txt`;

    expect(isWithinNovelUploadRoot(unsafePath)).toBe(false);
  });

  it('rejects traversal outside the upload root', () => {
    const unsafePath = path.join(NOVEL_UPLOAD_ROOT, '..', '..', 'etc', 'passwd');

    expect(isWithinNovelUploadRoot(unsafePath)).toBe(false);
  });
});
