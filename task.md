## P4 SEALED（8K HEVC Delivery）

- Evidence Dir: `docs/_evidence/p4_first_video_8k_hevc_20260130_235900/`
- Index: `docs/_evidence/p4_first_video_8k_hevc_20260130_235900/EVIDENCE_INDEX.json`
- Gates: `gate_p4_8k_hevc.sh PASS` · `gate_p4_ce09_security.sh PASS` · `gate_no_secrets.log PASS` · `release/DELIVERY_MANIFEST.json READY`

**Verify（秒级复核）**

```bash
ffprobe -v error -show_streams -show_format docs/_evidence/p4_first_video_8k_hevc_20260130_235900/output/scene_8k_hevc_watermarked.mp4
shasum -a 256 -c docs/_evidence/p4_first_video_8k_hevc_20260130_235900/release/EVIDENCE_INDEX.checksums
```

# Super Caterpillar Engineering Constitution (LOCKED)

## G0-G4 黄金法则

- **G0**: 先语义，后画面 (无因果不生成)
- **G1**: 一切以 `_specs` 为真源 (SSOT)
- **G2**: 禁止“先出视频再补文档”
- **G3**: 单镜头黄金样优先 (S001_SH01 Only)
- **G4**: Gate FAIL = 立即停机

---

## [x] Phase 3': 工业化量产线 (The Factory)

_Status: REAL SEALED | Production Ready_

- [x] **P3'-REAL-0: 运行器重构 (Physical Isolation)**
  - Dispatcher 模式实现。
- [x] **P3'-REAL-1: 静态审计门禁**
  - `gate_no_mock_real_mode.sh` (0 Mock).
- [x] **P3'-REAL-2: 视频硬断言 (ffprobe)**
  - Hard assertions (Size/Duration).
- [x] **P3'-REAL-3: 审计证据精准化**
  - Exactly 4 crops + PASS/FAIL verdict.
- [x] **P3'-REAL-4: 规模验证 (P3'-6)**
  - 200k words pressure test (334ms scan).
- [x] **P3'-REAL-5: 终极封印审计报告 (Industrial Review)**
  - Markdown Table Sealing.

## [x] Phase 5: Commercial Audit & Performance Gate (CLOSED)

_Status: SEALED | Commercial Ready_
_Evidence Dir: docs/\_evidence/p5_final_review_20260131_201914/_

- [x] P5-0: Throughput Gate (N=10 Concurrency, < 5s Latency)
- [x] P5-1: Unit Cost Audit (8K HEVC Cost Analysis)
- [x] P5-2: Commercial SLO Verification (P99 Stability Audit)

---

## [/] Phase 6: Release Readiness (P6)

- [x] P6-0: 配置与密钥红线审计 (Config/Secrets Sanity)
- [x] P6-1: 数据库迁移安全演练 (DB Migration Safety)
- [x] P6-2: 核心指标可观测性接入 (Observability Required)
- [x] P6-3: 生产级回滚全流程演练 (Rollback Drill)
- [x] P6-2: 核心指标可观测性接入 (Observability Required)
- [x] P6-3: 生产级回滚全流程演练 (Rollback Drill)
- [x] P6-4: 成本配额与熔断护栏验证 (Cost Guardrails)

## [/] Phase 7: Production Deployment Drill (Prod Drill)

- [ ] PLAN-P7-0: Establish P7 Runner & Adapter Contract
  - [x] Run `tools/run_p6_release_readiness.sh` and generate evidence
  - [ ] PLAN-P7-0: Establish P7 Runner & Adapter Contract
  - [x] Create `tools/run_p7_prod_deploy_drill.sh`
  - [x] Define adapter contract (blue/green deploy, cutover, rollback, healthcheck)
  - [ ] Implement adapters using env-driven logic (tools/deploy/\*.sh)
- [ ] PLAN-P6-2: Integrate with CI (GitHub Actions)
  - [x] Create CI workflow `required_p6_release_readiness.yml`
  - [x] Harden scripts (rollback trap, evidence index checksum)
  - [x] Use cross-platform checksum logic (sha256sum/shasum)
  - [x] Remove `|| true` from P6-1 for strict failure
  - [ ] Enable Branch Protection (User Action)
- [ ] PLAN-P7-1: Create Manual Trigger Workflow
  - [ ] Create `.github/workflows/p7_prod_deploy_drill.yml`

---

## 历史封存区块（ARCHIVED）

- [x] Phase 4: First Video (8K HEVC Delivery)
  - [x] P4-0.1: 生成 8K Master (Upscaled Lanczos)
  - [x] P4-0.2: 编码 8K HEVC (10-bit hvc1)
  - [x] P4-0.3: 执行 gate_p4_8k_hevc.sh 断言
  - [x] P4-1.1: 生成 Frame-level MD5 指纹
  - [x] P4-1.2: 注入 Metadata & 可见水印成片
  - [x] P4-1.3: 执行 gate_p4_ce09_security.sh 断言
  - [x] P4-2.1: 生成 DELIVERY_MANIFEST.json
  - [x] P4-2.2: 封箱存档并在 walkthrough.md 展示最终成果

```

```
