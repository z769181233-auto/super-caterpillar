#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ===== Gate-0: ENGINE_MATRIX SSOT 验证 =====
# 断言:
# 1. SSOT 文件存在且可解析
# 2. engines 目录下的引擎必须在矩阵中登记
# 3. REAL 状态引擎禁止 STUB 特征

GATE_NAME="Gate-0 ENGINE_MATRIX SSOT"
echo "--- [GATE] $GATE_NAME START ---"

SSOT_FILE="docs/_specs/ENGINE_MATRIX_SSOT.md"
ENGINES_DIR="packages/engines"

# 1. SSOT 文件存在
if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ FAIL: SSOT file not found: $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 1: SSOT file exists"

# 2. 提取矩阵中的 EngineKey 列表
SSOT_ENGINES=$(grep -E echo "   Registered engines: $(echo $SSOT_ENGINES | tr 
# 3. 检查 engines 目录下的引擎
MISSING_COUNT=0
for engine_dir in "$ENGINES_DIR"/*/; do
    engine_name=$(basename "$engine_dir")
    
    # 跳过 _template
    if [ "$engine_name" == "_template" ]; then
        continue
    fi
    
    # 检查是否在矩阵中登记
    if ! echo "$SSOT_ENGINES" | grep -q "^${engine_name}$"; then
        echo "⚠️  Engine not in SSOT: $engine_name"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo "❌ FAIL: $MISSING_COUNT engine(s) not registered in SSOT"
    echo "   请将未登记的引擎添加到 $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 2: All engines registered in SSOT"

# 4. 检查 REAL 状态引擎是否有 STUB 特征
# 规则：
#   - 已封印（Tag 含 _sealed_）的 REAL 引擎：Stub 特征 → 硬失败
#   - 未封印的 REAL 引擎：Stub 特征 → 仅警告
STUB_VIOLATIONS=0
STUB_WARNINGS=0

# 提取 REAL 引擎及其封印 Tag
while     # 清理空格
    engine_key=$(echo "$engine_key" | xargs | sed     status=$(echo "$status" | xargs)
    seal_tag=$(echo "$seal_tag" | xargs | sed     
    # 跳过非 REAL 引擎
    if [[ "$status" != "REAL" && "$status" != "REAL-STUB" ]]; then
        continue
    fi
    
    engine_dir="$ENGINES_DIR/$engine_key"
    if [ ! -d "$engine_dir" ]; then
        continue
    fi
    
    # 检查是否有 STUB 特征（排除 replay.ts 和 _template）
    STUB_FOUND=""
    if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "$engine_dir" --include="*.ts" 2>/dev/null | grep -v "replay.ts" | grep -v "_template"; then
        STUB_FOUND="yes"
    fi
    
    # 直接检查 real.ts 是否有 FAKE PNG HEADER
    if [ -f "$engine_dir/real.ts" ] && grep -q "FAKE PNG HEADER" "$engine_dir/real.ts"; then
        STUB_FOUND="yes"
    fi
    
    if [ -n "$STUB_FOUND" ]; then
        # 判断是否已封印
        if [[ "$seal_tag" == *"_sealed_"* ]]; then
            echo "❌ SEALED REAL engine             echo "   Seal Tag: $seal_tag"
            echo "   请移除 Stub 代码后重新封印"
            STUB_VIOLATIONS=$((STUB_VIOLATIONS + 1))
        else
            echo "⚠️  STUB feature found in REAL engine: $engine_key (未封印，允许 warning)"
            STUB_WARNINGS=$((STUB_WARNINGS + 1))
        fi
    fi
done < <(grep -E 
if [ $STUB_VIOLATIONS -gt 0 ]; then
    echo "❌ FAIL: $STUB_VIOLATIONS SEALED REAL engine(s) contain STUB features"
    echo "   封印后不允许 Stub 特征存在！"
    exit 1
fi

if [ $STUB_WARNINGS -gt 0 ]; then
    echo "✅ Assertion 3: REAL engines checked ($STUB_WARNINGS warning(s) for unsealed engines)"
else
    echo "✅ Assertion 3: All REAL engines clean"
fi


# 5. 验证母版存在
TEMPLATE_DIR="$ENGINES_DIR/_template"
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
set -e

# ===== Gate-0: ENGINE_MATRIX SSOT 验证 =====
# 断言:
# 1. SSOT 文件存在且可解析
# 2. engines 目录下的引擎必须在矩阵中登记
# 3. REAL 状态引擎禁止 STUB 特征

GATE_NAME="Gate-0 ENGINE_MATRIX SSOT"
echo "--- [GATE] $GATE_NAME START ---"

SSOT_FILE="docs/_specs/ENGINE_MATRIX_SSOT.md"
ENGINES_DIR="packages/engines"

# 1. SSOT 文件存在
if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ FAIL: SSOT file not found: $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 1: SSOT file exists"

# 2. 提取矩阵中的 EngineKey 列表
SSOT_ENGINES=$(grep -E echo "   Registered engines: $(echo $SSOT_ENGINES | tr 
# 3. 检查 engines 目录下的引擎
MISSING_COUNT=0
for engine_dir in "$ENGINES_DIR"/*/; do
    engine_name=$(basename "$engine_dir")
    
    # 跳过 _template
    if [ "$engine_name" == "_template" ]; then
        continue
    fi
    
    # 检查是否在矩阵中登记
    if ! echo "$SSOT_ENGINES" | grep -q "^${engine_name}$"; then
        echo "⚠️  Engine not in SSOT: $engine_name"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo "❌ FAIL: $MISSING_COUNT engine(s) not registered in SSOT"
    echo "   请将未登记的引擎添加到 $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 2: All engines registered in SSOT"

# 4. 检查 REAL 状态引擎是否有 STUB 特征
# 规则：
#   - 已封印（Tag 含 _sealed_）的 REAL 引擎：Stub 特征 → 硬失败
#   - 未封印的 REAL 引擎：Stub 特征 → 仅警告
STUB_VIOLATIONS=0
STUB_WARNINGS=0

# 提取 REAL 引擎及其封印 Tag
while     # 清理空格
    engine_key=$(echo "$engine_key" | xargs | sed     status=$(echo "$status" | xargs)
    seal_tag=$(echo "$seal_tag" | xargs | sed     
    # 跳过非 REAL 引擎
    if [[ "$status" != "REAL" && "$status" != "REAL-STUB" ]]; then
        continue
    fi
    
    engine_dir="$ENGINES_DIR/$engine_key"
    if [ ! -d "$engine_dir" ]; then
        continue
    fi
    
    # 检查是否有 STUB 特征（排除 replay.ts 和 _template）
    STUB_FOUND=""
    if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "$engine_dir" --include="*.ts" 2>/dev/null | grep -v "replay.ts" | grep -v "_template"; then
        STUB_FOUND="yes"
    fi
    
    # 直接检查 real.ts 是否有 FAKE PNG HEADER
    if [ -f "$engine_dir/real.ts" ] && grep -q "FAKE PNG HEADER" "$engine_dir/real.ts"; then
        STUB_FOUND="yes"
    fi
    
    if [ -n "$STUB_FOUND" ]; then
        # 判断是否已封印
        if [[ "$seal_tag" == *"_sealed_"* ]]; then
            echo "❌ SEALED REAL engine             echo "   Seal Tag: $seal_tag"
            echo "   请移除 Stub 代码后重新封印"
            STUB_VIOLATIONS=$((STUB_VIOLATIONS + 1))
        else
            echo "⚠️  STUB feature found in REAL engine: $engine_key (未封印，允许 warning)"
            STUB_WARNINGS=$((STUB_WARNINGS + 1))
        fi
    fi
done < <(grep -E 
if [ $STUB_VIOLATIONS -gt 0 ]; then
    echo "❌ FAIL: $STUB_VIOLATIONS SEALED REAL engine(s) contain STUB features"
    echo "   封印后不允许 Stub 特征存在！"
    exit 1
fi

if [ $STUB_WARNINGS -gt 0 ]; then
    echo "✅ Assertion 3: REAL engines checked ($STUB_WARNINGS warning(s) for unsealed engines)"
else
    echo "✅ Assertion 3: All REAL engines clean"
fi


# 5. 验证母版存在
TEMPLATE_DIR="$ENGINES_DIR/_template"
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
set -e

# ===== Gate-0: ENGINE_MATRIX SSOT 验证 =====
# 断言:
# 1. SSOT 文件存在且可解析
# 2. engines 目录下的引擎必须在矩阵中登记
# 3. REAL 状态引擎禁止 STUB 特征

GATE_NAME="Gate-0 ENGINE_MATRIX SSOT"
echo "--- [GATE] $GATE_NAME START ---"

SSOT_FILE="docs/_specs/ENGINE_MATRIX_SSOT.md"
ENGINES_DIR="packages/engines"

# 1. SSOT 文件存在
if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ FAIL: SSOT file not found: $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 1: SSOT file exists"

# 2. 提取矩阵中的 EngineKey 列表
SSOT_ENGINES=$(grep -E echo "   Registered engines: $(echo $SSOT_ENGINES | tr 
# 3. 检查 engines 目录下的引擎
MISSING_COUNT=0
for engine_dir in "$ENGINES_DIR"/*/; do
    engine_name=$(basename "$engine_dir")
    
    # 跳过 _template
    if [ "$engine_name" == "_template" ]; then
        continue
    fi
    
    # 检查是否在矩阵中登记
    if ! echo "$SSOT_ENGINES" | grep -q "^${engine_name}$"; then
        echo "⚠️  Engine not in SSOT: $engine_name"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo "❌ FAIL: $MISSING_COUNT engine(s) not registered in SSOT"
    echo "   请将未登记的引擎添加到 $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 2: All engines registered in SSOT"

# 4. 检查 REAL 状态引擎是否有 STUB 特征
# 规则：
#   - 已封印（Tag 含 _sealed_）的 REAL 引擎：Stub 特征 → 硬失败
#   - 未封印的 REAL 引擎：Stub 特征 → 仅警告
STUB_VIOLATIONS=0
STUB_WARNINGS=0

# 提取 REAL 引擎及其封印 Tag
while     # 清理空格
    engine_key=$(echo "$engine_key" | xargs | sed     status=$(echo "$status" | xargs)
    seal_tag=$(echo "$seal_tag" | xargs | sed     
    # 跳过非 REAL 引擎
    if [[ "$status" != "REAL" && "$status" != "REAL-STUB" ]]; then
        continue
    fi
    
    engine_dir="$ENGINES_DIR/$engine_key"
    if [ ! -d "$engine_dir" ]; then
        continue
    fi
    
    # 检查是否有 STUB 特征（排除 replay.ts 和 _template）
    STUB_FOUND=""
    if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "$engine_dir" --include="*.ts" 2>/dev/null | grep -v "replay.ts" | grep -v "_template"; then
        STUB_FOUND="yes"
    fi
    
    # 直接检查 real.ts 是否有 FAKE PNG HEADER
    if [ -f "$engine_dir/real.ts" ] && grep -q "FAKE PNG HEADER" "$engine_dir/real.ts"; then
        STUB_FOUND="yes"
    fi
    
    if [ -n "$STUB_FOUND" ]; then
        # 判断是否已封印
        if [[ "$seal_tag" == *"_sealed_"* ]]; then
            echo "❌ SEALED REAL engine             echo "   Seal Tag: $seal_tag"
            echo "   请移除 Stub 代码后重新封印"
            STUB_VIOLATIONS=$((STUB_VIOLATIONS + 1))
        else
            echo "⚠️  STUB feature found in REAL engine: $engine_key (未封印，允许 warning)"
            STUB_WARNINGS=$((STUB_WARNINGS + 1))
        fi
    fi
done < <(grep -E 
if [ $STUB_VIOLATIONS -gt 0 ]; then
    echo "❌ FAIL: $STUB_VIOLATIONS SEALED REAL engine(s) contain STUB features"
    echo "   封印后不允许 Stub 特征存在！"
    exit 1
fi

if [ $STUB_WARNINGS -gt 0 ]; then
    echo "✅ Assertion 3: REAL engines checked ($STUB_WARNINGS warning(s) for unsealed engines)"
else
    echo "✅ Assertion 3: All REAL engines clean"
fi


# 5. 验证母版存在
TEMPLATE_DIR="$ENGINES_DIR/_template"
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
set -e

# ===== Gate-0: ENGINE_MATRIX SSOT 验证 =====
# 断言:
# 1. SSOT 文件存在且可解析
# 2. engines 目录下的引擎必须在矩阵中登记
# 3. REAL 状态引擎禁止 STUB 特征

GATE_NAME="Gate-0 ENGINE_MATRIX SSOT"
echo "--- [GATE] $GATE_NAME START ---"

SSOT_FILE="docs/_specs/ENGINE_MATRIX_SSOT.md"
ENGINES_DIR="packages/engines"

# 1. SSOT 文件存在
if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ FAIL: SSOT file not found: $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 1: SSOT file exists"

# 2. 提取矩阵中的 EngineKey 列表
SSOT_ENGINES=$(grep -E echo "   Registered engines: $(echo $SSOT_ENGINES | tr 
# 3. 检查 engines 目录下的引擎
MISSING_COUNT=0
for engine_dir in "$ENGINES_DIR"/*/; do
    engine_name=$(basename "$engine_dir")
    
    # 跳过 _template
    if [ "$engine_name" == "_template" ]; then
        continue
    fi
    
    # 检查是否在矩阵中登记
    if ! echo "$SSOT_ENGINES" | grep -q "^${engine_name}$"; then
        echo "⚠️  Engine not in SSOT: $engine_name"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo "❌ FAIL: $MISSING_COUNT engine(s) not registered in SSOT"
    echo "   请将未登记的引擎添加到 $SSOT_FILE"
    exit 1
fi
echo "✅ Assertion 2: All engines registered in SSOT"

# 4. 检查 REAL 状态引擎是否有 STUB 特征
# 规则：
#   - 已封印（Tag 含 _sealed_）的 REAL 引擎：Stub 特征 → 硬失败
#   - 未封印的 REAL 引擎：Stub 特征 → 仅警告
STUB_VIOLATIONS=0
STUB_WARNINGS=0

# 提取 REAL 引擎及其封印 Tag
while     # 清理空格
    engine_key=$(echo "$engine_key" | xargs | sed     status=$(echo "$status" | xargs)
    seal_tag=$(echo "$seal_tag" | xargs | sed     
    # 跳过非 REAL 引擎
    if [[ "$status" != "REAL" && "$status" != "REAL-STUB" ]]; then
        continue
    fi
    
    engine_dir="$ENGINES_DIR/$engine_key"
    if [ ! -d "$engine_dir" ]; then
        continue
    fi
    
    # 检查是否有 STUB 特征（排除 replay.ts 和 _template）
    STUB_FOUND=""
    if grep -rq "FAKE PNG HEADER\|realStub\|LEGACY_STUB" "$engine_dir" --include="*.ts" 2>/dev/null | grep -v "replay.ts" | grep -v "_template"; then
        STUB_FOUND="yes"
    fi
    
    # 直接检查 real.ts 是否有 FAKE PNG HEADER
    if [ -f "$engine_dir/real.ts" ] && grep -q "FAKE PNG HEADER" "$engine_dir/real.ts"; then
        STUB_FOUND="yes"
    fi
    
    if [ -n "$STUB_FOUND" ]; then
        # 判断是否已封印
        if [[ "$seal_tag" == *"_sealed_"* ]]; then
            echo "❌ SEALED REAL engine             echo "   Seal Tag: $seal_tag"
            echo "   请移除 Stub 代码后重新封印"
            STUB_VIOLATIONS=$((STUB_VIOLATIONS + 1))
        else
            echo "⚠️  STUB feature found in REAL engine: $engine_key (未封印，允许 warning)"
            STUB_WARNINGS=$((STUB_WARNINGS + 1))
        fi
    fi
done < <(grep -E 
if [ $STUB_VIOLATIONS -gt 0 ]; then
    echo "❌ FAIL: $STUB_VIOLATIONS SEALED REAL engine(s) contain STUB features"
    echo "   封印后不允许 Stub 特征存在！"
    exit 1
fi

if [ $STUB_WARNINGS -gt 0 ]; then
    echo "✅ Assertion 3: REAL engines checked ($STUB_WARNINGS warning(s) for unsealed engines)"
else
    echo "✅ Assertion 3: All REAL engines clean"
fi


# 5. 验证母版存在
TEMPLATE_DIR="$ENGINES_DIR/_template"
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
