## Web E2E 字段对齐报告

生成时间：2025-12-18  
仓库：Super Caterpillar

---

## 1. 静态检查结论（类型 / Lint / Build）

- **TypeScript 类型检查**：`pnpm -r typecheck` 通过（apps/api + apps/web 无类型错误）
- **构建**：`pnpm -r build` 通过（API + Web + Workers 均可编译）
- **ESLint**：`pnpm -r lint` 存在大量 `any` / 未使用变量告警，但**无字段/类型错误级别问题**

结论：在当前代码状态下，TypeScript 编译器未发现前后端 DTO / shared-types 的类型不匹配错误。

---

## 2. Shared Types 对齐检查

- **单一真源目录**：`packages/shared-types/src`
- 关键 DTO：
  - `jobs/video-render.dto.ts`：`VideoRenderInput` / `VideoRenderResult`
  - `projects/*`：项目 / 结构树相关 DTO
  - `tasks/*`：任务图 / 引擎任务 DTO

### 2.1 Video Render Job 字段对齐

- **Shared Types**：`VideoRenderInput`
  - `shotId: string`（必填）
  - `frameKeys: string[]`（必填）
  - `fps: number`（必填）
- **后端 DTO**：`apps/api/src/job/dto/create-job.dto.ts`
  - `CreateJobDto.payload?: Record<string, any>`（对 VIDEO_RENDER 时承载 `VideoRenderInput`）
- **前端调用**：`apps/web/src/lib/apiClient.ts` 中 Job 创建接口（通过共享 DTO 或 `payload` 传递）

对齐结论：

- 字段名 / 类型：`shotId`, `frameKeys`, `fps` 在 shared-types 中定义为严格类型，后端通过 `CreateJobDto.payload` 接收，未发现重命名或类型冲突。
- 前端使用 shared DTO（通过 `@/types/dto` 聚合），未发现自造与后端不一致的类型定义。

---

## 3. API 端点契约对齐（抽样关键路径）

> 抽样覆盖：Job、Project、TaskGraph、Monitor、Storage 相关端点。

- **Job API**
  - Controller：`apps/api/src/job/job.controller.ts`
  - DTO：`CreateJobDto`, `ReportJobDto`, `ListJobsDto`
  - Web Client：`apps/web/src/lib/apiClient.ts` 中 `createJob`, `listJobs`, `getJobDetail`
  - 对齐情况：
    - `createJob`：前端请求体字段与 `CreateJobDto` 匹配（`type`, `payload`, `engine`, `engineConfig`），未发现多余/缺失字段。
    - `listJobs`：前端 `ListJobsParams` 与后端查询参数（`status`, `type`, `projectId`, `engineKey`, `page`, `pageSize`）一致。

- **Project / Structure API**
  - Controller：`apps/api/src/project/project.controller.ts`
  - DTO：`CreateProjectDto` / `UpdateProjectDto` / `ListShotsDto` 等
  - Web Client：`getProjects`, `getProjectDetail`, 结构树相关接口
  - 对齐情况：
    - 前端通过 `ProjectDTO` / `ProjectDetailDTO`（来自 shared-types）消费返回值，与后端 DTO 字段一致。

- **TaskGraph / Monitor API**
  - Controller：`task-graph.controller.ts`, `worker.controller.ts`, `orchestrator-monitor.controller.ts`
  - Web Client：`getTaskGraph`, `getWorkerMonitorStats`, `getOrchestratorMonitorStats`
  - 返回结构统一为 `{ data: DTO }` 或 `{ data: { jobs: DTO[] } }`，前端在 `apiClient` 中已做容错解析（`data ?? json`），未发现字段名冲突。

结论：抽样检查的核心端点在 **字段名 / 类型 / 可空性** 上与 shared-types 对齐，未发现明显错位。

---

## 4. Prisma 可空性 vs 前端必填性

> 由于 schema.prisma 较大，此处聚焦对 Web 关键表单的影响。

- 项目创建 / 更新：
  - 多数展示字段（描述、备注等）在 Prisma 中为可空，前端表单允许留空，并对 `undefined` / 空字符串做了回退处理。
- Job 列表 / 详情：
  - 可空字段（如某些统计或扩展配置）前端渲染前做了存在性检查（例如通过 `?.` 访问或默认值），未发现直接解构可空字段导致的崩溃路径。

结论：在已检查路径中，未发现“DB 可空但前端强制必填且不处理空值”导致的明显崩溃风险。

---

## 5. 差异与建议

在 **TypeScript 类型检查 + 抽样代码审查** 范围内：

- 未发现前后端在以下方面的“已知不一致”：
  - 字段命名（snake/camel 混用除外，已由 DTO 层统一）
  - 类型（string/number/enum）冲突
  - 是否可空（前端未对可空字段做容错的关键路径）
- 仍存在的改进空间（但非阻塞）：
  - Web 与 API 多处使用 `any`，削弱了编译期契约校验力度；
  - 建议逐步将 `Record<string, any>` 类型替换为 shared-types 中的精确 DTO，以进一步缩小“隐形对齐风险”。

---

## 6. 总体结论

- **字段对齐状态**：在现有类型系统与 shared-types 约束下，未发现阻塞上线的字段/类型不一致问题。
- **残余风险级别**：P2（主要为 `any` 使用过多导致的潜在盲区），建议在后续迭代中通过加强 shared DTO 使用和减少 `any` 继续收口。
