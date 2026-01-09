# STAGE1_DB_SCHEMA_DELTA_PLAN

PLAN-only，对比来源：

- 规范：`docs/STAGE1_OFFICIAL_SPECS_EXTRACT.md`（DB Spec V1.1 摘要）
- 现状（代码）：`packages/database/prisma/schema.prisma`
- 现状（DB 实际）：未检视（本批次不做 introspect / migrate）

> 禁止执行迁移或修改 schema，本文件仅记录差异与风险分类。凡规范标注“未明确”的字段/级联，保持未知状态，不提出具体变更方案。

---

## 0. 概览

- 涉及表：保留 15 + 新增 6（共 21 类，部分缺失）
- 主要差异类型统计（按字段/表维度粗粒度）：
  - ADD*SAFE：大量缺失表/字段/索引（characters、novel*\_、memory\_\_、security_fingerprints、shot_variants 等）
  - WIDEN_SAFE：未识别
  - TIGHTEN_RISKY：潜在非空/约束收紧（未细查数据，暂标潜在）
  - DROP_RISKY：Prisma 存在多余 AuditLog(重定义) 等，删除存在风险
  - UNKNOWN_SPEC_GAP：规范未给类型/级联的字段，保留为未知

---

## 1. 表级对比（规范 vs Prisma schema vs DB实际[未检]）

### users

- 规范：email, password_hash, name, timestamps。未明确更多字段/索引。
- Prisma：User 模型存在，字段包含 email/passwordHash 等；类型/索引未与规范逐项对齐。
- DB 实际：未检。
- 差异：缺“逐字段确认”，需后续核对大小写与默认值。风险：UNKNOWN_SPEC_GAP（规范未给长度/索引）。

### organizations / orgs

- 规范：基础组织信息；未给详细字段。
- Prisma：Organization 模型存在，含 name/ownerId/slug 等。
- DB 实际：未检。
- 差异：UNKNOWN_SPEC_GAP。

### projects

- 规范新增：settings_json（项目级配置 JSON）。
- Prisma：Project 未见 settings_json。
- DB 实际：未检。
- 差异：缺字段（ADD_SAFE）；类型/默认值未明确 → UNKNOWN_SPEC_GAP。

### seasons / episodes / scenes / shots

- 规范：五层级存在；scenes 需 characters(角色ID列表语义)、visual_density_score(float/decimal)、enriched_text(text)；shots 需 enriched_prompt。
- Prisma：Season/Episode/Scene/Shot 存在；已补充 Scene.characters/visualDensityScore/enrichedText，Shot.enrichedPrompt，Scene(projectId/index) 索引。
- DB 实际：未检。
- 差异：字段/索引已在 schema 补充（ADD_SAFE done）；级联未定义，保持“避免孤儿”。

### shot_variants

- 规范：存在表，需 consistency_score、visual_score 等。
- Prisma：ShotVariant 表已新增（id, shotId, data, consistencyScore, visualScore, timestamps）。
- DB 实际：未检。
- 差异：ADD_SAFE 已在 schema 补充；索引/外键未定义（规范未给，保持可选）。

### video_jobs

- 规范：security_processed(bool)。
- Prisma：VideoJob 表已新增（id, shotId, status, payload, securityProcessed, timestamps）。
- DB 实际：未检。
- 差异：ADD_SAFE 已在 schema 补充。

### tasks

- 规范：任务表，需索引 status, created_at。
- Prisma：Task 模型存在；已增加 @@index([status, createdAt]).
- DB 实际：未检。
- 差异：索引已补（ADD_SAFE done）；其他字段未逐项校对 → UNKNOWN_SPEC_GAP。

### worker_nodes

- 规范：索引 worker_nodes(status)。
- Prisma：WorkerNode 存在；已增加 @@index([status]).
- DB 实际：未检。
- 差异：索引已补（ADD_SAFE done）。

### billing_plans / billing_records

- 规范：billing_records(user_id, created_at) 索引。
- Prisma：未见 billing_plans/billing_records 模型（有 BillingEvent/CostCenter 等）。
- DB 实际：未检。
- 差异：缺表或命名不一致（ADD_SAFE / UNKNOWN_SPEC_GAP）；需对照 Spec 决定映射或新增。

### assets

- 规范：需 hls_playlist_url, signed_url, watermark_mode(visible/invisible), fingerprint_id。
- Prisma：Assets 表已新增（id, projectId?, type, data?, hlsPlaylistUrl, signedUrl, watermarkMode, fingerprintId, timestamps）。
- DB 实际：未检。
- 差异：ADD_SAFE 已在 schema 补充；枚举/关联未定义（规范未给，保持可选）。

### models / system_settings

- 规范：保持 V1.0，未新增字段。
- Prisma：ModelRegistry 存在；system_settings 缺失（未处理，仍属 ADD_SAFE 待补）；命名映射未调整。
- 差异：system_settings 缺失（未处理）；命名差异 UNKNOWN_SPEC_GAP。

### audit_logs

- 规范：必含 nonce, signature, timestamp, payload(resource_type/resource_id/ip/ua/path/method...) 等。
- Prisma：audit_logs 模型已增加 nonce/signature/timestamp、索引(nonce,timestamp)；legacy audit_log 模型已 @@ignore (重命名为 AuditLogLegacy)。
- DB 实际：未检。
- 差异：ADD_SAFE 部分完成；重复模型仍存在（DROP_RISKY，未处理）。

### characters

- 规范：project_id, name, description, reference_sheet_urls(json), embedding_id, default_seed, traits(json)。
- Prisma：Character 表已新增（字段均可选，index(projectId,name)）。
- DB 实际：未检。
- 差异：ADD_SAFE 已补；类型/长度未明确 → UNKNOWN_SPEC_GAP 保持可选。

### novel_volumes / novel_chapters / novel_scenes

- 规范：卷/章/场景结构；novel_chapters.summary 必由引擎生成；novel_scenes.raw_text/enriched_text/visual_density_score/character_ids。
- Prisma：新增 NovelVolume, NovelScene；NovelChapter 已存在（差异未细核，保留 UNKNOWN_SPEC_GAP）。
- DB 实际：未检。
- 差异：ADD_SAFE 已补（volumes/scenes）；chapters 差异未处理（UNKNOWN_SPEC_GAP）。

### memory_short_term / memory_long_term

- 规范：短期摘要（project_id, chapter_id, summary, character_states）；长期图谱/向量（entity_id, entity_type, vector_ref, metadata）。
- Prisma：MemoryShortTerm / MemoryLongTerm 已新增。
- DB 实际：未检。
- 差异：ADD_SAFE 已补。

### security_fingerprints

- 规范：id, asset_id, fp_vector(json), created_at。
- Prisma：SecurityFingerprint 已新增。
- DB 实际：未检。
- 差异：ADD_SAFE 已补。

### models (模型注册)

- 规范：表名 models；Prisma：model_registry（ModelRegistry）。
- 差异：命名不一致（ADD_SAFE/UNKNOWN_SPEC_GAP）；需决定是否映射或新增符合命名的表。

### system_settings

- 规范：表存在；Prisma 未发现。
- 差异：缺表（ADD_SAFE）。

---

## 2. 风险与建议（PLAN-only）

- ADD_SAFE（可空字段/新增索引/新增表，向后兼容）：
  - 新增表：characters, shot_variants, video_jobs, novel_volumes, novel_scenes, memory_short_term, memory_long_term, security_fingerprints, system_settings, assets, billing_plans/billing_records(或映射) 等。
  - 新增字段：projects.settings_json；scenes.characters/visual_density_score/enriched_text；shots.enriched_prompt；assets.hls_playlist_url/signed_url/watermark_mode/fingerprint_id；audit_logs.nonce/signature/timestamp；tasks/status+createdAt索引；worker_nodes(status)索引；audit_logs(nonce,timestamp)索引等。
- WIDEN_SAFE：未识别。
- TIGHTEN_RISKY（非空/约束收紧，可能与现有数据冲突）：
  - 若按规范需非空或特定外键级联，现状未验证；暂不提出收紧方案。
- DROP_RISKY：
  - 重复/不规范模型：双 AuditLog 定义（audit_log 与 audit_logs）；删除或合并可能影响现有数据，需谨慎。
- UNKNOWN_SPEC_GAP：
  - 规范未给类型/长度/级联的字段（多数新增表字段）；执行前需补充或保持兼容类型（可选、可空）。

---

## 3. 后续执行建议（不在本批次实施）

1. 先行 ADD_SAFE：新增缺表/缺字段/缺索引，保持可空与向后兼容；合并 AuditLog 结构时保留数据。
2. 数据确认后再处理 TIGHTEN_RISKY：非空/级联/唯一性等收紧操作需结合数据检查。
3. DROP_RISKY（如重复 AuditLog）需先备份并迁移数据再合并，避免丢失。
4. 对 UNKNOWN_SPEC_GAP 字段，在获取确切类型/长度前，保持可空、宽类型（Json/Text/String）以保证兼容。

---

## 4. 本计划输出

- 文档路径：`docs/STAGE1_DB_SCHEMA_DELTA_PLAN.md`
- 现状：未对数据库执行任何变更；DB 实际结构未检视，需在后续 EXECUTE 阶段以只读方式确认再分批处理。
