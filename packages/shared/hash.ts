import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/**
 * Calculates SHA256 hash of a file using streams to maintain constant memory usage.
 */
export async function sha256File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const rs = createReadStream(filePath);
    rs.on('data', (d) => h.update(d));
    rs.on('error', reject);
    rs.on('end', () => resolve(h.digest('hex')));
  });
}
