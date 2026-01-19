# NON_PROD_SEALS（非生产封板清单）

**目的**: 标记历史/演示封板，不具备生产有效性

---

## 封板有效性口径

### 生产有效封板（Production Valid Seal）

**标准**:

- 必须通过总门禁`gate-prod_video_readiness.sh`
- 必须产出真实可播放视频（ffprobe验证通过）
- 必须有完整Evidence归档
- 命名格式: `seal/*_prod_video_YYYYMMDD`

### 非生产封板（NON_PROD_SEAL）

**判定**:

- 使用Mock/Demo/Stub实现
- 产物不是真实视频画面
- 无ffprobe验证
- 依赖手工步骤/临时重启

**状态**: 保留git历史，但不作为生产封板引用

---

## NON_PROD_SEALS清单

### 1. `seal/phase3_commercial_e2e_hard_20260113_153210`

**判定**: Demo Seal

**原因**:

- Shot Render使用`mock://`
- `render_meta.mocked = true`
- 视频画面非真实

**影响**:

- 虽然E2E链路真实，但最终产物是假视频
- 不符合生产视频服务标准

**状态**:

- ❌ 不具备生产有效性
- ✅ 保留git历史（不删除tag）
- 🔄 需要替代: 通过`gate-prod_video_readiness.sh`后重新封板

**替代Seal**:

- Phase 0-R完成后打新tag: `seal/phase3_commercial_e2e_prod_video_20260118`

---

## 封板迁移路径

```
Phase 0-R: Shot Render真实化
  ↓
总门禁 gate-prod_video_readiness.sh PASS
  ↓
新Seal: seal/phase0r_shot_render_prod_video_20260116
  ↓
重新执行 gate-phase3-commercial-e2e.sh
  ↓
新Seal: seal/phase3_commercial_e2e_prod_video_20260118
```

---

## 生产封板授权规则

**唯一来源**: 总门禁`gate-prod_video_readiness.sh` PASS

**不允许**:

- 手工判断"看起来没问题"
- 绕过Gate直接打tag
- 使用Demo/Mock实现封板

**强制要求**:

- 证据完整归档到`docs/_evidence/PROD_VIDEO_READINESS_*`
- ffprobe验证MP4真实可播放
- 无`mock://`、无`mocked:true`

---

**文档创建**: 2026-01-13  
**Phase 0-R**: 生产封板收口行动
