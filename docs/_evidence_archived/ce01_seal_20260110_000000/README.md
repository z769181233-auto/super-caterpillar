# CE01 封板证据索引

## 执行信息

- **Gate 运行时间**: 待执行
- **Exit Code**: 待验证
- **执行环境**: API + Worker (同时运行)

## 证据文件清单

### 1. gate_output.log
Gate 脚本完整输出，包含所有验证步骤和断言结果。

### 2. worker_consume_log.txt
Worker 认领与完成 CE01 Job 的关键日志片段，证明真实 Worker 消费。

### 3. binding_metadata.csv
JobEngineBinding 表的 metadata 字段导出，验证 fingerprint、artifacts 等字段正确写入。

### 4. org_verification.csv
租户隔离验证，确认所有 binding 正确关联到对应的 organizationId 和 projectId。

## 验收标准

- ✅ Gate Exit 0
- ✅ Worker 日志显示 Job 认领与完成
- ✅ metadata 包含 artifacts 和 fingerprint
- ✅ 租户隔离验证通过

## 封板状态

- **Tag**: p1-ce01-protocol-sealed-20260110
- **Commit**: 待生成
- **证据完整性**: 待验证
