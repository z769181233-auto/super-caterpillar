#!/usr/bin/env bash
# 功能对齐验证 V2 - 证据收集脚本
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "功能对齐验证 V2 - 证据收集"
echo "=========================================="
echo ""

# A) DBSpec V1.1 验证
echo "## A) DBSpec V1.1 验证"
echo ""

echo "### A1) projects.settings_json 字段"
echo "命令: grep -n 'settingsJson\|settings_json' packages/database/prisma/schema.prisma | grep -i project"
grep -n 'settingsJson\|settings_json' packages/database/prisma/schema.prisma | grep -i project || echo "未找到"
echo ""

echo "### A2) 核心实体存在性检查"
echo "命令: grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(ShotVariant|WorkerNode|Asset|AuditLog|SystemSetting|BillingPlan|BillingRecord|Model)'"
grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(ShotVariant|WorkerNode|Asset|AuditLog|SystemSetting|BillingPlan|BillingRecord|Model)' || echo "未找到"
echo ""

echo "### A3) V1.1 扩展实体存在性检查"
echo "命令: grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(Character|NovelVolume|NovelChapter|NovelScene|MemoryShortTerm|MemoryLongTerm|SecurityFingerprint)'"
grep -n '^model ' packages/database/prisma/schema.prisma | grep -E '(Character|NovelVolume|NovelChapter|NovelScene|MemoryShortTerm|MemoryLongTerm|SecurityFingerprint)' || echo "未找到"
echo ""

echo "### A4) 索引存在性检查"
echo "命令: grep -n '@@index' packages/database/prisma/schema.prisma | grep -E '(sceneId|status.*createdAt|nonce.*timestamp)'"
grep -n '@@index' packages/database/prisma/schema.prisma | grep -E '(sceneId|status.*createdAt|nonce.*timestamp)' || echo "未找到"
echo ""

# B) APISpec V1.1 验证
echo "## B) APISpec V1.1 验证"
echo ""

echo "### B1) CE09 Asset 接口"
echo "命令: grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(asset|secure-url|hls|watermark)'"
grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(asset|secure-url|hls|watermark)' || echo "未找到"
echo ""

echo "### B2) CE07/CE08 Memory 接口"
echo "命令: grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(memory|short-term|long-term)'"
grep -rn '@Get\|@Post' apps/api/src --include='*.controller.ts' | grep -E '(memory|short-term|long-term)' || echo "未找到"
echo ""

echo "### B3) CE05 Shot 接口 (inpaint/pose)"
echo "命令: grep -rn '@Post' apps/api/src --include='*.controller.ts' | grep -E '(inpaint|pose)'"
grep -rn '@Post' apps/api/src --include='*.controller.ts' | grep -E '(inpaint|pose)' || echo "未找到"
echo ""

echo "### B4) CE10 RequireSignature 覆盖范围"
echo "命令: grep -rn '@RequireSignature' apps/api/src --include='*.ts'"
grep -rn '@RequireSignature' apps/api/src --include='*.ts' || echo "未找到"
echo ""

# C) PRD/EngineSpec 验证
echo "## C) PRD/EngineSpec 关键流程验证"
echo ""

echo "### C1) CE01 角色三视图 (seed/embedding)"
echo "命令: grep -rn 'CE01\|角色三视图\|seed\|embedding' apps/api/src --include='*.ts' | head -20"
grep -rn 'CE01\|角色三视图\|seed\|embedding' apps/api/src --include='*.ts' | head -20 || echo "未找到"
echo ""

echo "### C2) CE06→CE03→CE04 串联证据"
echo "命令: grep -rn 'handleCECoreJobSuccess\|CE06.*CE03\|CE03.*CE04' apps/api/src --include='*.ts'"
grep -rn 'handleCECoreJobSuccess\|CE06.*CE03\|CE03.*CE04' apps/api/src --include='*.ts' || echo "未找到"
echo ""

echo "### C3) CE09 安全链路 (HLS/水印/指纹)"
echo "命令: grep -rn 'HLS\|watermark\|fingerprint\|securityProcessed' apps/api/src --include='*.ts' | head -20"
grep -rn 'HLS\|watermark\|fingerprint\|securityProcessed' apps/api/src --include='*.ts' | head -20 || echo "未找到"
echo ""

echo "### C4) CE07 短期记忆使用证据"
echo "命令: grep -rn 'MemoryShortTerm\|memory.*short\|分镜.*记忆' apps/api/src --include='*.ts' | head -20"
grep -rn 'MemoryShortTerm\|memory.*short\|分镜.*记忆' apps/api/src --include='*.ts' | head -20 || echo "未找到"
echo ""

echo "### C5) JobType Enum 中的 CE 引擎"
echo "命令: grep -A 50 'enum JobType' packages/database/prisma/schema.prisma | grep -E 'CE[0-9]'"
grep -A 50 'enum JobType' packages/database/prisma/schema.prisma | grep -E 'CE[0-9]' || echo "未找到"
echo ""

echo "=========================================="
echo "验证脚本执行完成"
echo "=========================================="

