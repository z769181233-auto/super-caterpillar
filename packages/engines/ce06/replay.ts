import * as fs from 'fs';
import * as path from 'path';
import type { CE06Input, CE06Output, EngineBillingUsage } from './types';

/**
 * CE06 Replay Engine
 * Provides deterministic simulation of LLM parsing using local fixtures.
 *
 * Stage-3-B: 强制返回 billing_usage（mock 数据）
 */

/**
 * 粗略估算 Token 数量（基于字符数）
 * 经验值：中文约 2 chars ~= 1 token，英文约 4 chars ~= 1 token
 */
function roughTokensByChars(text: string): number {
  if (!text) return 1;
  // 保守估计：3 chars = 1 token
  return Math.max(1, Math.ceil(text.length / 3));
}

export async function ce06ReplayEngine(input: CE06Input): Promise<CE06Output> {
  const start = Date.now();

  // 1. 加载 Fixture
  const fixtureDir = path.join(process.cwd(), 'fixtures/ce06');
  let fixturePath = path.join(fixtureDir, 'sample.json');

  const projectId = input.projectId || (input as any).context?.projectId;
  if (projectId) {
    const projectFixture = path.join(fixtureDir, `${projectId}.json`);
    if (fs.existsSync(projectFixture)) {
      fixturePath = projectFixture;
    }
  }

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`CE06 REPLAY: Fixture not found at ${fixturePath}`);
  }

  // 2. 解析 Fixture 数据
  const content = fs.readFileSync(fixturePath, 'utf-8');
  const fixtureData = JSON.parse(content);

  // 3. 生成 Mock 计费数据（确定性）
  const inputText = input.structured_text || input.rawText || input.raw_text || '';
  const promptTokens = roughTokensByChars(inputText);
  const completionTokens = 500; // 固定值，门禁稳定

  const billingUsage: EngineBillingUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    model: 'ce06-replay-mock', // 价格表 key
  };

  // 4. 构造输出（包含 billing_usage）
  const result: CE06Output = {
    volumes: fixtureData.volumes || [],
    chapters: fixtureData.chapters || [],
    scenes: fixtureData.scenes || [],
    parsing_quality: 0.95,
    audit_trail: {
      engine_version: 'replay-v1.0',
      timestamp: new Date().toISOString(),
      input_hash: inputText.substring(0, 16), // 简化
    },
    billing_usage: billingUsage, // ⚠️ 强制返回
  };

  return result;
}
