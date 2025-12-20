# Audit Actions Catalog (Stage 12)

> 本文档枚举所有已定义的安全审计动作，作为审计日志查询的索引。

## Text Safety
| Action | 描述 | 触发条件 | 风险等级 |
| :--- | :--- | :--- | :--- |
| **TEXT_SAFETY_PASS** | 文本审查通过 | 内容未触发黑名单，且未触发 BLOCK 规则 | Low |
| **TEXT_SAFETY_WARN** | 文本审查警告 | 内容触发灰名单/敏感词，但未达到拦截标准 | Medium |
| **TEXT_SAFETY_BLOCK** | 文本审查拦截 | 内容触发黑名单 (Critical) 或达到 BLOCK 阈值 | Critical |
| **TEXT_SAFETY_FAILSAFE** | 审查服务降级 | 审查过程中发生异常，系统自动放行 (Fail-open) | High |

## Signed URL / Storage
| Action | 描述 | 触发条件 | 风险等级 |
| :--- | :--- | :--- | :--- |
| **SIGNED_URL_REFRESH** | 刷新签名 URL | 用户请求延长访问凭证有效期 | Medium |
| **SIGNED_URL_FAILSAFE** | URL刷新降级 | 刷新逻辑异常，回退至 Legacy 模式 | Medium |
| **SIGNED_URL_DENY** | 访问被拒绝 | (隐式) 未通过鉴权或签名校验（通常记录 Warning Log，非必须落库） | High |

> **注意**: `SIGNED_URL_DENY` 在当前实现中更多作为 Access Metrics 统计 (`signed_url_access_denied_total`)，审计日志中重点记录 `SIGNED_URL_REFRESH` 和 `BLOCK` 事件。
