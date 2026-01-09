> 已合并到 docs/VERIFY_CONTROL_PLANE_NETWORK.md

# Pipeline Control Plane Verification Report

## 1. 页面可达性

- 访问：/{locale}/projects/{projectId}/pipeline
- 预期：页面加载成功，展示节点列表（PROJECT/SEASON/EPISODE/SCENE/SHOT）

## 2. Tasks 打通

- 点击“打开 Tasks（带 projectId）”
- 预期：跳转 /{locale}/tasks?projectId=... 并正确筛选

## 3. Gate 可解释

- 对任意节点：
  - 展示 qaStatus（PASS/WARN/FAIL/PENDING）
  - 展示 canGenerate
  - 若 blockingReason 存在：必须展示原始文本

## 4. 控制动作（审计必达）

### 4.1 Retry

- 点击 Retry
- 预期：
  - API 200
  - 刷新后数据仍可加载
  - 审计写入：PIPELINE_NODE_RETRY（包含 nodeId/jobId/reason）

### 4.2 Skip（必须填写原因）

- 原因为空或 <3 字符：应提示并阻止调用
- 原因合规：API 200
- 审计写入：PIPELINE_NODE_SKIP（包含 nodeId/reason）

### 4.3 ForcePass（必须填写原因）

- 同 Skip
- 审计写入：PIPELINE_NODE_FORCE_PASS（包含 nodeId/reason）

## 5. 稳态

- Pipeline 页面默认不轮询，仅手动刷新
- 不应引入额外 429 风险

## 6. 门禁

- pnpm -C apps/web lint 通过
- pnpm -C apps/api build / typecheck 通过（按项目门禁执行）
