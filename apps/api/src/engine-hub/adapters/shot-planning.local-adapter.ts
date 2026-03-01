import { Injectable } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { ShotPlanningEngineInput } from '@scu/shared-types';

/**
 * Stage4 MVP: Shot Planning local stub
 */
@Injectable()
export class ShotPlanningLocalAdapter implements EngineAdapter {
  readonly name = 'ShotPlanningLocalAdapter';
  readonly mode = 'local';

  supports(engineKey: string): boolean {
    return engineKey === 'shot_planning';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const payload = input.payload as ShotPlanningEngineInput;
    void payload;
    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        shotType: { primary: 'medium', confidence: 0.5 },
        movement: { primary: 'static', confidence: 0.5 },
      },
    };
  }
}
