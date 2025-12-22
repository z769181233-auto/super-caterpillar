/**
 * 容量相关错误码
 * 用于前端显示友好的错误提示
 */
export enum CapacityErrorCode {
  CAPACITY_EXCEEDED_CONCURRENT = 'CAPACITY_EXCEEDED_CONCURRENT',
  CAPACITY_EXCEEDED_QUEUE = 'CAPACITY_EXCEEDED_QUEUE',
  CAPACITY_EXCEEDED_TOTAL_QUEUE = 'CAPACITY_EXCEEDED_TOTAL_QUEUE',
  CAPACITY_EXCEEDED_USER_CONCURRENT = 'CAPACITY_EXCEEDED_USER_CONCURRENT',
}

export const CapacityErrorMessages: Record<CapacityErrorCode, string> = {
  [CapacityErrorCode.CAPACITY_EXCEEDED_CONCURRENT]:
    '当前并发渲染任务已达上限，请等待部分任务完成后再试',
  [CapacityErrorCode.CAPACITY_EXCEEDED_QUEUE]:
    '渲染队列积压过多，请稍后再试',
  [CapacityErrorCode.CAPACITY_EXCEEDED_TOTAL_QUEUE]:
    '系统队列繁忙，请稍后再试',
  [CapacityErrorCode.CAPACITY_EXCEEDED_USER_CONCURRENT]:
    '您的并发渲染任务已达上限，请等待部分任务完成后再试',
};

export class CapacityExceededException extends Error {
  constructor(
    public readonly errorCode: CapacityErrorCode,
    public readonly currentCount: number,
    public readonly limit: number,
    message?: string,
  ) {
    super(message || CapacityErrorMessages[errorCode]);
    this.name = 'CapacityExceededException';
  }
}

