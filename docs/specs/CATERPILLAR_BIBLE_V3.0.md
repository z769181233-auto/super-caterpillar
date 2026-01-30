# 毛毛虫宇宙 (Animation OS) · 原子级开发执行手册

## The Caterpillar Implementation Bible V3.0

**密级**：绝密 (Top Secret)  
**版本**：V3.0.1 (Code-Ready Build)  
**目标读者**：后端架构师、核心开发工程师、DBA  
**执行标准**：严格遵守以下数据结构与接口定义，禁止擅自更改字段名。

---

## 第一部分：核心数据库物理设计 (Database Physical Design)

**数据库选型**：PostgreSQL 15+ (主库), PGVector (向量库), Redis 7 (缓存), Neo4j (图数据库)

### 1.1 故事宇宙 (Story Universe) 表结构

```sql
-- 1. 小说主表 (novels)
CREATE TABLE novels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, -- 归属项目
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100),
    raw_file_url TEXT NOT NULL, -- S3 原始文件地址
    total_tokens BIGINT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'UPLOADING', -- UPLOADING, PARSING, PARSED, FAILED
    metadata JSONB, -- {"genre": "玄幻", "style_preset": "anime_v3"}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_novels_project ON novels(project_id);

-- 2. 章节表 (novel_chapters)
CREATE TABLE novel_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    volume_index INT DEFAULT 1, -- 卷号
    chapter_index INT NOT NULL, -- 章号
    title VARCHAR(255),
    raw_content TEXT, -- 章节原文
    summary_vector VECTOR(1536), -- 章节摘要向量 (OpenAI Embedding)
    visual_density_score DECIMAL(5,2), -- 视觉密度分 (0-100)
    parsed_at TIMESTAMPTZ
);
CREATE INDEX idx_chapters_novel_idx ON novel_chapters(novel_id, chapter_index);

-- 3. 场次表 (scenes) - 核心生成单元
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES novel_chapters(id),
    scene_index INT NOT NULL,

    -- 核心解析数据
    location_slug VARCHAR(255), -- "EXT. 废弃工厂 - NIGHT"
    time_of_day VARCHAR(20), -- DAY, NIGHT, DAWN, DUSK
    environment_tags TEXT[], -- ["rainy", "cyberpunk", "ruins"]

    -- AI 扩写数据
    raw_text TEXT, -- 原文片段
    enriched_text TEXT, -- 视觉增强后的文本 (用于生成)

    -- 状态与上下文
    graph_state_snapshot JSONB, -- {"characters": [{"id": "...", "status": "injured"}]}
    visual_density_score DECIMAL(5,2),

    status VARCHAR(50) DEFAULT 'PENDING' -- PENDING, GENERATING_SHOTS, READY
);

-- 4. 分镜表 (shots) - 渲染指令集
CREATE TABLE shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id),
    sequence_no INT NOT NULL, -- 镜头序号

    -- 导演控制参数
    shot_type VARCHAR(50), -- CLOSE_UP, MEDIUM_SHOT, LONG_SHOT, EXTREME_CLOSE_UP
    camera_movement VARCHAR(50), -- PAN_LEFT, ZOOM_IN, STATIC, TRACKING
    camera_angle VARCHAR(50), -- LOW_ANGLE, HIGH_ANGLE, EYE_LEVEL
    lighting_preset VARCHAR(50), -- CINEMATIC, NATURAL, NEON, REMBRANDT

    -- 生成提示词
    visual_prompt TEXT NOT NULL, -- 发送给 SD 的最终 Positive Prompt
    negative_prompt TEXT,

    -- 脚本内容
    action_description TEXT, -- 画面动作描述
    dialogue_content TEXT, -- 对白
    sound_fx TEXT, -- 音效提示

    -- 资产绑定 (核心一致性逻辑)
    asset_bindings JSONB, -- [{"char_id": "xxx", "lora": "path/to/lora", "weight": 0.8}]
    controlnet_settings JSONB, -- {"pose_image": "s3://...", "depth_map": "s3://..."}

    -- 渲染状态
    render_status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, QUEUED, RENDERING, DONE, FAILED
    result_image_url TEXT, -- 关键帧地址
    result_video_url TEXT, -- 视频片段地址

    duration_sec DECIMAL(4,2) DEFAULT 3.0 -- 镜头时长
);

-- 5. 角色三视图 (character_triviews) - G5 法律必需件
CREATE TABLE character_triviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    front_url TEXT NOT NULL,
    side_url TEXT NOT NULL,
    back_url TEXT NOT NULL,
    mapping_json JSONB, -- {"pivot": {"x": 0.5, "y": 0.95}}
    status VARCHAR(50) DEFAULT 'ACTIVE'
);
```

---

## 第 1.5 部分：G5 生产法律 (G5 Production Laws - Hardened)

> [!CAUTION]
> **法律地位**：以下规则高于任何引擎逻辑。不满足以下条件的输出一律不得称为“视频”。

1.  **Gate-0: 视频存在性法律**
    - **帧率 (FPS)**：必须固定为 24.0 (严格)。
    - **帧数连续性**：`nb_frames` 必须精确等于 `duration * 24`。
    - **分辨率**：垂直分辨率必须达到 **1440p+** (Cinema High-Fi)。
    - **封装**：必须为标准 MP4 (H.264 High Profile 4.1 + AAC)。

2.  **资产先行原则 (Asset-First Priority)**
    - **三视图必需性**：任何角色在进入 G5 渲染前，必须产出合规的三视图（Front/Side/Back）。严禁使用单视图拉伸。
    - **地面锚定 (Grounding)**：角色必须具备逻辑阴影（Logical Shadow），严禁“贴纸式”悬浮。

3.  **视角路由法律 (View Routing)**
    - 视频生成必须支持相机角度驱动的视角切换。
    - 在 `Orbit` 或 `Tracking` 镜头下，必须检测分界角度（如 45°）并物理切换资产文件。

---

## 第二部分：70+ 核心引擎 I/O 协议 (Engine Universe I/O Specs)

Engine Service 是一个微服务网关，每个引擎都是一个独立的 API 端点。

### 2.1 故事智能类 (Story Intelligence)

**CE01: Novel Parsing Engine (小说递归解析引擎)**

- **Input**:
  ```json
  {
    "text_chunk": "...", // 约 5000 tokens
    "prev_context": "..." // 上文摘要
  }
  ```
- **Output**:
  ```json
  {
    "scenes": [
      {
        "start_line": 10,
        "end_line": 45,
        "location": "INT. TAVERN - NIGHT",
        "characters": ["Xiao Yan", "Nalan"],
        "events": "Nalan cancels the engagement."
      }
    ]
  }
  ```

**CE02: Visual Density Engine (视觉密度引擎)**

- **Input**: `{"text": "..."}`
- **Output**:
  ```json
  {
    "score": 35.5,
    "breakdown": { "nouns": 12, "verbs": 4, "adjectives": 2 },
    "verdict": "LOW_DENSITY" // 触发 CE03
  }
  ```

**CE03: Auto Enrichment Engine (自动扩写引擎)**

- **Input**: `{"raw_text": "他很生气", "style": "Xianxia"}`
- **Output**: `{"enriched_text": "他额头上青筋暴起，拳头紧握，指甲深深嵌入掌心，周身斗气激荡，震碎了脚下的青石板。"}`

### 2.2 导演控制类 (Director Control)

**CE11: Shot Generator (分镜生成引擎)**

- **Input**: `{"scene_description": "...", "style_preset": "Cyberpunk"}`
- **Output**: (List of Shot Objects matching the shots table structure)

**CE23: Face Identity Engine (人脸一致性引擎)**

- **Input**:
  ```json
  {
    "target_image": "base64_image",
    "reference_faces": ["s3://face1.jpg", "s3://face2.jpg"],
    "strength": 0.8
  }
  ```
- **Output**: `{"processed_image": "base64_image"}` (Result with swapped/fixed face)

### 2.3 渲染与后期类 (Render & Post)

**CE33: Job Split Engine (任务拆分引擎)**

- **Input**: `{"total_frames": 120, "max_frames_per_worker": 30}`
- **Output**:
  ```json
  [
    { "slice_id": 0, "frame_start": 0, "frame_end": 29 },
    { "slice_id": 1, "frame_start": 30, "frame_end": 59 },
    ...
  ]
  ```

**CE34: Frame Merge Engine (帧合并引擎)**

- **Input**: `{"slice_urls": ["s3://video_0.mp4", "s3://video_1.mp4", ...], "transition": "crossfade"}`
- **Output**: `{"merged_video_url": "s3://final_result.mp4"}`

---

## 第三部分：API 接口详述 (API Reference)

**Base URL**: `https://api.caterpillar.ai/v3`
**Authentication**: Headers 必须包含 `X-Signature` (HMAC-SHA256)。

### 3.1 故事解析 (Story Parsing)

- **POST /story/parse**
  - Desc: 提交小说解析任务（异步）。
  - Body:
    ```json
    {
      "project_id": "uuid",
      "file_url": "s3://uploads/novel.txt",
      "config": {
        "extract_characters": true,
        "style_guide": "anime_standard"
      }
    }
    ```
  - Response: `202 Accepted, {"job_id": "job_123"}`

- **GET /story/job/{job_id}**
  - Desc: 轮询解析进度。
  - Response:
    ```json
    {
      "status": "PROCESSING",
      "progress": 45,
      "current_step": "CE01_PARSING_CHAPTER_5",
      "result_preview": null
    }
    ```

### 3.2 镜头生成与编辑 (Shot Operations)

- **POST /shot/batch-generate**
  - Desc: 为一个 Scene 生成初版分镜表。
  - Body: `{"scene_id": "uuid", "count": 10}`
  - Response: `{"shots": [ ... ]}` (Returned immediately or async id)

- **POST /shot/{id}/render**
  - Desc: 提交单个镜头的视频渲染任务。
  - Body:
    ```json
    {
      "use_turbo_mode": true, // 使用 H100
      "aspect_ratio": "16:9",
      "duration": 4.0
    }
    ```

### 3.3 资产管理 (Assets)

- **POST /asset/train-lora**
  - Desc: 上传图片集训练角色 LoRA。
  - Body: `{"images": ["url1", "url2"], "trigger_word": "xiao_yan"}`

---

## 第四部分：核心算法伪代码 (Core Algorithms)

### 4.1 递归上下文注入算法 (Recursive Context Injection)

用于解决 LLM 遗忘问题的核心逻辑：

```python
class StoryProcessor:
    def process_chapter(self, chapter_text, chapter_index):
        # 1. 获取长期记忆 (Vector Search)
        # 搜索全书中与当前章节文本语义最相似的 5 个历史片段
        long_term_memory = VectorDB.search(
            query=chapter_text[:500],
            collection="novel_summaries",
            top_k=5
        )

        # 2. 获取短期记忆 (Sliding Window)
        # 获取前一章的摘要
        short_term_memory = DB.get_summary(chapter_index - 1)

        # 3. 获取实体状态 (Graph Query)
        # 查询当前章节出现的角色的最新状态 (如：是否拿着剑？)
        characters = extract_entities(chapter_text)
        entity_states = GraphDB.get_properties(characters)

        # 4. 构建 Prompt
        system_prompt = f"""
        You are parsing Chapter {chapter_index}.

        CONTEXT FROM PREVIOUS CHAPTERS:
        {short_term_memory}

        RELEVANT HISTORY:
        {long_term_memory}

        CHARACTER CURRENT STATUS:
        {entity_states}

        TASK:
        Split the following text into Scenes. Ensure continuity of clothing and items.
        """

        return LLM.generate(system_prompt, chapter_text)
```

---

## 第五部分：前端组件规范 (Frontend Specs)

**技术栈**: React 18, Zustand (State), TanStack Query (API), Three.js (3D Preview optional)

### 5.1 核心组件树

- `Layout`: Sidebar (Nav), Header (User/Credits), Main Content
  - `StudioView` (Route: `/studio/:projectId`)
    - `ScriptPanel` (Left, 30% width): 显示小说原文，高亮当前 Scene。
    - `ShotWall` (Center, 50% width): 核心组件。
      - `VirtualList`: 渲染 `ShotCard` 组件列表。
      - `ShotCard`: 显示关键帧、Prompt、状态。支持 Drag & Drop 排序。
    - `DirectorPanel` (Right, 20% width): 编辑当前选中 Shot 的参数。
      - `PromptInput`: 文本域。
      - `ControlNetSelector`: 下拉选框 (OpenPose/Canny)。
      - `InpaintCanvas`: 简单的 HTML5 Canvas 涂抹工具。

---

## 第六部分：开发阶段规划 (Development Stages)

交给 Antigravity 的排期建议：

1.  **Week 1-2 (Foundation)**:
    - 搭建 K8s 集群，部署 PostgreSQL, Redis, MinIO (S3 compatible)。
    - 实现 User Permission System (V3.0 Spec File 16)。
    - 实现 Novel Upload & Parsing (CE01) 基础版。
2.  **Week 3-4 (The Brain)**:
    - 开发 Story Intelligence 模块：VectorDB 集成，Context Injection 算法。
    - 实现 Visual Density Engine (CE02)。
3.  **Week 5-6 (The Eye)**:
    - 开发 Shot Generator (CE11)。
    - 前端实现 Studio ShotWall 原型。
4.  **Week 7-8 (The Hands)**:
    - 集成 ComfyUI 到 WorkerPool。
    - 实现 Worker 调度与心跳机制。
    - 跑通 "Text -> Parsing -> Shot -> Image Generation" 全链路。
