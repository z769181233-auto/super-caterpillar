# SCRIPT_SPEC_SSOT.md

> **Super Caterpillar / 毛毛虫宇宙**
> **Script Specification Single Source of Truth**

---

### 1.1 核心约束
- **时间一致性**: 所有 Beat 的 `estDurationSec` 之和必须等于 `episodeMeta.durationSec` (允许误差 **±5秒**)。**[P0 强制]**
- **四段式动作**: 每个 `shotLine` 必须显式标记 `(起势)(过程)(落点)(反应)`。
所有脚本产出（人写或 AI 写）必须符合本规范定义的字段结构与约束。
**Gate P0 Lint** 将依据本规范进行强制校验。

---

## 2. StorySpec (上游事件设计)

> 目的：确立单集核心事件与戏剧驱动力。不允许直接进入生产，需转化为 ShotSpec。

### 结构定义
| 字段 | 类型 | 说明 | 约束 |
| :--- | :--- | :--- | :--- |
| `episodeMeta` | Object | 单集元数据 | - |
| &nbsp;&nbsp;`episodeNo` | String | 集号 | e.g., "E0001" |
| &nbsp;&nbsp;`durationSec` | Number | 预计时长(秒) | **300 - 480** (5-8分钟) |
| &nbsp;&nbsp;`targetAudience` | String | 目标受众 | e.g., "青少年", "悬疑爱好者" |
| &nbsp;&nbsp;`styleTag` | String | 风格标签 | e.g., "赛博朋克", "心理惊悚" |
| `coreEvent` | String | 一句话核心事件 | **禁止情绪形容词**，陈述事实 |
| `goal` | String | 核心欲望 | 主角本集要达成什么 |
| `obstacles` | Array\<String\> | 阻碍 | **≥3+1** (物理/人际/内心/反噬代价) |
| `turns` | Array\<String\> | 剧情翻转点 | **3-4个** (必须是可拍的“状态变化动作”) |
| `cliffhanger` | String | 结尾钩子 | 新问题出现 (动作/物件/证据) |

---

## 3. ShotSpec (下游施工图)

> 目的：严格指导拍摄与渲染的工业指令集。

### 结构定义
此结构由根部的 `episodeMeta` 和子项 `beats` 数组组成。

#### episodeMeta (元数据)
| 字段 | 类型 | 说明 | 约束 |
| :--- | :--- | :--- | :--- |
| `durationSec` | Number | 集预计时长(秒) | **必填 (300-480)** |

#### Beat (节拍)
| 字段 | 类型 | 说明 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | String | Beat ID | e.g., "beat_01" |
| `paceTag` | String | 节奏标签 | 枚举: `"快"`, `"常"`, `"慢"` |
| `estDurationSec` | Number | 预估时长(秒) | **必填**。快(5-20), 常(15-60), 慢(20-90) |
| `beatGoal` | String | 情绪目的 | **必须用动词** (e.g., "逼他认错", "让她退缩") |
| `sfxLines` | Array\<String\> | 音效/氛围音 | **Length ≥ 1** |
| `thirdActorProp` | String | 第三演员(道具) | **必须非空**，禁止泛化词 (道具/物品) |
| `foreground` | String | 前景 | 可选 |
| `background` | String | 后景 | 可选 |
| `shotRelation` | String | 空间/镜头关系 | e.g., "OTS", "Eyeline Match" |
| `transitionTag` | String | 转场逻辑 | 枚举: `"声音匹配"`, `"动作匹配"`, `"光影匹配"`, `"画面匹配"`, `"物件匹配"` |
| `reversalTag` | Boolean | 是否反转 | P1 评分项 (≥3/集) |
| `climaxTag` | String | 爆点标签 | 枚举: `"Big"`, `"Small"`, `null` |
| `shotLines` | Array\<SimpleShot\> | 镜头行列表 | **Length > 0** |

#### ShotLine (镜头行 - 最小单位)
| 字段 | 类型 | 说明 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | String | 镜头 ID | 递增 (e.g., "S001") |
| `framing` | String | 景别 | 枚举: `"特写"`, `"中景"`, `"全景"`, `"OTS"`, `"大特写"` |
| `subject` | String | 主体 | 画面核心 |
| `actionChain` | String | 四段式动作 | **必须包含标记：(起势)(过程)(落点)(反应)** |
| `parallelTask` | String | 并行任务 | **非空** (说话时手里的动作，禁止站桩) |
| `dialogue` | String | 台词 | 可选，**单句 ≤ 15 字**，支持 `(打断)` `(抢白)` 标记 |

---

## 4. 工业参数 (Industrial Parameters)

为 5–8 分钟短剧重标定：

- **字数容量**: 1500 – 2600 字 / 集 (ShotSpec 文本等价)
- **镜头预算**: 140 – 260 个 / 集 (所有 Beats 下 shotLines 总和)
- **视觉密度**:
    - **快区**: 40–70 镜头/分
    - **常速**: 20–35 镜头/分
    - **慢区**: 10–18 镜头/分
- **反转频率**: 每 2 分钟 ≥ 1 次 (5–8分钟 ≈ ≥3次)
- **爆点要求**: ≥ 1 大爆点 + ≥ 4 小爆点 (需在 Beat 或 Shot 级显式标注)

---

## 5. 最小示例 (Minimal Example)

```json
{
  "beats": [
    {
      "id": "beat_01",
      "paceTag": "快",
      "beatGoal": "逼他交出密钥",
      "sfxLines": ["急促的警报声", "金属摩擦声"],
      "thirdActorProp": "生锈的扳手",
      "transitionTag": "动作匹配",
      "shotLines": [
        {
          "id": "S001",
          "framing": "特写",
          "subject": "Adam的手",
          "actionChain": "Adam猛地抓起扳手(起势)，用力砸向控制台(过程)，火花四溅(落点)，他手微微颤抖(反应)。",
          "parallelTask": "一边砸一边盯着屏幕读数",
          "dialogue": "给我停下！(打断)"
        },
        {
          "id": "S002",
          "framing": "中景",
          "subject": "Eve",
          "actionChain": "Eve后退半步(起势)，撞倒椅子(过程)，扶住桌角稳住重心(落点)，惊恐地看向Adam(反应)。",
          "parallelTask": "把数据盘藏在身后",
          "dialogue": "你疯了，系统会崩溃的。"
        },
        {
          "id": "S003",
          "framing": "全景",
          "subject": "二人对峙",
          "actionChain": "警报灯光疯狂闪烁(起势)，将两人影子拉长并交错(过程/落点)，红光映在两人脸上(反应)。",
          "parallelTask": "环境动作",
          "dialogue": ""
        }
      ]
    }
  ]
}
```
