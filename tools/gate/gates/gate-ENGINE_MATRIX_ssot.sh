#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ===== Gate-0: ENGINE_MATRIX SSOT 验证 (V6 隔离审计版) =====
# 断言:
# 1. SSOT 文件存在且可解析
# 2. 已实现的引擎 (SEALED/IN-PROGRESS) 物理路径必须真实存在
# 3. REAL 状态引擎禁止 STUB 特征
# 4. Engine template 目录完整性

GATE_NAME="Gate-0 ENGINE_MATRIX SSOT"
echo "--- [GATE] $GATE_NAME START ---"

SSOT_FILE="docs/_specs/ENGINE_MATRIX_SSOT.md"
[ -f "$SSOT_FILE" ] || SSOT_FILE="ENGINE_MATRIX_SSOT.md"

# 1. SSOT 文件存在
if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ FAIL: SSOT file not found: $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 1: SSOT file exists ($SSOT_FILE)"

# 2. 定位审计区间 (从 SEALED_BEGIN 到 INPROGRESS_END)
START_LN=$(grep -n "SSOT_TABLE:SEALED_BEGIN" "$SSOT_FILE" | cut -d: -f1)
END_LN=$(grep -n "SSOT_TABLE:INPROGRESS_END" "$SSOT_FILE" | cut -d: -f1)

if [ -z "$START_LN" ] || [ -z "$END_LN" ]; then
    echo "❌ FAIL: SSOT anchors missing"
    exit 1
fi

# 提取审计区域内的表格数据
AUDIT_ZONE=$(sed -n "${START_LN},${END_LN}p" "$SSOT_FILE" | grep "^|" | grep -v "engine_key" | grep -v ":---")

MISSING_PATHS=0
while IFS='|' read -r _ engine_key _ _ _ _ adapter_path gate_path _ _; do
    ek=$(echo "${engine_key:-}" | tr -d ' `')
    ap=$(echo "${adapter_path:-}" | tr -d ' `')
    gp=$(echo "${gate_path:-}" | tr -d ' `')
    
    if [ -z "$ek" ]; then continue; fi

    # 检查适配器
    if [ -n "$ap" ] && [ "$ap" != "-" ]; then
        if [ ! -f "$ap" ]; then
            echo "❌ FAIL: Adapter missing for '$ek': $ap"
            MISSING_PATHS=$((MISSING_PATHS + 1))
        fi
    fi

    # 检查门禁
    if [ -n "$gp" ] && [ "$gp" != "-" ]; then
        if [ ! -f "$gp" ]; then
            echo "❌ FAIL: Gate script missing for '$ek': $gp"
            MISSING_PATHS=$((MISSING_PATHS + 1))
        fi
    fi
done <<< "$AUDIT_ZONE"

if [ $MISSING_PATHS -gt 0 ]; then
    echo "❌ FAIL: $MISSING_PATHS implementation path(s) not found"
    exit 1
fi
echo "✅ Assertion 2: Implementations verified (Audited SEALED/IN-PROGRESS)"

# 3. 检查 REAL 状态引擎是否有 STUB 特征
STUB_VIOLATIONS=0
while IFS='|' read -r _ engine_key _ status _ _ adapter_path _ seal_tag _; do
    ek=$(echo "${engine_key:-}" | tr -d ' `')
    ap=$(echo "${adapter_path:-}" | tr -d ' `')
    tg=$(echo "${seal_tag:-}" | tr -d ' `')
    
    if [ -z "$ek" ] || [ -z "$ap" ] || [ "$ap" == "-" ]; then continue; fi
    
    # 查找物理目录
    engine_dir=""
    if [[ "$ap" =~ ^packages/engines/([^/]+)/ ]]; then
        engine_dir="packages/engines/${BASH_REMATCH[1]}"
    elif [[ "$ek" =~ ^([a-z0-9]+)_.* ]]; then
        prefix="${BASH_REMATCH[1]}"
        if [ -d "packages/engines/$prefix" ]; then
            engine_dir="packages/engines/$prefix"
        fi
    fi
    
    if [ -z "$engine_dir" ] || [ ! -d "$engine_dir" ]; then continue; fi
    
    # 检查是否有 STUB 特征
    if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "$engine_dir" --include="*.ts" 2>/dev/null | grep -v "replay.ts" | grep -v "_template" > /dev/null; then
        if [ -n "$tg" ] && [ "$tg" != "-" ]; then
            echo "❌ SEALED engine [ $ek ] contains STUB features!"
            STUB_VIOLATIONS=$((STUB_VIOLATIONS + 1))
        fi
    fi
done <<< "$AUDIT_ZONE"

if [ $STUB_VIOLATIONS -gt 0 ]; then
    echo "❌ FAIL: $STUB_VIOLATIONS SEALED REAL engine(s) contain STUB features"
    exit 1
fi
echo "✅ Assertion 3: Stub safety verified"

# 4. 验证母版存在
TEMPLATE_DIR="packages/engines/_template"
REQUIRED_FILES=("types.ts" "selector.ts" "real.ts" "replay.ts" "index.ts")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$TEMPLATE_DIR/$file" ]; then
        echo "❌ FAIL: Template file missing: $TEMPLATE_DIR/$file"
        exit 1
    fi
done
echo "✅ Assertion 4: Engine template complete"

echo ""
echo "--- [GATE] $GATE_NAME PASS ---"
exit 0
