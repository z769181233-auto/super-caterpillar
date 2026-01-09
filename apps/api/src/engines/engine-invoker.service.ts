import { Injectable } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';

interface InvokeParams {
  adapter: EngineAdapter;
  input: EngineInvokeInput;
  engineKey: string;
}

/**
 * EngineInvokerService
 * - 负责统一的调用封装，不做路由与配置策略
 * - 保持 EngineSpec 字段与封板逻辑不变
 */
@Injectable()
export class EngineInvokerService {
  async invoke({ adapter, input, engineKey }: InvokeParams): Promise<EngineInvokeResult> {
    const nextInput: EngineInvokeInput = {
      ...input,
      engineKey,
      payload: { ...(input.payload || {}) },
      context: { ...(input.context || {}) },
    };
    return adapter.invoke(nextInput);
  }
}
