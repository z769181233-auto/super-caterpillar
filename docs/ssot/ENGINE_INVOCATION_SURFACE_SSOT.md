# Engine Invocation Surface SSOT

本文件为 CE-ARCH-GUARD-02 的审计可读 SSOT 说明（确定性输出）。

## 规则

- SSOT JSON 禁止包含易变字段（如 generatedAt/timestamp/statistics/duration/hostMachine 等）。
- 技术债 allowlist 为硬封顶（MUST_NOT_EXPAND）。扩张视为架构退化，门禁必须失败。

## 扫描范围（固定）

- apps/api/src
- apps/workers/src

## 产物

- docs/ssot/engine_invocation_surface_ssot.json（机器可读，确定性）
- docs/ssot/ENGINE_INVOCATION_SURFACE_SSOT.md（本文件，确定性）

## 技术债 Allowlist（硬封顶）

- apps/workers/src/engine-adapter-client.ts
- apps/workers/src/novel-analysis-processor.ts
- apps/workers/src/adapters/visual-density.adapter.ts
- apps/workers/src/adapters/visual-enrichment.adapter.ts
- apps/workers/src/billing/cost-ledger.service.ts

## Call Sites（由 JSON 为准）

请以 JSON 中 callSites 列表为单一事实源。

## Engine Surface（由 JSON 为准）

请以 JSON 中 engineSurface 列表为单一事实源。

## Security Audit Surface（由 JSON 为准）

请以 JSON 中 securityAuditSurface 为单一事实源。
