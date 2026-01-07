# P1 阶段执行计划：规模化与商用稳定性加固（SSOT）

目标：从“单次 E2E 成功”升级为“多用户、高负载、可运营”的商用基线。
核心聚焦：主干加固、并发治理、配额管控、计费对账、可观测性、发布演练。

## P1-0 主干加固 (当前已完成起点)

- 合并：fix/p0-2-shotrender-videorender -> master
- 回归门禁：P3 E2E + P4 Playback 连续两轮 PASS
- 幂等验证：cost_ledger duplicates = 0
- 证据：docs/\_evidence/p1_origin_foundation_20260107_074401/

## P1-1 并发与队列治理

- 同 org 并发：10 shots 并行触发，确保无资源竞争与错绑
- 重试与死信：明确 zombie job 探测与回收策略
- 门禁：gate-p1_concurrency_load.sh（1 org / 10 parallel shots）
- 证据：SLA_METRICS.json + FINAL_6LINE_EVIDENCE.txt

## P1-2 配额与计费对账（运营化）

- quota guard：余额不足必须 402/Quota Exceeded，且不创建 Job
- 对账：cost*ledger -> billing*\* 汇总一致
- 门禁：gate-p1_billing_quota_enforcement.sh + gate-p1_billing_reconcile.sh
- 证据：BILLING_SNAPSHOT.txt + FINAL_6LINE_EVIDENCE.txt

## P1-3 可观测性与告警

- TraceId/SpanId 贯通：API -> Worker -> Processor
- SLA 指标：成功率、耗时、计费异常数
- 告警：job 卡死、资产缺失、计费不一致
- 证据：SLA_REPORT.json

## P1-4 生产发布演练

- deploy-prod.sh / rollback-prod.sh
- OPS_MANUAL.md
- 证据：STAGING_RELEASE_AUDIT.log

## 证据目录规范（统一）

docs/_evidence/p1_\*/

- FINAL_6LINE_EVIDENCE.txt
- gate\*.log / api.log / worker.log
- SLA_METRICS.json（如适用）
- BILLING_SNAPSHOT.txt（如适用）
