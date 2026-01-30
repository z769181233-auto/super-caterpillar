# G5_DIALOGUE_BINDING_SPEC: 对白绑定引擎规范

> **状态**：DRAFT (G5-P0)
> **适用版本**：G5+ Content Leap

## 1. 核心目标

将小说 Beat 中的对白/旁白精准映射到视频分镜（Shots）中，确保视频在听觉与文字层面的连贯性。

## 2. 强制性红线 (Mandatory Redlines)

1. **[100% COVERAGE]**: 每个 Story Beat 对应的时间区间内，必须至少存在一条对白或旁白记录。
2. **[NO OVERLAP]**: 同一时刻同一个角色不得重叠对白。
3. **[TIMING BUFFER]**: 对白开始时间应晚于 Shot 开始时间至少 0.5s，结束时间应早于 Shot 结束时间至少 0.5s，以避免视觉切换导致的听觉突兀。
4. **[NARRATION FALLBACK]**: 若 Beat 无显式对白（Speaker ID 缺失），引擎必须自动生成旁白（Narration），Speaker ID 统一标记为 `NARRATOR`。

## 3. 数据契约 (Data Contract)

### 3.1 输入 (Input)

```json
{
  "episode_id": "string",
  "beats": [
    { "id": "beat-1", "speaker": "CH_XueZhiYing", "text": "对白文字", "duration_sec": 5.0 }
  ],
  "shots": [{ "id": "shot-1", "beat_id": "beat-1", "start_sec": 0.0, "duration_sec": 7.5 }]
}
```

### 3.2 输出 (Output)

```json
{
  "dialogue_plan": [
    {
      "shot_id": "shot-1",
      "speaker": "CH_XueZhiYing",
      "text": "对白文字",
      "start_sec": 0.5,
      "end_sec": 5.5
    }
  ]
}
```

## 4. 验收标准

- **Gate-Dialogue-Coverage**: 扫描全片，若存在 3s 以上的“对白真空期”（且非导演刻意留白），则判定不合规。
