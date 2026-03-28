import { Injectable } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { SemanticEnhancementEngineInput } from '@scu/shared-types';

/**
 * Stage4 MVP: Semantic Enhancement local truth
 */
@Injectable()
export class SemanticEnhancementLocalAdapter implements EngineAdapter {
  readonly name = 'SemanticEnhancementLocalAdapter';
  readonly mode = 'local';

  supports(engineKey: string): boolean {
    return engineKey === 'semantic_enhancement';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const payload = input.payload as SemanticEnhancementEngineInput;
    const text = payload?.text?.trim() || '';

    if (!text) {
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          message: 'SEMANTIC_ENHANCEMENT_INPUT_MISSING: text is required',
        },
      };
    }

    // Simulate realistic analysis time
    await new Promise((resolve) => setTimeout(resolve, 500));

    const summary = text.length > 50 ? text.substring(0, 47) + '...' : text;

    // Extract pseudo-keywords (simulate NLP)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to']);
    const keywords = Array.from(
      new Set(
        text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stopWords.has(w))
          .sort((a, b) => b.length - a.length) // Longer words might be more interesting
          .slice(0, 8)
      )
    );

    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        summary,
        keywords,
      },
    };
  }
}
