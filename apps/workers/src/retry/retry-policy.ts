import { env } from '@scu/config';

/**
 * RetryPolicy
 * 提供统一的指数退避重试策略。
 * 参考 P1-1 要求：指数退避 + 上限 + 抖动。
 */
export class RetryPolicy {
  /**
   * 获取下一次重试前的延迟时间（毫秒）
   * @param attempt 当前已失败的尝试次数（1-indexed）
   */
  static getDelay(attempt: number): number {
    const config = env as any;
    if (!config.retryPolicyEnabled) return 0;

    const baseDelay = config.retryBaseMs || 500;
    let delay = baseDelay * Math.pow(2, attempt);

    // Jitter
    if (config.retryJitter !== false) {
      const jitterFactor = 0.5 + Math.random();
      delay = delay * jitterFactor;
    }

    // 限制最大延迟
    return Math.min(delay, config.retryMaxMs);
  }

  /**
   * 判断是否应该重试
   * @param attempt 当前已失败的尝试次数
   */
  static shouldRetry(attempt: number): boolean {
    const config = env as any;
    if (!config.retryPolicyEnabled) return false;
    return attempt < (config.retryMaxAttempts || 3);
  }
}
