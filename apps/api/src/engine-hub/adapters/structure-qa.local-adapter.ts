import { Injectable } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult, EngineInvokeStatus } from '@scu/shared-types';
import { StructureQAEngineInput } from '@scu/shared-types';

/**
 * Stage4 MVP: Structure QA local stub
 */
@Injectable()
export class StructureQALocalAdapter
  implements EngineAdapter
{
  readonly name = 'StructureQALocalAdapter';
  readonly mode = 'local';

  supports(engineKey: string): boolean {
    return engineKey === 'structure_qa';
  }

  async invoke(
    input: EngineInvokeInput,
  ): Promise<EngineInvokeResult> {
    const payload = input.payload as StructureQAEngineInput;
    void payload;
    // Stub: return fixed score and empty issues
    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        overallScore: 0.85,
        issues: [],
      },
    };
  }
}

