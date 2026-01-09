# 详细风险登记册

| RiskId | P级别 | 文档条款             | 文件:行号               | 命中片段      | 风险说明  |
| ------ | ----- | -------------------- | ----------------------- | ------------- | --------- | ----------- | ----------- | ------------- | -------------------------------------- |
| R001   | P0    | API Spec V1.1 第11章 | ./tools/risk-scan.sh:21 | $S "X-Api-Key | X-Nonce   | X-Timestamp | X-Signature | HMAC...       | API 安全：签名链路与旁路检查           |
| R002   | P0    | SafetySpec 第X章     | ./tools/risk-scan.sh:29 | $S "audit     | audit_log | audit_trail | trace_id    | security\_... | 审计：审计日志、trace_id、签名错误审计 |
