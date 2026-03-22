import * as fs from 'fs';
import * as path from 'path';

export class MemoryLogger {
  private interval: NodeJS.Timeout | null = null;
  private suiteName: string;
  private filePath: string;

  constructor(suiteName: string, filePath: string) {
    this.suiteName = suiteName;
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  start(intervalMs: number = 1000) {
    const absolutePath = path.resolve(this.filePath);
    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(absolutePath, 'timestamp,rss_mb,heap_used_mb,external_mb\n');
    }

    this.interval = setInterval(() => {
      try {
        const mem = process.memoryUsage();
        const timestamp = new Date().toISOString();
        const rss = (mem.rss / 1024 / 1024).toFixed(2);
        const heap = (mem.heapUsed / 1024 / 1024).toFixed(2);
        const external = (mem.external / 1024 / 1024).toFixed(2);

        fs.appendFileSync(absolutePath, `${timestamp},${rss},${heap},${external}\n`);
      } catch (err: any) {
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
