# G5 封板后红线禁令 (Post-Sealing Redlines)

> **版本**：1.0  
> **适用范围**：G5 生产管线及其后续扩展  
> **法律效力**：所有违反以下红线的行为将导致 Gate 强制失败。

## 🚫 十大禁令 (The 10 No-Go Zones)

1.  **禁令 1：严禁无视频宣称成功**
    - 任何未产生 `ffprobe` 合规视频的引擎报告。一律不得标记为“已完成”。代码逻辑完成不代表生产能力达成。

2.  **禁令 2：严禁修改 Gate-0 宪法**
    - 24fps、1440p+、nb_frames 连续性是 G5 的物理底线。严禁为了适配临时低配环境而下调 these 硬指标。

3.  **禁令 3：严禁“顺手”补引擎 (No Speculative Expansion)**
    - 在 E0002-E0010 稳定性未经过肉眼审计前，严禁新增任何不属于 E0001 核心链路的引擎（如：特效、换装、高级转场）。

4.  **禁令 4：资产先行不可逆 (Asset-First Only)**
    - 严禁在三视图（Front/Side/Back）缺失的情况下强行进入渲染环节。产线必须在入口处检测资产完整性。

5.  **禁令 5：禁止单图伪视角 (No Single-View Stretching)**
    - 严禁通过单张图片拉伸、扭曲来模拟视角变化。Orbit 镜头必须通过资产路由（View Routing）实现物理切换。

6.  **禁令 6：零漂移红线 (Zero-Drift Enforcement)**
    - 所有标明为 `isStanding` 的镜头，其 `verticalDrift` 必须为 0。严禁出现角色脚部轻微悬浮或滑步。

7.  **禁令 7：逻辑阴影必选 (Mandatory Grounding)**
    - 严禁交付无阴影的角色图层。阴影必须作为空间锚定的关键件随角色资产一同加载。

8.  **禁令 8：全量审计原则 (Full Audit Trail)**
    - 每一段渲染视频必须随附 `g5_render_manifest.json`，记录每一帧的视角路由事实。禁止黑盒产出。

9.  **禁令 9：严禁非标封装 (Container Integrity)**
    - 禁止任何非 MP4 (H.264+AAC) 的交付物。所有的“视频”必须能被标准播放器直接流畅拖拽。

10. **禁令 10：SSOT 绝对权威**
    - 任何引擎的变更必须先修改 `ENGINE_MATRIX_SSOT.md`。禁止在代码中私自实现未被 SSOT 记录的“影子功能”。

---

## 🛡️ 守门人指令

若未来 Antigravity 发出的任何 Implementation Plan 触碰以上红线，USER 应立即判定为 **Invalid Plan** 并强制执行 **G5 Sealing 回滚**。
