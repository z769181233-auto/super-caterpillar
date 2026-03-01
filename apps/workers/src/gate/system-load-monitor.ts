/**
 * B3-2: System Load Monitor
 *
 * 系统负载监控工具，用于采集 Worker 的 CPU、内存等实时指标。
 */

import * as os from 'os';

export interface LoadMetrics {
  cpuUsagePercent: number;
  memoryUsageMb: number;
  totalMemoryMb: number;
  memoryUsagePercent: number;
  uptimeSeconds: number;
}

export class SystemLoadMonitor {
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastMeasureTime: number = 0;

  /**
   * 获取当前系统负载指标
   */
  public async getMetrics(): Promise<LoadMetrics> {
    const totalMemoryMb = os.totalmem() / (1024 * 1024);
    const freeMemoryMb = os.freemem() / (1024 * 1024);
    const usedMemoryMb = totalMemoryMb - freeMemoryMb;
    const memoryUsagePercent = (usedMemoryMb / totalMemoryMb) * 100;

    const cpuUsagePercent = await this.measureCpuUsage();

    return {
      cpuUsagePercent: Math.round(cpuUsagePercent * 100) / 100,
      memoryUsageMb: Math.round(usedMemoryMb),
      totalMemoryMb: Math.round(totalMemoryMb),
      memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      uptimeSeconds: process.uptime(),
    };
  }

  /**
   * 测量 CPU 使用率
   * 需要两次采样才能计算增量
   */
  private async measureCpuUsage(): Promise<number> {
    const currentUsage = process.cpuUsage();
    const currentTime = Date.now();

    if (!this.lastCpuUsage || !this.lastMeasureTime) {
      // 首次采样，无法计算
      this.lastCpuUsage = currentUsage;
      this.lastMeasureTime = currentTime;
      return 0;
    }

    const elapsedMs = currentTime - this.lastMeasureTime;
    const elapsedUs = elapsedMs * 1000;

    const userDelta = currentUsage.user - this.lastCpuUsage.user;
    const systemDelta = currentUsage.system - this.lastCpuUsage.system;
    const totalDelta = userDelta + systemDelta;

    // CPU 使用率 = (CPU 时间增量 / 实际时间增量) * 100
    // 注意：totalDelta 单位为微秒
    const cpuPercent = (totalDelta / elapsedUs) * 100;

    this.lastCpuUsage = currentUsage;
    this.lastMeasureTime = currentTime;

    return Math.min(cpuPercent, 100); // 限制在 0-100
  }

  /**
   * 获取进程内存使用情况
   */
  public getProcessMemory(): { rss: number; heapUsed: number; heapTotal: number } {
    const mem = process.memoryUsage();
    return {
      rss: Math.round(mem.rss / (1024 * 1024)), // MB
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
    };
  }
}
