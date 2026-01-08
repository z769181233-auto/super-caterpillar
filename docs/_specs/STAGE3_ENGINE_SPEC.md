# Stage 3 AI Engine System Specification (V1.0)

> [!IMPORTANT]
> **目标**：彻底消除系统中的 Mock/Stub 实现，建立基于真实 AI 语义分析与高质量渲染的生产闭环。
> **原则**：真实输出、幂等执行、全审计覆盖。

---

## 1. CE06: 小说结构语义解析引擎

**职责**：将原始小说文本转化为具有分镜深度、导演意图的 Scene / Shot 结构树。

### 输入 Schema (Novel Input)
```json
{
  "novelSourceId": "uuid",
  "projectId": "uuid",
  "options": {
    "llm_model": "gemini-2.0-flash",
    "depth": "cinematic"
  }
}
```

### 预期输出 (Real Insight)
1. **Scene**: 必须包含语义化的 `summary` 和 `index`。
2. **Shot**: 
    - `type`: 必须是 `wide_shot`, `close_up` 等真实类型。
    - `params`: 必须包含 `lighting`, `mood`, `visual_density` 等真实参数。
    - `enrichedPrompt`: 必须是可供 Stable Diffusion / Midjourney 使用的描述。

---

## 2. CE03 & CE04: 视觉密度与增强引擎

**职责**：基于语义内容计算画面复杂度并进行视觉风格增强。

### 验收标准 (DoD)
- **CE03**: 指标必须反映文本内容的词汇密度与光线描述，而非简单的随机数。
- **CE04**: 产出的 `qualityMetrics` 必须包含真实的 `enrichmentQuality` 评分。

---

## 3. SHOT_RENDER: 分镜预览生成

**职责**：根据 `enrichedPrompt` 生成真实的镜头预览图（或黑盒 API 调用结果）。

### 验收标准 (DoD)
- ❌ **禁止**：生成纯黑色占位 PNG。
- ✅ **必须**：集成真实渲染服务，或产生具有视觉特征的合成图像。

---

## 4. 异常处理与计费点

| 引擎 | 错误码 (Stage 3) | 计费计量单位 | 成本 (预估) |
| :--- | :--- | :--- | :--- |
| CE06 | `E06_SEMANTIC_FAIL` | 1,000 Tokens | $0.01 |
| CE03 | `E03_DENSITY_FAIL` | 1 Shot | $0.005 |
| CE04 | `E04_ENRICH_FAIL`  | 1 Shot | $0.005 |
| RENDER | `ER_GFX_CRASH`    | 1 Render | $0.02 |

---

## 5. 门禁验证 (Gate Specs)

### Gate-0: Mock Audit
- **指标**：`MockCount == 0` (在 Stage 3 全量 Close 时)。
- **规则**：任何带有 `Mock/Stub` 认定的代码必须在 `GAP_REPORT.md` 中注册。

### Gate-Real: CE06 Real Closure
- **指标**：`SceneCount > 0 && ShotCount > 0` 且 `enrichedPrompt` 长度 > 20。
