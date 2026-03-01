#!/usr/bin/env bash
set -euo pipefail
OUT="docs/_risk"
mkdir -p "$OUT"

# 只扫描 apps/ 和 packages/ 目录
TARGET_DIRS="apps packages"

if command -v rg >/dev/null 2>&1; then
  # 使用 ripgrep
  # A) 运行时脆弱点：动态导入/探测/执行
  rg -n --type ts --type tsx --type js "process\.cwd\(|__dirname|require\([^'\"]|import\([^'\"]|eval\(|Function\(" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_runtime_fragility.txt" || true

  # B) Prisma/Generated：探测、路径不稳定、旧脆弱实现痕迹
  rg -n --type ts --type tsx --type js "generated/prisma|prisma-enums|@prisma/client|PrismaClient" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_prisma_related.txt" || true

  # C) API 安全：签名链路与旁路
  rg -n --type ts --type tsx --type js "X-Api-Key|X-Nonce|X-Timestamp|X-Signature|HMAC|nonce|timestamp|signature|bypass|skipAuth|noAuth" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_api_security.txt" || true

  # D) 任务系统：无限循环/重试不受控/状态机缺失线索
  rg -n --type ts --type tsx --type js "retry_count|max_retry|RETRY|while\s*\(|for\s*\(;;\)|setInterval\(" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_task_system.txt" || true

  # E) 审计：审计日志、trace_id、签名错误审计、关键链路落库线索
  rg -n --type ts --type tsx --type js "audit|audit_log|audit_trail|trace_id|security_audit" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_audit.txt" || true

  # F) 生产危险：硬编码密钥/调试输出/未清理 TODO
  rg -n --type ts --type tsx --type js "console\.log\(|TODO|FIXME|hardcode|test_key|secret|ADMIN_TOKEN" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_prod_hazards.txt" || true
else
  # 使用 grep
  # A) 运行时脆弱点：动态导入/探测/执行
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "process\.cwd(\|__dirname\|require([^'\"]\|import([^'\"]\|eval(\|Function(" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_runtime_fragility.txt" || true

  # B) Prisma/Generated：探测、路径不稳定、旧脆弱实现痕迹
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "generated/prisma\|prisma-enums\|@prisma/client\|PrismaClient" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_prisma_related.txt" || true

  # C) API 安全：签名链路与旁路
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "X-Api-Key\|X-Nonce\|X-Timestamp\|X-Signature\|HMAC\|nonce\|timestamp\|signature\|bypass\|skipAuth\|noAuth" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_api_security.txt" || true

  # D) 任务系统：无限循环/重试不受控/状态机缺失线索
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "retry_count\|max_retry\|RETRY\|while\s*(\|for\s*(;;)\|setInterval(" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_task_system.txt" || true

  # E) 审计：审计日志、trace_id、签名错误审计、关键链路落库线索
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "audit\|audit_log\|audit_trail\|trace_id\|security_audit" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_audit.txt" || true

  # F) 生产危险：硬编码密钥/调试输出/未清理 TODO
  grep -RIn --include="*.ts" --include="*.tsx" --include="*.js" "console\.log(\|TODO\|FIXME\|hardcode\|test_key\|secret\|ADMIN_TOKEN" $TARGET_DIRS \
    | grep -v node_modules | grep -v ".git" | grep -v "dist/" | grep -v "tools/" | grep -v "docs/" \
    | tee "$OUT/risk_prod_hazards.txt" || true
fi

echo "风险扫描完成，结果见 $OUT/"

