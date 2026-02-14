# P10+ 治理宪法 (Governance Constitution)

**生效时间**: 2026-02-01 (P9.1封存后)  
**适用范围**: Phase 10及后续所有阶段  
**优先级**: P0 (红线,不可违反)

---

## 一、秘密扫描合规红线

### 1.1 禁止事项

❌ **严格禁止**添加任何**pattern-based排除**规则  
❌ **严格禁止**使用正则表达式排除secret patterns  
❌ **严格禁止**通过模糊匹配绕过扫描

### 1.2 允许事项

✅ **仅允许** path-based排除,且必须满足:

- 排除路径必须在 `EXCLUDE_PATHS` 数组中显式声明
- 每次新增必须伴随 git commit记录
- 必须输出到证据文件 `p9_1_excluded_paths.txt` 供审计

### 1.3 新增排除流程

任何新增排除必须遵循以下流程:

1. **修改代码**: 在 `tools/p9/gate_p9_1_secret_scan.sh` 的 `EXCLUDE_PATHS` 数组中添加精确路径
2. **更新文档**: 在 `walkthrough.md` 中添加排除原因说明
3. **提交变更**: git commit必须包含清晰的排除理由
4. **验证证据**: 复跑P9 runner,确认 `p9_1_excluded_paths.txt` 包含新增路径
5. **审计留痕**: 所有排除变更必须可追溯到具体commit

---

## 二、历史材料归档规范

### 2.1 禁止裸删

❌ **严格禁止**直接 `git rm` 包含secret patterns的历史文件  
❌ **严格禁止**通过force push清除历史记录

### 2.2 强制归档

✅ **必须执行**以下归档流程:

1. **创建归档目录**: `docs/_archive/<component>_legacy/`
2. **恢复历史文件**: 使用 `git show <commit>:<path>` 恢复内容
3. **添加README**: 说明归档原因、原始提交、删除理由
4. **提交归档**: git commit明确标注"archive for audit trail"

### 2.3 归档示例

参考P9.1的S3-A.1材料归档:

- 归档位置: `docs/_archive/s3a1_verification_legacy/`
- README包含: 归档时间、原因、历史提交链
- 审计可追溯: 从归档README可回溯到完整历史

---

## 三、证据工件强制要求

### 3.1 可审计性

所有治理gate必须输出以下证据工件:

- **扫描范围**: `*_files_scanned.txt` (明确哪些文件被扫描)
- **排除列表**: `*_excluded_paths.txt` (明确哪些路径被排除)
- **扫描结果**: `*_hits_fileline.txt` (发现的问题,仅hash不泄露内容)
- **审计日志**: `*_audit.json` (结构化结果,包含PASS/FAIL)

### 3.2 完整性校验

每次封存必须生成:

- `SHA256SUMS.txt`: 所有证据文件的校验和
- `EVIDENCE_INDEX.sha256`: 证据索引的校验和
- P9-3 gate验证: 历史封存tag可重放校验

---

## 四、合规口径标准

### 4.1 必须在文档中体现

每次治理变更必须在以下文档中更新:

- `walkthrough.md`: 封存tag、证据目录、关键口径
- `task.md`: SEALED状态、完成清单
- `CHANGELOG.md` (如有): 治理变更的用户可见说明

### 4.2 三句话口径

任何治理封存必须能用三句话解释:

1. **What**: 做了什么变更
2. **Why**: 为什么必须这样做 (合规要求/审计追溯)
3. **How**: 如何验证变更生效 (证据文件/gate结果)

---

## 五、违规处理

### 5.1 自动失败

任何违反本宪法的变更导致:

- P9-1 gate自动FAIL
- CI/CD流程自动阻断
- pre-push hook拒绝提交

### 5.2 修复流程

发现违规必须:

1. **立即回滚**违规变更
2. **按规范重做**符合宪法要求
3. **补充说明**在commit message中解释为何违规
4. **增强防护**添加自动检测规则(如适用)

---

## 六、宪法修订

本宪法只能通过以下方式修订:

1. **提出RFC**: 在 `docs/_specs/rfcs/` 中提交修订提案
2. **审计风险评估**: 评估修订对合规性的影响
3. **留存记录**: 修订历史必须可追溯
4. **重新封存**: 修订后必须触发新的治理gate验证

---

**本宪法自P9.1封存 (`sealed_p9_1_governance_hardening_5ee2909`) 起生效。**
