# Stage13 · CE Core Layer Implementation - 执行计划

**生成时间**: 2025-12-13  
**文档版本**: v1.0  
**状态**: 📋 PLAN → EXECUTE

---

## 一、总体目标

将 **CE06 / CE03 / CE04** 按《EngineSpec_V1.1》《APISpec_V1.1》正式落地为系统级 Core Engine Layer，接入现有 Job / Orchestrator / Worker / Audit / Quality 体系。

**禁止继续使用"临时映射""假定引擎"的说法。**

---

## 二、执行步骤清单

### Step 1: JobType 定义（必须新增）

**文件**: `packages/database/prisma/schema.prisma`

**修改内容**:

```prisma
enum JobType {
  // existing
  NOVEL_ANALYSIS

  // CE Core Layer
  CE06_NOVEL_PARSING
  CE03_VISUAL_DENSITY
  CE04_VISUAL_ENRICHMENT
}
```

**验证**:

- `npx prisma generate` 成功
- TypeScript 类型正确生成

---

### Step 2: Prisma Schema 扩展（数据落库）

**文件**: `packages/database/prisma/schema.prisma`

**新增表 1: novel_parse_result**

```prisma
model NovelParseResult {
  id            String   @id @default(uuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  volumes       Json?    // CE06 解析出的卷信息
  chapters      Json?    // CE06 解析出的章节信息
  scenes        Json?    // CE06 解析出的场景信息
  parsingQuality Float?  // 解析质量评分

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([projectId])
  @@index([projectId])
}
```

**新增表 2: quality_metrics**

```prisma
model QualityMetrics {
  id                String   @id @default(uuid())
  projectId         String
  project           Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  engine            String    // "CE03" | "CE04"
  visualDensityScore Float?  // CE03 输出
  enrichmentQuality  Float?  // CE04 输出
  parsingQuality     Float?  // CE06 输出（冗余，也可从 NovelParseResult 读取）

  metadata          Json?     // 其他质量指标

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([projectId, engine])
}
```

**修改 Project 模型**:

```prisma
model Project {
  // ... existing fields
  novelParseResults NovelParseResult[]
  qualityMetrics    QualityMetrics[]
}
```

**验证**:

- `npx prisma format` 通过
- `npx prisma generate` 成功
- 迁移文件生成成功

---

### Step 3: Shared Types DTO 定义

**文件**: `packages/shared-types/src/engines/ce-core.dto.ts` (新建)

**内容**:

```typescript
// CE06 Input/Output
export interface CE06NovelParsingInput {
  structured_text: string;
  context: {
    projectId: string;
    novelSourceId?: string;
  };
}

export interface CE06NovelParsingOutput {
  volumes: Array<{
    id: string;
    title: string;
    chapters: Array<{
      id: string;
      title: string;
      scenes: Array<{
        id: string;
        title: string;
        content: string;
      }>;
    }>;
  }>;
  parsing_quality: number;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}

// CE03 Input/Output
export interface CE03VisualDensityInput {
  structured_text: string;
  context: {
    projectId: string;
    sceneId?: string;
    episodeId?: string;
  };
}

export interface CE03VisualDensityOutput {
  visual_density_score: number;
  quality_indicators: Record<string, any>;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}

// CE04 Input/Output
export interface CE04VisualEnrichmentInput {
  structured_text: string;
  context: {
    projectId: string;
    sceneId?: string;
    shotId?: string;
  };
}

export interface CE04VisualEnrichmentOutput {
  enriched_text: string;
  enrichment_quality: number;
  metadata: Record<string, any>;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}
```

**导出**: `packages/shared-types/src/index.ts`

**验证**: TypeScript 编译通过

---

### Step 4: HTTP Engine Adapter 实现

**文件**: `apps/api/src/engine-hub/adapters/ce-core-http.adapter.ts` (新建)

**内容**:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CE06NovelParsingInput,
  CE06NovelParsingOutput,
  CE03VisualDensityInput,
  CE03VisualDensityOutput,
  CE04VisualEnrichmentInput,
  CE04VisualEnrichmentOutput,
} from '@scu/shared-types/engines/ce-core.dto';

@Injectable()
export class CECoreHttpAdapter implements EngineAdapter {
  private readonly logger = new Logger(CECoreHttpAdapter.name);

  constructor(private readonly httpService: HttpService) {}

  supports(engineKey: string): boolean {
    return ['ce06_novel_parsing', 'ce03_visual_density', 'ce04_visual_enrichment'].includes(
      engineKey
    );
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { engineKey, payload } = input;

    try {
      let result: any;

      if (engineKey === 'ce06_novel_parsing') {
        result = await this.invokeCE06(payload as CE06NovelParsingInput);
      } else if (engineKey === 'ce03_visual_density') {
        result = await this.invokeCE03(payload as CE03VisualDensityInput);
      } else if (engineKey === 'ce04_visual_enrichment') {
        result = await this.invokeCE04(payload as CE04VisualEnrichmentInput);
      } else {
        throw new Error(`Unsupported engine: ${engineKey}`);
      }

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: result,
        latency: result.latency_ms,
      };
    } catch (error) {
      this.logger.error(`CE Engine ${engineKey} invocation failed:`, error);
      return {
        status: EngineInvokeStatus.FAILED,
        error: error.message,
      };
    }
  }

  private async invokeCE06(input: CE06NovelParsingInput): Promise<CE06NovelParsingOutput> {
    const baseUrl = process.env.CE06_BASE_URL || 'http://localhost:8000';
    const response = await firstValueFrom(
      this.httpService.post(`${baseUrl}/story/parse`, {
        structured_text: input.structured_text,
        context: input.context,
      })
    );
    return response.data;
  }

  private async invokeCE03(input: CE03VisualDensityInput): Promise<CE03VisualDensityOutput> {
    const baseUrl = process.env.CE03_BASE_URL || 'http://localhost:8001';
    const response = await firstValueFrom(
      this.httpService.post(`${baseUrl}/text/visual-density`, {
        structured_text: input.structured_text,
        context: input.context,
      })
    );
    return response.data;
  }

  private async invokeCE04(input: CE04VisualEnrichmentInput): Promise<CE04VisualEnrichmentOutput> {
    const baseUrl = process.env.CE04_BASE_URL || 'http://localhost:8002';
    const response = await firstValueFrom(
      this.httpService.post(`${baseUrl}/text/enrich`, {
        structured_text: input.structured_text,
        context: input.context,
      })
    );
    return response.data;
  }
}
```

**注册**: `apps/api/src/engine-hub/engine-hub.module.ts`

**验证**: Adapter 可正确调用 HTTP 接口

---

### Step 5: Engine Registry 注册

**文件**: `apps/api/src/engine-hub/engine-registry-hub.service.ts`

**修改内容**:

```typescript
private engines: EngineDescriptor[] = [
  // ... existing engines
  {
    key: 'ce06_novel_parsing',
    version: 'default',
    mode: 'http',
    httpConfig: {
      baseUrl: process.env.CE06_BASE_URL || 'http://localhost:8000',
      path: '/story/parse',
    },
  },
  {
    key: 'ce03_visual_density',
    version: 'default',
    mode: 'http',
    httpConfig: {
      baseUrl: process.env.CE03_BASE_URL || 'http://localhost:8001',
      path: '/text/visual-density',
    },
  },
  {
    key: 'ce04_visual_enrichment',
    version: 'default',
    mode: 'http',
    httpConfig: {
      baseUrl: process.env.CE04_BASE_URL || 'http://localhost:8002',
      path: '/text/enrich',
    },
  },
];
```

**验证**: Engine Registry 可找到 CE 引擎

---

### Step 6: Orchestrator DAG 实现（固定执行顺序）

**文件**: `apps/api/src/orchestrator/orchestrator.service.ts`

**新增方法**:

```typescript
/**
 * 创建 CE Core Layer 的固定 DAG Job 链
 * Upload Novel → CE06 → CE03 → CE04
 */
async createCECoreDAG(projectId: string, organizationId: string, novelSourceId: string): Promise<{
  taskId: string;
  jobIds: string[];
}> {
  // 1. 创建主 Task
  const task = await this.taskService.create({
    organizationId,
    projectId,
    type: TaskType.CE_CORE_PIPELINE, // 需要新增
    status: TaskStatus.PENDING,
    payload: {
      novelSourceId,
      pipeline: ['CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
    },
  });

  // 2. 创建 CE06 Job（第一个）
  const ce06Job = await this.jobService.create({
    taskId: task.id,
    projectId,
    type: JobType.CE06_NOVEL_PARSING,
    status: JobStatus.PENDING,
    payload: {
      projectId,
      novelSourceId,
      engineKey: 'ce06_novel_parsing',
    },
  });

  // 3. CE06 完成后，由 Worker 回调触发 CE03（通过 JobService 的完成回调）
  // 4. CE03 完成后，由 Worker 回调触发 CE04

  return {
    taskId: task.id,
    jobIds: [ce06Job.id],
  };
}
```

**修改 JobService**: 在 Job 完成时检查是否需要触发下一个 CE Job

**验证**: DAG 按顺序执行，禁止并行、禁止跳过

---

### Step 7: Worker Processors 实现

**文件**: `apps/workers/src/ce-core-processor.ts` (新建)

**内容**:

```typescript
import { PrismaClient } from 'database';
import { EngineAdapterClient } from './engine-adapter-client';

export async function processCE06Job(
  prisma: PrismaClient,
  job: { id: string; payload: any; projectId: string },
  engineClient: EngineAdapterClient
): Promise<any> {
  // 1. 获取输入数据
  const novelSource = await prisma.novelSource.findFirst({
    where: { projectId: job.projectId },
    orderBy: { createdAt: 'desc' },
  });

  if (!novelSource?.rawText) {
    throw new Error('Novel source not found');
  }

  // 2. 调用 CE06 Engine
  const input = {
    structured_text: novelSource.rawText,
    context: {
      projectId: job.projectId,
      novelSourceId: novelSource.id,
    },
  };

  const result = await engineClient.invoke('ce06_novel_parsing', input);

  // 3. 落库
  await prisma.novelParseResult.upsert({
    where: { projectId: job.projectId },
    create: {
      projectId: job.projectId,
      volumes: result.output.volumes,
      chapters: result.output.chapters,
      scenes: result.output.scenes,
      parsingQuality: result.output.parsing_quality,
    },
    update: {
      volumes: result.output.volumes,
      chapters: result.output.chapters,
      scenes: result.output.scenes,
      parsingQuality: result.output.parsing_quality,
    },
  });

  // 4. 触发下一个 Job (CE03)
  // 通过 API 调用创建 CE03 Job

  return result;
}

export async function processCE03Job(
  prisma: PrismaClient,
  job: { id: string; payload: any; projectId: string },
  engineClient: EngineAdapterClient
): Promise<any> {
  // 1. 获取 CE06 结果
  const parseResult = await prisma.novelParseResult.findUnique({
    where: { projectId: job.projectId },
  });

  if (!parseResult) {
    throw new Error('CE06 result not found');
  }

  // 2. 调用 CE03 Engine
  const input = {
    structured_text: JSON.stringify(parseResult.scenes),
    context: {
      projectId: job.projectId,
    },
  };

  const result = await engineClient.invoke('ce03_visual_density', input);

  // 3. 落库
  await prisma.qualityMetrics.create({
    data: {
      projectId: job.projectId,
      engine: 'CE03',
      visualDensityScore: result.output.visual_density_score,
      metadata: result.output.quality_indicators,
    },
  });

  // 4. 触发下一个 Job (CE04)

  return result;
}

export async function processCE04Job(
  prisma: PrismaClient,
  job: { id: string; payload: any; projectId: string },
  engineClient: EngineAdapterClient
): Promise<any> {
  // 1. 获取 CE03 结果
  const qualityMetrics = await prisma.qualityMetrics.findFirst({
    where: {
      projectId: job.projectId,
      engine: 'CE03',
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. 调用 CE04 Engine
  const input = {
    structured_text: JSON.stringify(qualityMetrics?.metadata || {}),
    context: {
      projectId: job.projectId,
    },
  };

  const result = await engineClient.invoke('ce04_visual_enrichment', input);

  // 3. 落库
  await prisma.qualityMetrics.create({
    data: {
      projectId: job.projectId,
      engine: 'CE04',
      enrichmentQuality: result.output.enrichment_quality,
      metadata: result.output.metadata,
    },
  });

  return result;
}
```

**集成到 Worker 主循环**: `apps/workers/src/main.ts`

**验证**: Worker 可正确处理三个 CE Job

---

### Step 8: 审计集成

**文件**: `apps/workers/src/ce-core-processor.ts`

**在每个 processor 中添加**:

```typescript
// 在 Job 完成后写审计日志
await apiClient.post('/api/audit/logs', {
  action: `CE06_RUN` | `CE03_RUN` | `CE04_RUN`,
  resourceType: 'job',
  resourceId: job.id,
  details: {
    trace_id: job.id,
    job_type: job.type,
    engine: 'CE06' | 'CE03' | 'CE04',
    input_hash: hashInput(input),
    output_hash: hashOutput(result),
    latency: result.latency_ms,
    cost: calculateCost(result),
  },
});
```

**验证**: 每个 CE Job 完成后都有审计日志

---

### Step 9: Novel Import Controller 集成

**文件**: `apps/api/src/novel-import/novel-import.controller.ts`

**修改 `analyzeNovel` 方法**:

```typescript
// 在创建 NOVEL_ANALYSIS Job 后，创建 CE Core DAG
const ceDAG = await this.orchestratorService.createCECoreDAG(
  projectId,
  organizationId,
  novelSourceId
);
```

**验证**: 上传小说后自动触发 CE Core DAG

---

### Step 10: 验证与测试

**验证脚本**: `tools/dev/stage13-ce-core-verification.sh` (新建)

**验证步骤**:

1. 启动 API 和 Worker
2. 上传测试小说
3. 检查 Job 状态（CE06 → CE03 → CE04）
4. 检查数据库（novel_parse_result, quality_metrics）
5. 检查审计日志
6. 验证失败场景（CE06 失败后，CE03/CE04 不执行）

**验证报告**: `docs/TEST_REPORT_STAGE13_CE_CORE_LAYER_YYYYMMDD.md`

---

## 三、文件清单

### 新建文件

1. `packages/shared-types/src/engines/ce-core.dto.ts`
2. `apps/api/src/engine-hub/adapters/ce-core-http.adapter.ts`
3. `apps/workers/src/ce-core-processor.ts`
4. `tools/dev/stage13-ce-core-verification.sh`
5. `docs/TEST_REPORT_STAGE13_CE_CORE_LAYER_YYYYMMDD.md`

### 修改文件

1. `packages/database/prisma/schema.prisma` - JobType enum, 新增表
2. `packages/shared-types/src/index.ts` - 导出 CE DTO
3. `apps/api/src/engine-hub/engine-registry-hub.service.ts` - 注册 CE 引擎
4. `apps/api/src/engine-hub/engine-hub.module.ts` - 注册 Adapter
5. `apps/api/src/orchestrator/orchestrator.service.ts` - DAG 实现
6. `apps/api/src/job/job.service.ts` - Job 完成回调
7. `apps/workers/src/main.ts` - 集成 CE processors
8. `apps/api/src/novel-import/novel-import.controller.ts` - 触发 CE DAG

---

## 四、验收标准

1. ✅ JobType 定义正确，Prisma 生成成功
2. ✅ 数据库表创建成功，迁移通过
3. ✅ HTTP Engine Adapter 可调用外部 CE 服务
4. ✅ Orchestrator DAG 按顺序执行（CE06 → CE03 → CE04）
5. ✅ Worker processors 正确处理每个 CE Job
6. ✅ 数据正确落库（novel_parse_result, quality_metrics）
7. ✅ 审计日志完整记录
8. ✅ 失败场景正确处理（后续 Job 不执行）
9. ✅ 验证报告完整

---

## 五、风险与注意事项

1. **外部服务依赖**: CE06/CE03/CE04 需要外部 HTTP 服务，需要 mock 或真实服务
2. **DAG 触发机制**: 需要确保 Job 完成时正确触发下一个 Job
3. **数据一致性**: 确保 CE06 结果在 CE03 执行前已落库
4. **错误处理**: 任一 CE 失败时，后续 Job 必须标记为 FAILED，不执行

---

**PLAN 完成，准备进入 EXECUTE 阶段。**
