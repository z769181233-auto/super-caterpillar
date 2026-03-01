#!/bin/bash
# gate_registry_unique.sh
# 检查 Engine Registry Hub 是否存在重复的 (engineKey, version) 注册

# 通过调用 API 或启动一个简单的测试脚本来运行 EngineRegistryHubService 的 unique 检查。
# 由于 Registry 有 onModuleInit 检查，我们只需尝试编译并启动（或者运行微单元测试）。

# 这里我们采用一种更轻量的方式：grep + sort 检查。
REGISTRY_FILE="apps/api/src/engine-hub/engine-registry-hub.service.ts"

echo "[GATE] Auditing Engine Registry Uniqueness in $REGISTRY_FILE..."

# 提取 engineKey, version 组合并检查重复
DUPS=$(grep -E "engineKey:|version:" "$REGISTRY_FILE" | awk '{print $2}' | sed "s/['\",]//g" | xargs -n2 echo | sort | uniq -d)

if [ ! -z "$DUPS" ]; then
  echo "❌ ERROR: Duplicate Engine Registration found:"
  echo "$DUPS"
  exit 1
else
  echo "✅ [PASS] Engine Registry is unique."
  exit 0
fi
