#!/bin/bash
# tools/gates/gate_dataset_manifest_assert.sh
# ⚖️ 数据集 manifest 司法级校验门禁

set -e

SOURCE_DIR="dataset/jianlai_style/images"
GOLD_MANIFEST="docs/_evidence/retrain_p2a_v2/dataset_inventory/style_gold_manifest.csv"
TEMP_MANIFEST="/tmp/current_audit_$(date +%s).csv"
LOG_FILE="docs/_evidence/retrain_p2a_v2/dataset_inventory/gate_dataset_manifest_assert.log"

echo "[$(date)] --- 启动数据集 manifest 门禁校验 ---" | tee "$LOG_FILE"
echo "🔍 目标目录: $SOURCE_DIR" | tee -a "$LOG_FILE"
echo "📜 金标 Manifest: $GOLD_MANIFEST" | tee -a "$LOG_FILE"

# 1. 运行审计脚本生成当前快照
.venv/bin/python3 -c "
import os, hashlib, csv
def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for byte_block in iter(lambda: f.read(4096), b''):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

files_data = []
for root, dirs, files in os.walk('$SOURCE_DIR'):
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            filepath = os.path.join(root, file)
            rel_path = os.path.relpath(filepath, '$SOURCE_DIR')
            sha256 = calculate_sha256(filepath)
            files_data.append({'rel_path': rel_path, 'sha256': sha256})

with open('$TEMP_MANIFEST', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['rel_path', 'sha256'])
    writer.writeheader()
    writer.writerows(files_data)
"

# 2. 数量对比
GOLD_COUNT=$(tail -n +2 "$GOLD_MANIFEST" | wc -l | xargs)
ACTUAL_COUNT=$(tail -n +2 "$TEMP_MANIFEST" | wc -l | xargs)

echo "📊 预期文件数: $GOLD_COUNT" | tee -a "$LOG_FILE"
echo "📊 实际扫描数: $ACTUAL_COUNT" | tee -a "$LOG_FILE"

if [ "$GOLD_COUNT" -ne "$ACTUAL_COUNT" ]; then
    echo "❌ [FAIL] 文件数量不匹配！数据集可能存在异物或缺失。" | tee -a "$LOG_FILE"
    exit 1
fi

# 3. 内容差异对比 (基于 SHA256)
# 提取金标中的 rel_path 和 sha256 (假设 header 为 rel_path,sha256,...)
GOLD_CLEAN="/tmp/gold_clean_$(date +%s).csv"
cut -d',' -f1,2 "$GOLD_MANIFEST" | sort > "$GOLD_CLEAN"
ACTUAL_CLEAN="/tmp/actual_clean_$(date +%s).csv"
sort "$TEMP_MANIFEST" > "$ACTUAL_CLEAN"

DIFF=$(diff "$GOLD_CLEAN" "$ACTUAL_CLEAN")

if [ -n "$DIFF" ]; then
    echo "❌ [FAIL] 发现 SHA256 差异或文件名不匹配！" | tee -a "$LOG_FILE"
    echo "$DIFF" | tee -a "$LOG_FILE"
    rm -f "$TEMP_MANIFEST" "$GOLD_CLEAN" "$ACTUAL_CLEAN"
    exit 1
fi

echo "✅ [PASS] 数据集完全一致。准许进入训练。" | tee -a "$LOG_FILE"
rm -f "$TEMP_MANIFEST" "$GOLD_CLEAN" "$ACTUAL_CLEAN"
