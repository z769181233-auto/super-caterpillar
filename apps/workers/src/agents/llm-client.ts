import { env } from '@scu/config';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
}

export class LLMClient {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async call(request: LLMRequest): Promise<any> {
    const { systemPrompt, userPrompt, responseFormat = 'json_object', temperature = 0.3 } = request;

    // P6-2-2-3: Mock LLM Support for local development/test
    if (process.env.MOCK_LLM === 'true' || process.env.MOCK_LLM === '1') {
      console.log(`[LLM MOCK] Calling ${this.model} with prompt length: ${userPrompt.length}`);
      if (responseFormat === 'json_object') {
        if (systemPrompt.includes('审核') || systemPrompt.includes('Auditor')) {
          return {
            finalOutput: {
              scenes: [
                {
                  index: 1,
                  title: 'Audited Scene',
                  summary: 'This is an audited scene',
                  shots: [
                    {
                      index: 1,
                      text: 'Character walks in.',
                      summary: 'Entry',
                      characters: ['TestUser'],
                      visualParams: {
                        shotType: 'FULL_SHOT',
                        cameraMovement: 'PAN',
                        lightingPreset: 'NATURAL',
                        emotion: 'NEUTRAL',
                      },
                    },
                  ],
                },
              ],
            },
            auditReport: { isPassed: true, issues: [] },
          };
        }
        if (systemPrompt.includes('导演') || systemPrompt.includes('Director')) {
          return {
            scenes: [
              {
                index: 1,
                title: 'Mocked Scene',
                summary: 'This is a mocked scene from DirectorAgent',
                shots: [
                  {
                    index: 1,
                    text: 'Character walks in.',
                    summary: 'Entry',
                    characters: ['TestUser'],
                    visualParams: {
                      shotType: 'FULL_SHOT',
                      cameraMovement: 'PAN',
                      lightingPreset: 'NATURAL',
                      emotion: 'NEUTRAL',
                    },
                  },
                ],
              },
            ],
          };
        }
        if (systemPrompt.includes('编剧') || systemPrompt.includes('Writer')) {
          return {
            scenes: [
              {
                index: 1,
                title: 'Mocked Scene',
                summary: 'This is a mocked scene from WriterAgent',
                shots: [
                  {
                    index: 1,
                    text: 'Character walks in.',
                    summary: 'Entry',
                    characters: ['TestUser'],
                  },
                ],
              },
            ],
          };
        }
        return { mock: true, note: 'Unknown agent role in mock' };
      }
      return 'Mocked text response';
    }

    if (!this.apiKey) {
      throw new Error('LLM API Key not found');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      if (responseFormat === 'json_object') {
        try {
          return JSON.parse(content);
        } catch (e) {
          console.error('[LLM] Failed to parse JSON response:', content);
          throw new Error('LLM returned invalid JSON');
        }
      }

      return content;
    } catch (e: any) {
      console.error('[LLM] Request error:', e.message);
      throw e;
    }
  }
}

export const defaultLLMClient = new LLMClient();
