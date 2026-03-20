/**
 * P2.2-Final 稳定性抽检脚本（v3 — 最终封板版）
 *
 * v3 vs v2 修复清单：
 * 1. 失败 run 不再被吞掉：ProbeRun union type，失败率计入一致率（incomplete scene 直接 0）
 * 2. canonicalJson 改为递归深排序（不只是顶层 key 排序）
 * 3. avg_shot_length json_schema 增加 minimum:0.5 / maximum:60 真正约束
 * 4. finalDecision 改为 PROBE_PASS / PROBE_FAIL（不越权宣布 ENTER_P3）
 *
 * 用法：
 *   OPENAI_API_KEY=sk-xxx \
 *   DATABASE_URL=postgresql://... \
 *   ts-node -r tsconfig-paths/register \
 *     apps/api/src/scripts/film-ir-stability-probe.ts
 *
 * 可选环境变量：
 *   MODEL=gpt-4o-mini           (默认)
 *   RUNS_PER_SCENE=3            (默认)
 *   SCENE_LIMIT=10              (默认)
 *   CONSISTENCY_THRESHOLD=85    (百分比，默认)
 *   NUMERIC_RANGE_THRESHOLD=1.5 (秒，avg_shot_length容差，默认)
 *
 * 输出：docs/film-ir/
 *   planner_stability_probe.md
 *   shotplanner_reliable_input_fields.md
 *   planner_stability_raw_summary.json
 *
 * 安全：OPENAI_API_KEY 只从环境变量读取，绝不出现在日志或报告中。
 */


import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => PgClient };

interface PgClient {
  connect(): Promise<void>;
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}


// ==================================================================
// 配置
// ==================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const MODEL = process.env.MODEL ?? 'gpt-4o-mini';
const RUNS_PER_SCENE = parseInt(process.env.RUNS_PER_SCENE ?? '3', 10);
const SCENE_LIMIT = parseInt(process.env.SCENE_LIMIT ?? '10', 10);
const CONSISTENCY_THRESHOLD = parseInt(process.env.CONSISTENCY_THRESHOLD ?? '85', 10);
const NUMERIC_RANGE_THRESHOLD = parseFloat(process.env.NUMERIC_RANGE_THRESHOLD ?? '1.5');

const DOCS_DIR = path.resolve(__dirname, '../../../../docs/film-ir');

if (!OPENAI_API_KEY) {
  console.error('[PROBE] 错误: 请设置 OPENAI_API_KEY 环境变量（不要在终端中明文显示）');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('[PROBE] 错误: 请设置 DATABASE_URL 环境变量');
  process.exit(1);
}

// ==================================================================
// 枚举定义（与 Validator strict 口径一致）
// ==================================================================

const VALID_DRAMATIC_FUNCTIONS = [
  'CONFLICT', 'REVELATION', 'TENSION_BUILD', 'RESOLUTION',
  'SETUP', 'TURNING_POINT', 'CHARACTER_DEVELOPMENT', 'EXPOSITION',
] as const;

const VALID_SHOT_PATTERNS = [
  'CLOSE_UP_DOMINANT', 'WIDE_ESTABLISH', 'PARALLEL_EDIT',
  'POV_SUBJECTIVE', 'MONTAGE', 'LONG_TAKE', 'MIXED',
] as const;

const VALID_CAMERA_MOTIONS = [
  'STATIC', 'HANDHELD', 'SMOOTH_CRANE', 'TRACKING', 'DOLLY', 'AERIAL', 'MIXED',
] as const;

const VALID_LIGHTING_STYLES = [
  'HIGH_KEY', 'LOW_KEY', 'CHIAROSCURO', 'NATURAL', 'MOTIVATED', 'DOCUMENTARY',
] as const;

const VALID_AUDIENCE_INFO_MODES = [
  'DRAMATIC_IRONY', 'SUSPENSE', 'MYSTERY', 'OMNISCIENT', 'LIMITED_POV',
] as const;

// ==================================================================
// P3 字段分级
// ==================================================================

const BLOCKING_FIELDS = [
  'dramatic_function', 'dramatic_goal', 'emotional_target',
  'visual_strategy', 'blocking_strategy',
  'shot_pattern', 'avg_shot_length', 'camera_motion_style',
  'composition_style', 'lighting_style', 'color_strategy', 'sound_strategy',
] as const;

const ADVISORY_FIELDS = ['audience_information_mode', 'pov_character'] as const;
const FUTURE_FIELDS = ['continuity_constraints'] as const;

type BlockingField = typeof BLOCKING_FIELDS[number];
type ProbeField = typeof BLOCKING_FIELDS[number] | typeof ADVISORY_FIELDS[number] | typeof FUTURE_FIELDS[number];

// ==================================================================
// ProbeRun：完整记录每次尝试（包括失败）
// 修复 #1：失败 run 不再被吞掉
// ==================================================================

interface DirectorOutput {
  dramatic_function?: string;
  dramatic_goal?: string;
  emotional_target?: string;
  pov_character?: string | null;
  audience_information_mode?: string | null;
  visual_strategy?: string;
  blocking_strategy?: string;
  shot_pattern?: string;
  avg_shot_length?: number;
  camera_motion_style?: string;
  composition_style?: string;
  lighting_style?: string;
  color_strategy?: string;
  sound_strategy?: string;
  continuity_constraints?: object;
  why_this_choice?: string;
  alternative_rejected_reason?: string;
}

type ProbeRun =
  | { ok: true; output: DirectorOutput; latencyMs: number; promptTokens: number; completionTokens: number }
  | { ok: false; errorMessage: string };

/** 从 ProbeRun[] 中提取成功输出列表 */
function successfulOutputs(runs: ProbeRun[]): DirectorOutput[] {
  return runs.filter((r): r is Extract<ProbeRun, { ok: true }> => r.ok).map(r => r.output);
}

/** scene 是否完整（全部 run 都成功） */
function isSceneComplete(runs: ProbeRun[]): boolean {
  return runs.length === RUNS_PER_SCENE && runs.every(r => r.ok);
}

// ==================================================================
// 修复 #2：深度递归 canonical JSON
// ==================================================================

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }

  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// ==================================================================
// OpenAI 调用（json_schema / strict=true）
// 修复 #3：avg_shot_length 增加 minimum/maximum 真正约束
// ==================================================================

const FILM_IR_JSON_SCHEMA = {
  name: 'film_ir_draft',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      dramatic_function: {
        type: 'string',
        enum: [...VALID_DRAMATIC_FUNCTIONS],
        description: '场景戏剧功能枚举',
      },
      dramatic_goal: { type: 'string', description: '场景核心戏剧目标' },
      emotional_target: { type: 'string', description: '观众应感受的情绪体验' },
      pov_character: { type: ['string', 'null'], description: '主视角角色名，无明确POV时为null' },
      audience_information_mode: {
        type: ['string', 'null'],
        enum: [...VALID_AUDIENCE_INFO_MODES, null],
        description: '观众信息模式',
      },
      visual_strategy: { type: 'string', description: '视觉策略描述' },
      blocking_strategy: { type: 'string', description: '演员调度策略' },
      shot_pattern: {
        type: 'string',
        enum: [...VALID_SHOT_PATTERNS],
        description: '镜头模式',
      },
      // 修复 #3：真正的数值约束
      avg_shot_length: {
        type: 'number',
        minimum: 0.5,
        maximum: 60,
        description: '平均镜头时长（秒），0.5~60之间',
      },
      camera_motion_style: {
        type: 'string',
        enum: [...VALID_CAMERA_MOTIONS],
        description: '摄影机运动方式',
      },
      composition_style: { type: 'string', description: '构图风格' },
      lighting_style: {
        type: 'string',
        enum: [...VALID_LIGHTING_STYLES],
        description: '灯光风格',
      },
      color_strategy: { type: 'string', description: '色彩策略' },
      sound_strategy: { type: 'string', description: '声音设计策略' },
      continuity_constraints: {
        type: 'object',
        description: '连续性约束，可为空对象',
        additionalProperties: true,
      },
      why_this_choice: { type: 'string', description: '决策溯源' },
      alternative_rejected_reason: { type: 'string', description: '被拒绝方案及原因' },
    },
    required: [
      'dramatic_function', 'dramatic_goal', 'emotional_target',
      'pov_character', 'audience_information_mode',
      'visual_strategy', 'blocking_strategy', 'shot_pattern',
      'avg_shot_length', 'camera_motion_style', 'composition_style',
      'lighting_style', 'color_strategy', 'sound_strategy',
      'continuity_constraints', 'why_this_choice', 'alternative_rejected_reason',
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `你是一位经验丰富的电影导演，为剧本场景设计导演意图与视觉规划。
请严格按 JSON Schema 输出，所有枚举字段使用指定枚举值，avg_shot_length 必须在 0.5~60 之间。`;

async function callOpenAI(sceneText: string, attempt = 0): Promise<ProbeRun> {
  const start = Date.now();
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `【场景原文】\n${sceneText.slice(0, 2000)}\n\n请严格按 schema 输出完整导演规划JSON。`,
          },
        ],
        response_format: { type: 'json_schema', json_schema: FILM_IR_JSON_SCHEMA },
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      return { ok: false, errorMessage: 'OpenAI 返回空响应 (content=null or empty)' };
    }

    const output = JSON.parse(content) as DirectorOutput;
    return {
      ok: true,
      output,
      latencyMs: Date.now() - start,
      promptTokens: response.data?.usage?.prompt_tokens ?? 0,
      completionTokens: response.data?.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 429 && attempt < 2) {
      const retryAfter = Number(axiosErr.response?.headers?.['retry-after'] ?? 10);
      console.log(`    限流(429) → ${retryAfter}s 后重试...`);
      await sleep(retryAfter * 1000);
      return callOpenAI(sceneText, attempt + 1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errorMessage: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ==================================================================
// 稳定性分析（per-scene，incomplete scene blocking字段记0）
// ==================================================================

type FieldKind = 'enum' | 'numeric' | 'text' | 'object';

interface FieldDef {
  field: keyof DirectorOutput;
  kind: FieldKind;
  validValues?: readonly string[];
  rangeThreshold?: number;
}

const FIELD_DEFS: FieldDef[] = [
  { field: 'dramatic_function',         kind: 'enum',    validValues: VALID_DRAMATIC_FUNCTIONS },
  { field: 'shot_pattern',              kind: 'enum',    validValues: VALID_SHOT_PATTERNS },
  { field: 'camera_motion_style',       kind: 'enum',    validValues: VALID_CAMERA_MOTIONS },
  { field: 'lighting_style',            kind: 'enum',    validValues: VALID_LIGHTING_STYLES },
  { field: 'audience_information_mode', kind: 'enum',    validValues: VALID_AUDIENCE_INFO_MODES },
  { field: 'dramatic_goal',             kind: 'text'  },
  { field: 'emotional_target',          kind: 'text'  },
  { field: 'visual_strategy',           kind: 'text'  },
  { field: 'blocking_strategy',         kind: 'text'  },
  { field: 'composition_style',         kind: 'text'  },
  { field: 'color_strategy',            kind: 'text'  },
  { field: 'sound_strategy',            kind: 'text'  },
  { field: 'pov_character',             kind: 'text'  },
  { field: 'avg_shot_length',           kind: 'numeric', rangeThreshold: NUMERIC_RANGE_THRESHOLD },
  { field: 'continuity_constraints',    kind: 'object' },
];

interface SceneFieldResult {
  consistencyRate: number;    // 0~100
  hasInvalidEnum: boolean;
  range?: number;             // 仅数值字段
  stddevVal?: number;
  incomplete: boolean;        // 该 scene 此字段因 incomplete 被强制为 0
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length);
}

/** 对单 scene 的 runs 分析指定字段稳定性 */
function analyzeSceneField(
  runs: ProbeRun[],
  def: FieldDef,
  tier: 'blocking' | 'advisory' | 'future',
): SceneFieldResult {
  const complete = isSceneComplete(runs);
  const outputs = successfulOutputs(runs);

  // 修复 #1 核心：blocking 字段，incomplete scene 直接记 0
  if (!complete && tier === 'blocking') {
    return { consistencyRate: 0, hasInvalidEnum: false, incomplete: true };
  }

  if (outputs.length === 0) {
    return { consistencyRate: 0, hasInvalidEnum: false, incomplete: !complete };
  }

  if (def.kind === 'numeric') {
    const nums = outputs.map(o => o[def.field]).filter(v => typeof v === 'number') as number[];
    if (nums.length === 0) return { consistencyRate: 0, hasInvalidEnum: false, range: Infinity, stddevVal: Infinity, incomplete: !complete };
    const range = Math.max(...nums) - Math.min(...nums);
    const sv = stddev(nums);
    const threshold = def.rangeThreshold ?? NUMERIC_RANGE_THRESHOLD;
    const stable = range <= threshold;
    return {
      consistencyRate: stable ? 100 : Math.max(0, Math.round((1 - range / (threshold * 4)) * 100)),
      hasInvalidEnum: false,
      range,
      stddevVal: Math.round(sv * 100) / 100,
      incomplete: !complete,
    };
  }

  if (def.kind === 'object') {
    const serialized = outputs.map(o => {
      const v = o[def.field];
      return (v !== null && v !== undefined && typeof v === 'object') ? canonicalJson(v) : 'null';
    });
    const freq: Record<string, number> = {};
    for (const s of serialized) freq[s] = (freq[s] ?? 0) + 1;
    const dominant = Math.max(...Object.values(freq));
    return {
      consistencyRate: Math.round((dominant / serialized.length) * 100),
      hasInvalidEnum: false,
      incomplete: !complete,
    };
  }

  // enum / text
  const strVals = outputs.map(o => {
    const v = o[def.field];
    return (v === null || v === undefined) ? 'null' : String(v);
  });
  const freq: Record<string, number> = {};
  for (const s of strVals) freq[s] = (freq[s] ?? 0) + 1;
  const dominant = Math.max(...Object.values(freq));
  const consistencyRate = Math.round((dominant / strVals.length) * 100);

  let hasInvalidEnum = false;
  if (def.kind === 'enum' && def.validValues) {
    hasInvalidEnum = strVals.some(v => v !== 'null' && !(def.validValues as readonly string[]).includes(v));
  }

  return { consistencyRate, hasInvalidEnum, incomplete: !complete };
}

// ==================================================================
// 聚合统计
// ==================================================================

interface AggregateFieldStats {
  fieldName: string;
  tier: 'blocking' | 'advisory' | 'future';
  avgConsistencyRate: number;
  medianConsistencyRate: number;
  p90ConsistencyRate: number;
  failSceneCount: number;
  incompleteSceneCount: number;
  totalScenes: number;
  passRate: number;
  invalidEnumScenes: number;
  numericRangeInfo?: { minRange: number; maxRange: number; avgRange: number; avgStddev: number };
  isStable: boolean;
}

function getTier(fieldName: string): 'blocking' | 'advisory' | 'future' {
  if ((BLOCKING_FIELDS as readonly string[]).includes(fieldName)) return 'blocking';
  if ((ADVISORY_FIELDS as readonly string[]).includes(fieldName)) return 'advisory';
  return 'future';
}

function aggregateField(
  fieldName: string,
  perSceneResults: SceneFieldResult[],
): AggregateFieldStats {
  const tier = getTier(fieldName);
  const rates = perSceneResults.map(r => r.consistencyRate);
  const sorted = [...rates].sort((a, b) => a - b);

  const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1];
  const failCount = rates.filter(r => r < CONSISTENCY_THRESHOLD).length;
  const incompleteCount = perSceneResults.filter(r => r.incomplete).length;
  const totalScenes = perSceneResults.length;
  const passRate = Math.round(((totalScenes - failCount) / totalScenes) * 100);
  const invalidEnumScenes = perSceneResults.filter(r => r.hasInvalidEnum).length;

  const numericRanges = perSceneResults
    .map(r => r.range)
    .filter((r): r is number => r !== undefined && isFinite(r));

  const numericStddevs = perSceneResults
    .map(r => r.stddevVal)
    .filter((r): r is number => r !== undefined && isFinite(r));

  // blocking 字段：avgConsistencyRate 达标 + failScene 不超过 15%
  const isStable = avg >= CONSISTENCY_THRESHOLD && failCount <= Math.ceil(totalScenes * 0.15);

  return {
    fieldName,
    tier,
    avgConsistencyRate: avg,
    medianConsistencyRate: median,
    p90ConsistencyRate: p90,
    failSceneCount: failCount,
    incompleteSceneCount: incompleteCount,
    totalScenes,
    passRate,
    invalidEnumScenes,
    ...(numericRanges.length > 0 && {
      numericRangeInfo: {
        minRange: Math.round(Math.min(...numericRanges) * 10) / 10,
        maxRange: Math.round(Math.max(...numericRanges) * 10) / 10,
        avgRange: Math.round(numericRanges.reduce((a, b) => a + b, 0) / numericRanges.length * 10) / 10,
        avgStddev: Math.round(numericStddevs.reduce((a, b) => a + b, 0) / numericStddevs.length * 100) / 100,
      },
    }),
    isStable,
  };
}

// ==================================================================
// 主流程
// ==================================================================

async function main() {
  console.log(`\n[PROBE v3] P2.2-Final 稳定性抽检`);
  console.log(`[PROBE] model=${MODEL} | scene=${SCENE_LIMIT} | runs=${RUNS_PER_SCENE} | threshold=${CONSISTENCY_THRESHOLD}% | numericTolerance=${NUMERIC_RANGE_THRESHOLD}s`);
  console.log(`[PROBE] output_format=json_schema/strict | blocking_fields=${BLOCKING_FIELDS.length}`);

  const client = new Client({ connectionString: DATABASE_URL as string });
  let scenes: Array<{ id: string; enrichedText: string | null }> = [];
  try {
    await client.connect();
    const result = await client.query<{ id: string; enriched_text: string | null }>(
      `SELECT id, enriched_text
       FROM scenes
       WHERE enriched_text IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [SCENE_LIMIT],
    );

    scenes = result.rows.map(r => ({ id: r.id, enrichedText: r.enriched_text }));
    console.log(`[PROBE] 找到 ${scenes.length} 个 Scene`);
  } catch (err) {
    console.error('[PROBE] 查询 Scene 失败:', err);
    await client.end();
    process.exit(1);
  }
  await client.end();

  if (scenes.length === 0) {
    console.error('[PROBE] 没有可用场景，请先导入有 enrichedText 的 Scene');
    process.exit(1);
  }

  // ==================================================================
  // 按 scene 执行规划，完整记录每次尝试
  // ==================================================================

  const perSceneStore: Array<{
    sceneId: string;
    runs: ProbeRun[];
    expectedRuns: number;
    successfulRuns: number;
    failedRuns: number;
    complete: boolean;
  }> = [];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalLatencyMs = 0;
  let globalFailedRuns = 0;

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const sceneText = scene.enrichedText ?? '';
    console.log(`\n[PROBE] Scene ${si + 1}/${scenes.length} id=${scene.id.slice(0, 16)} len=${sceneText.length}`);

    const runs: ProbeRun[] = [];

    for (let run = 1; run <= RUNS_PER_SCENE; run++) {
      process.stdout.write(`  run ${run}/${RUNS_PER_SCENE} ... `);
      const result = await callOpenAI(sceneText);
      runs.push(result);  // 修复 #1：每次都 push，无论成功失败

      if (result.ok) {
        totalPromptTokens += result.promptTokens;
        totalCompletionTokens += result.completionTokens;
        totalLatencyMs += result.latencyMs;
        console.log(`✓ ${result.latencyMs}ms fn=${result.output.dramatic_function} shot=${result.output.shot_pattern}`);
      } else {
        const failedRun = result as Extract<ProbeRun, { ok: false }>;
        globalFailedRuns++;
        console.log(`✗ FAILED: ${failedRun.errorMessage}`);
      }


      if (run < RUNS_PER_SCENE) await sleep(1200);
    }


    const successCount = runs.filter(r => r.ok).length;
    const failCount = runs.filter(r => !r.ok).length;

    perSceneStore.push({
      sceneId: scene.id,
      runs,
      expectedRuns: RUNS_PER_SCENE,
      successfulRuns: successCount,
      failedRuns: failCount,
      complete: isSceneComplete(runs),
    });
  }

  const incompleteScenes = perSceneStore.filter(s => !s.complete);

  // ==================================================================
  // 字段稳定性分析（per-scene → 聚合）
  // ==================================================================

  const fieldStats: AggregateFieldStats[] = FIELD_DEFS.map(def => {
    const tier = getTier(String(def.field));
    const perScene = perSceneStore.map(s =>
      analyzeSceneField(s.runs, def, tier as 'blocking' | 'advisory' | 'future'),
    );
    return aggregateField(String(def.field), perScene);
  });

  // ==================================================================
  // 修复 #4：P3 放行裁决（probe 范围，不越权）
  // ==================================================================

  const blockingFailed = fieldStats.filter(f => f.tier === 'blocking' && !f.isStable);
  const advisoryWarnings = fieldStats.filter(f => f.tier === 'advisory' && !f.isStable);

  // probe 只能表达"probe 是否通过"，不宣布"ENTER_P3"
  const probeVerdict: 'PROBE_PASS' | 'PROBE_FAIL' =
    blockingFailed.length === 0 ? 'PROBE_PASS' : 'PROBE_FAIL';

  // 如果有 incomplete scenes 且 blocking 字段受影响，也降级
  const probeCompleteness =
    incompleteScenes.length === 0 ? 'COMPLETE' :
    incompleteScenes.length < Math.ceil(scenes.length * 0.2) ? 'MOSTLY_COMPLETE' : 'INCOMPLETE';

  // ==================================================================
  // 报告输出（planner_stability_probe.md）
  // ==================================================================

  const now = new Date().toISOString().slice(0, 10);

  let probeReport = `# Planner 稳定性抽检报告（v3）

> **日期**：${now}
> **Provider**：openai / ${MODEL} | json_schema/strict=true | minimum:0.5 maximum:60
> **样本**：${scenes.length} 场景 × ${RUNS_PER_SCENE} 次 = ${scenes.length * RUNS_PER_SCENE} 次规划
> **失败次数**：${globalFailedRuns}（Incomplete Scenes: ${incompleteScenes.length}）
> **完整度**：${probeCompleteness}
> **一致率阈值**：${CONSISTENCY_THRESHOLD}%（blocking 字段）
> **数值容差**：avg_shot_length range ≤ ${NUMERIC_RANGE_THRESHOLD}s
> **Token**：prompt=${totalPromptTokens} completion=${totalCompletionTokens}
> **Probe 裁决**：${probeVerdict === 'PROBE_PASS' ? '✅ PROBE_PASS' : '❌ PROBE_FAIL'}
>
> ⚠️ **注意**：PROBE_PASS 表示"稳定性抽检通过"。最终 P3 放行还需同时满足 CI smoke tests pass。

---

## Blocking 字段（P3 必须稳定，一致率 ≥ ${CONSISTENCY_THRESHOLD}%）

| 字段 | 平均一致率 | 中位数 | P90 | 枚举非法 | Fail Scene | Incomplete | 达标 |
|------|----------|--------|-----|---------|-----------|-----------|------|
`;

  for (const f of fieldStats.filter(s => s.tier === 'blocking')) {
    const icon = f.isStable ? '✅' : '❌';
    const numInfo = f.numericRangeInfo
      ? ` (avgRange=${f.numericRangeInfo.avgRange}s stddev=${f.numericRangeInfo.avgStddev})`
      : '';
    probeReport += `| \`${f.fieldName}\`${numInfo} | ${f.avgConsistencyRate}% | ${f.medianConsistencyRate}% | ${f.p90ConsistencyRate}% | ${f.invalidEnumScenes}/${f.totalScenes} | ${f.failSceneCount}/${f.totalScenes} | ${f.incompleteSceneCount} | ${icon} |\n`;
  }

  probeReport += `\n## Advisory 字段（记录但不阻断 P3）\n\n| 字段 | 平均一致率 | Fail | 状态 |\n|------|----------|------|------|\n`;
  for (const f of fieldStats.filter(s => s.tier === 'advisory')) {
    probeReport += `| \`${f.fieldName}\` | ${f.avgConsistencyRate}% | ${f.failSceneCount}/${f.totalScenes} | ${f.isStable ? '✅' : '⚠️ 漂移'} |\n`;
  }

  probeReport += `\n## Future 字段（暂不用于 P3）\n\n| 字段 | 平均一致率 | 备注 |\n|------|----------|------|\n`;
  for (const f of fieldStats.filter(s => s.tier === 'future')) {
    probeReport += `| \`${f.fieldName}\` | ${f.avgConsistencyRate}% | 待 P4 ConsistencyEngine 后升级 |\n`;
  }

  if (incompleteScenes.length > 0) {
    probeReport += `\n## Incomplete Scene 明细\n\n| sceneId | expectedRuns | successfulRuns | failedRuns |\n|---------|------------|--------------|----------|\n`;
    for (const s of incompleteScenes) {
      probeReport += `| \`${s.sceneId.slice(0, 20)}...\` | ${s.expectedRuns} | ${s.successfulRuns} | ${s.failedRuns} |\n`;
    }
  }

  probeReport += `\n---\n\n## Probe 裁决\n\n`;
  if (probeVerdict === 'PROBE_PASS') {
    probeReport += `### ✅ PROBE_PASS\n\n所有 **${BLOCKING_FIELDS.length}** 个 blocking 字段达到 ${CONSISTENCY_THRESHOLD}% 一致率要求。\n\n`;
    if (advisoryWarnings.length > 0) {
      probeReport += `> ⚠️ Advisory 字段有漂移（${advisoryWarnings.map(f => f.fieldName).join(', ')}），P3 第一期不依赖这些字段。\n\n`;
    }
    probeReport += `**下一步**：需同时满足 CI smoke tests PASS，才可宣布 P2.2-Final 封板并进入 P3。\n`;
  } else {
    probeReport += `### ❌ PROBE_FAIL\n\n以下 **${blockingFailed.length}** 个 blocking 字段未达标：\n\n`;
    for (const f of blockingFailed) {
      probeReport += `- \`${f.fieldName}\`：平均一致率 ${f.avgConsistencyRate}%（要求 ≥ ${CONSISTENCY_THRESHOLD}%）\n`;
    }
    probeReport += `\n**修复方向**：\n`;
    if (blockingFailed.some(f => f.invalidEnumScenes > 0)) probeReport += `- 枚举漂移：prompt 中强化枚举约束\n`;
    if (blockingFailed.some(f => f.numericRangeInfo !== undefined)) probeReport += `- 数值漂移：prompt 中明确范围约束\n`;
    probeReport += `- 对漂移字段增加 Validator 归一化 fallback\n\n**暂不进入 P3。**\n`;
  }

  // ==================================================================
  // shotplanner_reliable_input_fields.md
  // ==================================================================

  const reliableReport = `# ShotPlanner 可依赖字段清单

> **日期**：${now} | **基于**：P2.2-Final probe 真实结果

## A. 可直接作为 P3 依赖（blocking 且稳定）

${fieldStats.filter(f => f.tier === 'blocking' && f.isStable).map(f => `- \`${f.fieldName}\`（${f.avgConsistencyRate}%）`).join('\n') || '_（暂无）_'}

## B. 可依赖但需归一化（advisory 且稳定）

${fieldStats.filter(f => f.tier === 'advisory' && f.isStable).map(f => `- \`${f.fieldName}\`（${f.avgConsistencyRate}%，需归一化）`).join('\n') || '_（暂无）_'}

## C. 暂不可依赖（未达标 blocking 或 advisory 漂移 或 future）

${fieldStats.filter(f => !f.isStable || f.tier === 'future').map(f => `- \`${f.fieldName}\`（${f.avgConsistencyRate}%，${f.tier === 'future' ? 'future' : '未达标'}）`).join('\n') || '_（暂无）_'}
`;

  // ==================================================================
  // planner_stability_raw_summary.json
  // ==================================================================

  const rawSummary = {
    executedAt: now,
    config: {
      model: MODEL,
      sceneCount: scenes.length,
      runsPerScene: RUNS_PER_SCENE,
      consistencyThreshold: CONSISTENCY_THRESHOLD,
      numericRangeThreshold: NUMERIC_RANGE_THRESHOLD,
      outputFormat: 'json_schema/strict',
    },
    probeCompleteness,
    perSceneStats: perSceneStore.map(s => ({
      sceneId: s.sceneId,
      expectedRuns: s.expectedRuns,
      successfulRuns: s.successfulRuns,
      failedRuns: s.failedRuns,
      complete: s.complete,
    })),
    incompleteScenes: incompleteScenes.map(s => ({
      sceneId: s.sceneId,
      failedRuns: s.failedRuns,
      perSceneFailureReasons: s.runs
        .filter((r): r is Extract<ProbeRun, { ok: false }> => !r.ok)
        .map(r => r.errorMessage),
    })),
    aggregateStats: fieldStats.map(f => ({
      fieldName: f.fieldName,
      tier: f.tier,
      avgConsistencyRate: f.avgConsistencyRate,
      medianConsistencyRate: f.medianConsistencyRate,
      p90ConsistencyRate: f.p90ConsistencyRate,
      failSceneCount: f.failSceneCount,
      incompleteSceneCount: f.incompleteSceneCount,
      totalScenes: f.totalScenes,
      passRate: f.passRate,
      invalidEnumScenes: f.invalidEnumScenes,
      isStable: f.isStable,
      ...(f.numericRangeInfo && { numericRangeInfo: f.numericRangeInfo }),
    })),
    blockingFailedFields: blockingFailed.map(f => f.fieldName),
    advisoryWarnings: advisoryWarnings.map(f => f.fieldName),
    // 修复 #4：脚本只表达 probe 裁决，不宣布 ENTER_P3
    finalDecision: probeVerdict,
    tokenUsage: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalExpectedRuns: scenes.length * RUNS_PER_SCENE,
      successfulRuns: scenes.length * RUNS_PER_SCENE - globalFailedRuns,
      failedRuns: globalFailedRuns,
    },
  };

  // 写入文件
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, 'planner_stability_probe.md'), probeReport, 'utf-8');
  fs.writeFileSync(path.join(DOCS_DIR, 'shotplanner_reliable_input_fields.md'), reliableReport, 'utf-8');
  fs.writeFileSync(path.join(DOCS_DIR, 'planner_stability_raw_summary.json'), JSON.stringify(rawSummary, null, 2), 'utf-8');

  console.log(`\n[PROBE] 报告写入:`);
  console.log(`  docs/film-ir/planner_stability_probe.md`);
  console.log(`  docs/film-ir/shotplanner_reliable_input_fields.md`);
  console.log(`  docs/film-ir/planner_stability_raw_summary.json`);

  console.log('\n' + '='.repeat(60));
  console.log(`[PROBE] 裁决: ${probeVerdict}`);
  if (probeVerdict === 'PROBE_PASS') {
    console.log('[PROBE] ✅ Probe 通过 — 还需 CI smoke tests 同时通过才可宣布 P2.2-Final 封板');
  } else {
    for (const f of blockingFailed) {
      console.log(`  ❌ ${f.fieldName}: ${f.avgConsistencyRate}% (需 ≥ ${CONSISTENCY_THRESHOLD}%)`);
    }
  }
  console.log('='.repeat(60) + '\n');

  process.exit(probeVerdict === 'PROBE_PASS' ? 0 : 1);
}

main().catch(err => {
  console.error('[PROBE] 脚本执行失败:', err);
  process.exit(1);
});
