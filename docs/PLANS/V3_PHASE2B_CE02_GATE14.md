# PLAN: V3.0 Phase 2b - CE02 (Visual Density) Integration

## ✅ 已完成 (Audit by PLAN-0)

- [x] **SSOT 确认**: `novel_scenes` (Product) + `shots` (Product) + `novel_chapters`.
  - [describe_novel_chapters.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/v3_phase2b_ce02_plan0_20260118_140131/describe_novel_chapters.txt)
  - [describe_novel_scenes.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/v3_phase2b_ce02_plan0_20260118_140131/describe_novel_scenes.txt)
  - [describe_shots.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/v3_phase2b_ce02_plan0_20260118_140131/describe_shots.txt)
- [x] **增量字段到位**:
  - `novel_chapters`: `visual_density_score` (nullable)
  - `novel_scenes`: `visual_density_score` (nullable)
  - `shots`: V3.0 nullable fields (visual_prompt, negative_prompt, etc.)
- [x] **现有实现点定位**:
  - Processor: `CE03_VISUAL_DENSITY` ([rg_worker_density_processors.txt](file:///Users/adam/Desktop/adam/毛毛虫宇宙/Super%20Caterpillar/docs/_evidence/v3_phase2b_ce02_plan0_20260118_140131/rg_worker_density_processors.txt))
  - Adapter: `visual-density.adapter.ts`
- [x] **协议对齐**: `CE01ProtocolAdapter` 已集成至 `CE06_NOVEL_PARSING`.
- [x] **Gate PASS**: Gate 11/12/13 已 PASS.

## ⬜ 待完成 (PLAN-1: CE02 Implementation)

- [ ] **1.1 设计定稿**:
  - **Input**: `{ "text": string }`
  - **Output**: `{ "score": number, "breakdown": object, "verdict": string }`
  - **复用方案**: `CE02_FACADE` -> `processCE03VisualDensityJob`
- [ ] **1.2 写库逻辑**:
  - 更新 `novel_chapters.visual_density_score`
  - 更新 `novel_scenes.visual_density_score`
  - 持久化 Meta: 优先复用 `analysis_json` (若存在) 或新增 `visual_density_meta` (JSONB NULL)
- [ ] **1.3 Processor 落地**: `ce02-visual-density.processor.ts`

## ⬜ 待完成 (PLAN-2: Gate 14)

- [ ] **2.1 创建 Gate 14**: `tools/gate/gates/gate-ce02-visual-density.sh`
- [ ] **2.2 验证与归档**:
  - 证据目录: `docs/_evidence/gate14_ce02_<ts>/`

## ⬜ 待完成 (PLAN-3: 回归与封签)

- [ ] **3.1 集成门禁**: `run_launch_gates.sh`
- [ ] **3.2 全量回归**: Gate 1-14 PASS
- [ ] **3.3 封签**: Tag `seal/v3_phase2b_ce02_gate14_<YYYYMMDD>`

---

**Audit Evidence Root**: `docs/_evidence/v3_phase2b_ce02_plan0_20260118_140131/`
