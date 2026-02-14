import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';

interface InvokeParams {
  adapter: EngineAdapter;
  input: EngineInvokeInput;
  engineKey: string;
}

interface CircuitState {
  errors: number;
  status: 'OPEN' | 'CLOSED';
  lastErrorTime: number;
}

/**
 * EngineInvokerService
 * - 负责统一的调用封装
 * - [A2] 实施熔断器逻辑，防止外部 Provider 故障导致雪崩
 */
@Injectable()
export class EngineInvokerService {
  private readonly logger = new Logger(EngineInvokerService.name);
  private readonly circuitBreaker = new Map<string, CircuitState>();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT_MS = 300000; // 5 minutes

  async invoke({ adapter, input, engineKey }: InvokeParams): Promise<EngineInvokeResult> {
    const state = this.getCircuitState(engineKey);

    // 1. 检查熔断状态
    if (state.status === 'OPEN') {
      const now = Date.now();
      if (now - state.lastErrorTime > this.RECOVERY_TIMEOUT_MS) {
        // 进入 HALF-OPEN (尝试一次)
        this.logger.log(`[CircuitBreaker] Engine ${engineKey} enters HALF-OPEN`);
      } else {
        throw new ServiceUnavailableException(
          `Engine ${engineKey} is currently circuited (OPEN) due to repeated failures.`
        );
      }
    }

    const nextInput: EngineInvokeInput = {
      ...input,
      engineKey,
      payload: { ...(input.payload || {}) },
      context: { ...(input.context || {}) },
    };

    try {
      const result = await adapter.invoke(nextInput);
      this.resetCircuit(engineKey);
      return result;
    } catch (e) {
      this.recordFailure(engineKey);
      throw e;
    }
  }

  private getCircuitState(engineKey: string): CircuitState {
    if (!this.circuitBreaker.has(engineKey)) {
      this.circuitBreaker.set(engineKey, { errors: 0, status: 'CLOSED', lastErrorTime: 0 });
    }
    return this.circuitBreaker.get(engineKey)!;
  }

  private recordFailure(engineKey: string) {
    const state = this.getCircuitState(engineKey);
    state.errors++;
    state.lastErrorTime = Date.now();

    if (state.errors >= this.FAILURE_THRESHOLD) {
      state.status = 'OPEN';
      this.logger.error(
        `[CircuitBreaker] Engine ${engineKey} is now OPEN. Threshold reached: ${state.errors}`
      );
    }
  }

  private resetCircuit(engineKey: string) {
    const state = this.getCircuitState(engineKey);
    if (state.status !== 'CLOSED') {
      this.logger.log(`[CircuitBreaker] Engine ${engineKey} recovered to CLOSED`);
    }
    state.errors = 0;
    state.status = 'CLOSED';
    state.lastErrorTime = 0;
  }
}
