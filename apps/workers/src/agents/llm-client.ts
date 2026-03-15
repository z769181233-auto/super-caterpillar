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
          { role: 'user', parts: [{ text: `System: ${systemPrompt}\n\nUser: ${userPrompt}` }] },
        ],
        generationConfig: {
          temperature,
          responseMimeType: responseFormat === 'json_object' ? 'application/json' : 'text/plain',
        },
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

    if (process.env.LLM_PROVIDER === 'gemini' || userPrompt.length > 20000) {
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
