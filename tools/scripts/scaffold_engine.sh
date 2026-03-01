#!/bin/bash
# 引擎脚手架生成工具
# 用法: ./scaffold_engine.sh <ENGINE_KEY> [--with-providers]
# 示例: ./scaffold_engine.sh ce07_memory_update
# 示例: ./scaffold_engine.sh shot_preview --with-providers

set -e

TEMPLATE_DIR="packages/engines/_template"
ENGINES_DIR="packages/engines"

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <ENGINE_KEY> [--with-providers]"
    echo "   Example: $0 ce07_memory_update"
    exit 1
fi

ENGINE_KEY="$1"
WITH_PROVIDERS=false

if [ "$2" == "--with-providers" ]; then
    WITH_PROVIDERS=true
fi

# 转换为大写形式（用于类名）
ENGINE_CLASS=$(echo "$ENGINE_KEY" | sed -E 's/(^|_)([a-z])/\U\2/g')

TARGET_DIR="$ENGINES_DIR/$ENGINE_KEY"

# 检查是否已存在
if [ -d "$TARGET_DIR" ]; then
    echo "❌ Engine directory already exists: $TARGET_DIR"
    exit 1
fi

# 创建目录
mkdir -p "$TARGET_DIR"
echo "📁 Created: $TARGET_DIR"

# 复制并替换模板
for file in types.ts selector.ts real.ts replay.ts index.ts; do
    if [ -f "$TEMPLATE_DIR/$file" ]; then
        sed "s/__ENGINE__/$ENGINE_CLASS/g" "$TEMPLATE_DIR/$file" > "$TARGET_DIR/$file"
        echo "📄 Created: $TARGET_DIR/$file"
    fi
done

# 可选：创建 providers 目录
if [ "$WITH_PROVIDERS" = true ]; then
    mkdir -p "$TARGET_DIR/providers"
    cat > "$TARGET_DIR/providers/index.ts" << 'EOF'
/**
 * Provider 抽象层
 * 支持多后端切换
 */

export interface ${ENGINE_CLASS}Provider {
    key: string;
    invoke(input: any): Promise<any>;
}

// 默认 Provider（占位）
export const defaultProvider: ${ENGINE_CLASS}Provider = {
    key: 'default',
    async invoke(input: any) {
        throw new Error('Not implemented');
    },
};
EOF
    sed -i '' "s/\${ENGINE_CLASS}/$ENGINE_CLASS/g" "$TARGET_DIR/providers/index.ts" 2>/dev/null || \
    sed -i "s/\${ENGINE_CLASS}/$ENGINE_CLASS/g" "$TARGET_DIR/providers/index.ts"
    echo "📄 Created: $TARGET_DIR/providers/index.ts"
fi

echo ""
echo "✅ Engine scaffolded: $ENGINE_KEY"
echo ""
echo "Next steps:"
echo "  1. Edit $TARGET_DIR/types.ts - Define Input/Output interfaces"
echo "  2. Edit $TARGET_DIR/real.ts  - Implement real engine logic"
echo "  3. Edit $TARGET_DIR/replay.ts - Implement replay logic"
echo "  4. Register in ENGINE_MATRIX_SSOT.md"
echo "  5. Create Gate script: tools/gate/gates/gate-${ENGINE_KEY}.sh"
