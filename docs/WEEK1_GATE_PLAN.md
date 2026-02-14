# Week 1 引擎真化门禁设计 (Draft)

> 目标：将“引擎真化”工作拆解为可门禁验收的小步，避免大爆炸式集成。

## Phase D1: 真引擎最小闭环 (Single Shot)

**Scope**: 仅覆盖 单镜头/单 Shot 场景，暂不涉及复杂的时间轴编排。

## Phase D2: 轻量级验收 Gate (Code Name: `gate_engine_sanity.sh`)

**接入**: `tools/gate/gates/gate_engine_sanity.sh`
**断言项**:

1.  **非占位符检测**: 输出视频文件大小 > 100KB (排除 0KB 或仅 Metadata 文件)。
2.  **非黑屏检测**: 抽取关键帧 (e.g., middle frame) 并非全黑。
    - 工具: `ffmpeg -i output.mp4 -vf "blackdetect=d=0.1:pix_th=0.1" ...` 或简单抽取缩略图校验大小。
3.  **帧数一致性**: 实际帧数 (Frame Count) == 预期 duration \* fps。
4.  **可播放性**: `ffprobe` 无报错，metadata 完整。

## Phase D3: 接入 run_launch_gates.sh

**策略**:

- **Local**: Optional (默认跳过，需 `ENGINE_REAL=1`)
- **Staging**: Required (必须通过)
- **位置**: 放置在 `Gate 13 (ShotRender)` 之后，或者替代当前的 Mock Check。

## Phase D4: 证据产出 (Evidence Chain)

**Artifacts**:

- `video_hash.txt`: 输出视频的 SHA256。
- `ffprobe_report.json`: 视频元数据报告。
- `black_frame_check.log`: 黑屏检测日志。
- `render_params.json`: 输入给 ComfyUI/Engine 的参数快照。
