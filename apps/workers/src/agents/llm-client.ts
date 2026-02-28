import { env } from '@scu/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.warn('[GeminiClient] GEMINI_API_KEY not found');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    });
  }

  async call(request: LLMRequest): Promise<any> {
    const { systemPrompt, userPrompt, responseFormat = 'json_object', temperature = 0.3 } = request;

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `System: ${systemPrompt}\n\nUser: ${userPrompt}` }] }
        ],
        generationConfig: {
          temperature,
          responseMimeType: responseFormat === 'json_object' ? 'application/json' : 'text/plain',
        }
      });

      const response = await result.response;
      const text = response.text();

      if (responseFormat === 'json_object') {
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('[Gemini] Failed to parse JSON:', text);
          const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
          }
          throw e;
        }
      }
      return text;
    } catch (e: any) {
      console.error('[Gemini] Request error:', e.message);
      throw e;
    }
  }
}

export class LLMClient {
  private apiKey: string;
  private model: string;
  private gemini: GeminiClient;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.gemini = new GeminiClient();
  }

  async call(request: LLMRequest): Promise<any> {
    const { systemPrompt, userPrompt, responseFormat = 'json_object', temperature = 0.3 } = request;

    // P6-2-2-3: Mock LLM Support for local development/test
    if (process.env.MOCK_LLM === 'true' || process.env.MOCK_LLM === '1') {
      console.log(`[LLM MOCK] Mocking response for prompt length: ${userPrompt.length}`);
      if (responseFormat === 'json_object') {
        // Broadened match for hardening test
        if (userPrompt.includes('识别并拆分出') || userPrompt.includes('Episode')) {
          return {
            episodes: [
              { index: 1, title: '初露锋芒', summary: '主人公开始觉醒', startChunkIndex: 0, endChunkIndex: 5 },
              { index: 2, title: '大结局', summary: '飞升神界', startChunkIndex: 4105, endChunkIndex: 4105 }
            ]
          };
        }
        if (userPrompt.includes('拆分场景') || userPrompt.includes('Scene')) {
          return {
            scenes: [
              { index: 1, title: '觉醒之夜', location: '主人公卧室', summary: '主角在夜深人静时感受到了魂力。' },
              { index: 2, title: '晨练冲突', location: '家族武场', summary: '主角在晨练时遭到族人嘲讽。' }
            ]
          };
        }
        if (userPrompt.includes('拆解分镜') || userPrompt.includes('Shot')) {
          return {
            shots: [
              { index: 1, content: '张若尘深呼吸', visualDescription: 'Close up' },
              { index: 2, content: '魂力爆发', visualDescription: 'Wide shot' }
            ]
          };
        }
        if (userPrompt.includes('识别他们的“主名”和“别名”')) {
          return {
            characters: [
              { name: '张若尘', description: '《万古神帝》主角', aliases: ['九王子', '尘哥', '太子'] },
              { name: '池瑶', description: '第一女主角', aliases: ['女皇', '池瑶公主'] }
            ]
          };
        }
        if (userPrompt.includes('提取环境资产')) {
          return {
            locations: [{ name: '林府武场', description: '张家子弟晨练的地方' }],
            props: [{ name: '沉渊古剑', description: '主角的神兵' }],
            outfits: [{ name: '锦绣蟒袍', description: '王子的正装' }]
          };
        }
        return { mock: true, note: 'Generic mock response' };
      }
      return 'Mocked text response';
    }

    if (process.env.LLM_PROVIDER === 'gemini' || (userPrompt.length > 20000)) {
      return this.gemini.call(request);
    }

    if (!this.apiKey) {
      return this.gemini.call(request);
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
