# STAGE1_OFFICIAL_SPECS_EXTRACT
基于提供的正式规范：  
- 《毛毛虫宇宙_数据库设计说明书_DBSpec_V1.1》  
- 《毛毛虫宇宙_API设计规范_APISpec_V1.1》  
- 《毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec_V1.1》  

> 仅为规格摘录，禁止按经验扩展或自行推断。未在文档中明确的类型/长度/级联，均标注为“未明确”，后续 EXECUTE 不得擅自补充。

---

## 1. DB Spec V1.1 摘要（Stage1 相关）

### 1.1 保留的 15 个实体
- users, organizations(orgs), projects, scenes, shots, shot_variants, video_jobs, tasks, worker_nodes, billing_plans, billing_records, assets, models, audit_logs, system_settings

### 1.2 新增实体（V1.1 扩展）
- characters：项目内角色实体（角色一致性）
- novel_volumes / novel_chapters / novel_scenes：长文本结构化
- memory_short_term / memory_long_term：故事记忆（短期摘要 + 长期图谱/向量）
- security_fingerprints：隐形水印指纹库

### 1.3 核心 ER 关系（Stage1 必须遵守）
- projects < scenes < shots < shot_variants < video_jobs
- projects < characters
- characters < novel_scenes（character_ids / 角色出现列表）
- novel_volumes < novel_chapters < novel_scenes
- novel_chapters < memory_short_term
- memory_long_term：全局级（entity_id + entity_type）
- assets 关联 projects（project_id），增强 HLS/水印字段
- audit_logs 关联 users（user_id）

### 1.4 关键表字段（仅列 V1.1 扩展/需校对部分）
- **projects**：title, status, settings_json（新增，项目级配置 JSON）
- **scenes**：project_id, index, title, summary, characters(角色ID列表语义，可 JSON 存储), visual_density_score (float/decimal), enriched_text (text)
- **shots**：scene_id, index, prompt, enriched_prompt (text), shot_type, camera_motion, duration, status
- **shot_variants**：consistency_score, visual_score（新增评分字段，其余沿用原有）
- **video_jobs**：security_processed (bool) 标记完成 HLS/水印安全流水线
- **tasks**：type, input(json), output(json), status, retries, worker_id（结构保持）
- **assets**：project_id, type, data(json), hls_playlist_url, signed_url, watermark_mode (visible/invisible), fingerprint_id (→ security_fingerprints.id)
- **audit_logs**：user_id, action, payload(json，含 resource_type/resource_id/ip/ua 等), nonce, signature, timestamp
- **characters**：project_id, name, description, reference_sheet_urls(json), embedding_id(?未明确), default_seed, traits(json)
- **novel_volumes**：project_id, index, title
- **novel_chapters**：volume_id, index, title, summary（由引擎生成）
- **novel_scenes**：chapter_id, index, raw_text, enriched_text, visual_density_score, character_ids(json)
- **memory_short_term**：project_id, chapter_id, summary, character_states(json)
- **memory_long_term**：entity_id, entity_type, vector_ref, metadata(json)
- **security_fingerprints**：id, asset_id, fp_vector(json), created_at
- **models / system_settings / worker_nodes / billing_plans / billing_records**：结构保持 V1.0，未见新增字段（本摘录未详列类型）

> 对于未在文档中明确类型/长度/默认值的字段，上述列表不补充推断。

### 1.5 索引策略（必须至少存在）
- shots(scene_id, index)
- scenes(project_id, index)
- tasks(status, created_at)
- worker_nodes(status)
- billing_records(user_id, created_at)
- novel_scenes(chapter_id, index)
- characters(project_id, name)
- assets(asset_id, watermark_mode)
- audit_logs(nonce, timestamp)

### 1.6 级联与数据一致性（文档明确处执行）
- scenes.characters 语义上需引用已存在的 characters.id（角色ID列表语义）
- novel_chapters.summary 由解析/记忆引擎生成（不可随意手改）
- video_jobs 完成后需进入媒体安全流水线并设置 security_processed=true
- 若文档未明确 onDelete/onUpdate：标注为“未定义级联行为，只要求不产生孤儿数据”

---

## 2. API Spec V1.1 安全与签名摘要

### 2.1 HMAC / Nonce / 时间窗 / 签名规则
- Header（强制）：`X-Api-Key`, `X-Nonce`, `X-Timestamp`, `X-Signature`
- 签名算法：`HMAC-SHA256(apiKey + nonce + timestamp + body)`
- 时间窗：允许 ±5 分钟，超时拒绝
- Nonce：Redis 等存储，5 分钟内不可重复；重复视为重放
- 错误码：  
  - 4003：签名不合法（HMAC 失败/头缺失/时间戳非法等）  
  - 4004：重放请求（Nonce 已存在）
- 扩展错误码（保留，不在 Stage1 强制）：4005 指纹生成失败，4006 HLS 加工失败，5003–5007 CE02–CE07 内容安全/解析失败

### 2.2 必须启用签名验证的接口范围（最小要求）
- Worker 相关：  
  - 获取 Job：如 POST `/api/workers/:workerId/jobs/next`（或等价路由）  
  - Job 回报告：如 POST `/api/jobs/:id/report`
- 需 GPU/敏感操作的接口：  
  - 引擎/渲染触发类（如分镜分析、图像/视频生成）  
  - 媒体安全：GET /assets/:assetId/secure-url, GET /assets/:assetId/hls, POST /assets/:assetId/watermark
- 说明：普通 Web CRUD（项目/层级管理）可不强制签名，但仍需 Auth/Permission

> 若文档按“类别”而非“具体路由”描述，以上为最小类别清单；后续 EXECUTE 不得擅自扩大或省略。

---

## 3. Safety Spec V1.1 审计摘要

### 3.1 audit_logs 字段要求
- 必填：user_id, action, payload(json: resource_type, resource_id, ip, ua, request_path/method 等), nonce, signature, timestamp
- 其他：risk_score / severity 如文档有范围要求，需遵守；若未给出类型/范围则标注未明确

### 3.2 必须审计的事件类型（示例，非封闭枚举）
- 登录 / 退出 / 密码修改
- Project / Season / Episode / Scene / Shot 创建/更新/删除
- 任务创建/执行、成本扣费
- 权限变更
- 小说导入（若已实现）
- API 签名失败（action 可用 "API_SIGNATURE_FAILED"）
- 解析/视觉评分/文本增强/水印指纹等 CE 相关事件（CE02–CE09），若已接入

> 文档未提供封闭枚举，要求使用稳定字符串常量，后续保持兼容。

---

## 4. 未明确事项
- 文档未明确的字段类型/长度/默认值/级联策略，禁止在 EXECUTE 阶段擅自补充或修改，仅可按文档已有信息对齐。
- 若遇到表或字段在代码中存在但文档未提及，需要在后续执行时标注为“非规范字段，需确认后再处理”，不得随意删除或扩展。

---

## 附录：提炼要点清单
- 表与字段：按 1.4 列举的扩展字段及新增表，索引按 1.5；未明确类型/长度需保持空白说明。  
- 签名规则：Headers = {X-Api-Key, X-Nonce, X-Timestamp, X-Signature}；HMAC-SHA256(apiKey+nonce+timestamp+body)；时间窗 ±5 分钟；Nonce 5 分钟内不可重复；4003/4004 错误码。  
- 审计：audit_logs 必含 user_id/action/payload/nonce/signature/timestamp（risk_score 等如文档有则遵守）；需审计登录/权限/CRUD/任务/成本/签名失败等事件，字符串常量保持稳定。  

---

本摘录为 Stage1 唯一参考规范，后续 EXECUTE 必须严格对齐，禁止超出或改写上述内容。 

