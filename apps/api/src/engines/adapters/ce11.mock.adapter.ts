import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';

/**
 * CE11MockAdapter
 * Mock shot generation for Gate 15.
 */
@Injectable()
export class CE11MockAdapter implements EngineAdapter {
  public readonly name = 'ce11_shot_generator_mock';
  private readonly logger = new Logger(CE11MockAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'ce11_shot_generator_mock';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`Invoking CE11 Mock Adapter (API Side) for traceId=${input.payload?.traceId}`);

    return {
      status: 'SUCCESS' as any,
      output: {
        shots: [
          {
            shot_type: 'WIDE_SHOT',
            camera_movement: 'PAN_LEFT',
            camera_angle: 'EYE_LEVEL',
            lighting_preset: 'DRAMATIC',
            visual_prompt: 'A wide shot of a futuristic city under neon lights, pan left.',
            action_description: 'Crowds moving through the streets.',
            dialogue_content: 'No dialogue.',
            sound_fx: 'City hum.',
            duration_sec: 4.0,
            index: 1,
          },
          {
            shot_type: 'CLOSE_UP',
            camera_movement: 'STATIC',
            camera_angle: 'LOW_ANGLE',
            lighting_preset: 'NEON',
            visual_prompt: 'A close up of a cybernetic eye reflecting neon signs.',
            action_description: 'The eye blinks once.',
            dialogue_content: 'Target locked.',
            sound_fx: 'Digital beep.',
            duration_sec: 2.5,
            index: 2,
          },
        ],
        billing_usage: {
          model: 'ce11-mock-v1',
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      },
      metrics: {
        latencyMs: 150,
      },
    };
  }
}
