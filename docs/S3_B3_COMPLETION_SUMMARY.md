# S3-B.3 Engine RoutingLayer 实现完成总结

**完成时间**: 2024-12-11  
**批次**: S3-B.3  
**状态**: ✅ 已完成并验证通过

---

## 一、已完成任务

### 1. 新增 EngineRoutingService（RoutingLayer）

- **文件**: `apps/api/src/engine/engine-routing.service.ts`
- **功能**: 负责路由决策，根据 `jobType`、`baseEngineKey`、`payload` 决定最终 `engineKey` 和 `resolvedVersion`
- **核心规则**:
  1. `payload.engineKey` 显式指定时优先使用（最高优先级）
  2. `NOVEL_ANALYSIS` 默认：除非显式要求 HTTP，否则必须走 `default_novel_analysis`
  3. `*_HTTP` JobType：默认走 HTTP 引擎
  4. `useHttpEngine === true`：灰度切 HTTP
  5. 无特殊情况：返回 `baseEngineKey`（保持向后兼容）

### 2. EngineRegistry.invoke() 接入路由层

- **文件**: `apps/api/src/engine/engine-registry.service.ts`
- **变更**:
  - 更新引用：从 `../engines/engine-router.service` 改为 `./engine-routing.service`
  - 移除 `EngineInvokerService` 依赖（不再使用）
  - 重构 `invoke()` 方法：
    1. 计算 `baseEngineKey`（优先 `input.engineKey`，否则 `getDefaultEngineKeyForJobType`）
    2. 调用 `EngineRoutingService.resolve()` 获取路由结果
    3. 合成 `nextPayload`（透传 `resolvedVersion`）
    4. 选择 adapter（保留现有 `findAdapter` 逻辑）
    5. 直接调用 `adapter.invoke(nextInput)`

### 3. EngineModule 注册路由服务

- **文件**: `apps/api/src/engines/engine.module.ts`
- **变更**: 更新引用，使用新的 `EngineRoutingService`

---

## 二、验证结果

### 测试用例验证（7/7 通过）

| Case | 场景                                                         | 预期结果                             | 实际结果 | 状态 |
| ---- | ------------------------------------------------------------ | ------------------------------------ | -------- | ---- |
| 1    | `jobType=NOVEL_ANALYSIS`，无 `useHttpEngine`，无 `engineKey` | `engineKey=default_novel_analysis`   | ✅       | ✅   |
| 2    | `jobType=NOVEL_ANALYSIS_HTTP`，无 `engineKey`                | `engineKey=http_real_novel_analysis` | ✅       | ✅   |
| 3    | `jobType=NOVEL_ANALYSIS`，`payload.useHttpEngine=true`       | `engineKey=http_real_novel_analysis` | ✅       | ✅   |
| 4    | `payload.engineKey='http_mock_novel_analysis'`               | `engineKey=http_mock_novel_analysis` | ✅       | ✅   |
| 5    | `payload.engineVersion='v2'`                                 | `resolvedVersion='v2'`               | ✅       | ✅   |
| 6    | `NOVEL_ANALYSIS` + `useHttpEngine=false`                     | `engineKey=default_novel_analysis`   | ✅       | ✅   |
| 7    | `SHOT_RENDER` + `useHttpEngine=true`                         | `engineKey=http_real_shot_render`    | ✅       | ✅   |

### 构建验证

- ✅ `pnpm --filter api build` - 成功
- ✅ `pnpm --filter @scu/worker build` - 成功
- ✅ 无 TypeScript 编译错误
- ✅ 无 Linter 错误

---

## 三、关键行为确认

### 1. NOVEL_ANALYSIS 默认路径保持不变 ✅

- 当 `jobType === 'NOVEL_ANALYSIS'` 且未显式要求 HTTP 时，路由层强制返回 `default_novel_analysis`
- 验证：Case 1 和 Case 6 均通过

### 2. \_HTTP JobType 与 useHttpEngine 灰度隔离 ✅

- `_HTTP` JobType：默认走 HTTP 引擎
- `useHttpEngine: true`：作为灰度开关，仅在明确设置时切到 HTTP
- 验证：Case 2 和 Case 3 均按预期工作

### 3. 显式 engineKey 优先 ✅

- `payload.engineKey` 显式指定时，优先于所有其他规则
- 验证：Case 4 通过

### 4. 版本信息透传 ✅

- `payload.engineVersion` 通过路由层透传到 `resolvedVersion`
- 验证：Case 5 通过

---

## 四、封板文件确认

### 未修改的封板文件 ✅

- `apps/api/src/config/engine.config.ts` - 未修改
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - 未修改

---

## 五、后续计划

### S3-B 阶段剩余任务

根据 `docs/STAGE3_PLAN.md`，S3-B 阶段包含：

1. **S3-B.1：Engine 管理 API 设计**（仅文档，PLAN-only）
   - 状态: ⏳ 待执行
   - 目标: 设计 Engine 配置的 CRUD API（只读为主，简单写入）
   - 配置存储策略: 环境变量 + JSON 配置文件（MVP 阶段）

2. **S3-B.2：Engine 管理前端页面设计**（仅文档，PLAN-only）
   - 状态: ⏳ 待执行
   - 目标: 设计 Engine 管理页面的信息架构
   - 依赖: S3-B.1

3. **S3-B.3：Engine RoutingLayer 实现**（WRITE 阶段）
   - 状态: ✅ **已完成**
   - 完成时间: 2024-12-11

4. **S3-B.4：Engine 管理 API 实现**（WRITE 阶段）
   - 状态: ⏳ 待执行
   - 依赖: S3-B.1 设计文档完成
   - 目标: 实现 Engine 配置的 CRUD API

5. **S3-B.5：Engine 管理前端页面实现**（WRITE 阶段）
   - 状态: ⏳ 待执行
   - 依赖: S3-B.2 设计文档完成 + S3-B.4 API 实现
   - 目标: 实现 Engine 管理前端页面

---

## 六、整体 Stage3 进度

### S3-A：HTTP 引擎真实接入

- ✅ **S3-A.1**: HTTP 引擎配置与安全设计（已封板）
- ✅ **S3-A.2**: HTTP 引擎调用路径设计（PLAN-only，已完成）
- ✅ **S3-A.3**: HTTP 引擎调用路径实现（EXECUTE，已完成）

### S3-B：Engine 管理 & 配置中心 MVP

- ⏳ **S3-B.1**: Engine 管理 API 设计（PLAN-only，待执行）
- ⏳ **S3-B.2**: Engine 管理前端页面设计（PLAN-only，待执行）
- ✅ **S3-B.3**: Engine RoutingLayer 实现（EXECUTE，**已完成**）
- ⏳ **S3-B.4**: Engine 管理 API 实现（EXECUTE，待执行）
- ⏳ **S3-B.5**: Engine 管理前端页面实现（EXECUTE，待执行）

### S3-C：Studio / 导入页联动增强

- ⏳ **S3-C.1**: Studio/导入页联动信息架构（PLAN-only，待执行）

---

## 七、下一步行动建议

### 立即可以执行的任务

1. **S3-B.1：Engine 管理 API 设计**（PLAN-only）
   - 输出文档: `docs/ENGINE_MANAGEMENT_API.md`
   - 时间估算: 2-3 天
   - 内容要求:
     - API 接口设计（GET /api/engines, GET /api/engines/:engineKey, PUT /api/engines/:engineKey）
     - 配置存储方案实现细节（JSON 文件读取、环境变量覆盖）
     - DTO 定义（EngineConfigDto, UpdateEngineConfigDto）
     - 权限控制（仅管理员可修改配置）
     - 配置验证规则（engineKey 唯一性、HTTP 配置完整性）

2. **S3-B.2：Engine 管理前端页面设计**（PLAN-only）
   - 输出文档: `docs/ENGINE_MANAGEMENT_UI.md`
   - 时间估算: 1-2 天
   - 依赖: S3-B.1 设计文档完成
   - 内容要求:
     - 页面信息架构（列表页、详情页、编辑页）
     - UI 组件设计（EngineList, EngineConfigForm）
     - 交互流程（查看配置、启用/禁用引擎、设置默认引擎）
     - 数据展示（引擎基本信息、HTTP 配置、使用统计、质量指标）

### 后续执行任务（需等待设计文档）

3. **S3-B.4：Engine 管理 API 实现**（EXECUTE）
   - 依赖: S3-B.1 设计文档完成并通过评审
   - 实现内容:
     - `apps/api/src/engine/engine-config.service.ts` - Engine 配置服务
     - `apps/api/src/engine/engine-config.controller.ts` - Engine 配置 API
     - `apps/api/src/engine/dto/engine-config.dto.ts` - DTO 定义
     - `apps/api/src/engine/engine-config.module.ts` - 模块定义

4. **S3-B.5：Engine 管理前端页面实现**（EXECUTE）
   - 依赖: S3-B.2 设计文档完成 + S3-B.4 API 实现
   - 实现内容:
     - `apps/web/src/app/admin/engines/page.tsx` - Engine 管理页面
     - `apps/web/src/app/admin/engines/[engineKey]/page.tsx` - Engine 详情页面
     - `apps/web/src/components/engines/EngineList.tsx` - 引擎列表组件
     - `apps/web/src/components/engines/EngineConfigForm.tsx` - 配置表单组件

---

## 八、技术债务与注意事项

### 当前实现的技术债务

1. **EngineInvokerService 移除**
   - 已从 `EngineRegistry` 中移除 `EngineInvokerService` 依赖
   - 如果其他模块仍在使用，需要检查并更新

2. **旧路由服务**
   - 旧的 `apps/api/src/engines/engine-router.service.ts` 可能仍存在
   - 建议清理未使用的旧实现

### 注意事项

1. **路由层职责单一**
   - 路由层只做决策，不涉及配置解析或适配器调用
   - 配置解析仍由 `EngineConfigStoreService` 负责

2. **向后兼容**
   - 保留 `baseEngineKey` 作为 fallback，确保现有逻辑不受影响
   - 所有路由规则显式可推导，无隐式降级

3. **封板保护**
   - 未修改任何封板文件，保持现有 HMAC/鉴权/错误分类逻辑不变

---

**文档状态**: ✅ S3-B.3 已完成  
**下一步**: 执行 S3-B.1（Engine 管理 API 设计，PLAN-only 模式）
