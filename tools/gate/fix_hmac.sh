#!/bin/bash
# P14-0 Gate HMAC 修复脚本（独立可执行）
# 用途：修复 gate-quality-prod-hook.sh 的 generate_headers 函数

set -e

TARGET_FILE="./tools/gate/gates/gate-quality-prod-hook.sh"
BACKUP_FILE="./tools/gate/gates/gate-quality-prod-hook.sh.backup.$(date +%s)"

echo "📋 P14-0 Gate HMAC 修复脚本"
echo "=============================="

# 1. 备份
echo "1️⃣ 备份原文件..."
cp "$TARGET_FILE" "$BACKUP_FILE"
echo "   ✅ 备份至: $BACKUP_FILE"

# 2. 创建临时修复版
echo "2️⃣ 创建修复版本..."

# 读取原文件，在第 98-125 行替换 generate_headers
awk '
BEGIN { in_function = 0; line_num = 0 }
{
    line_num++
    if (line_num == 98) {
        # 开始替换：输出新的 generate_headers
        print "generate_headers() {"
        print "  local method=\"$1\""
        print "  local req_path=\"$2\""
        print "  local body=\"${3:-}\""
        print ""
        print "  env API_SECRET=\"$API_SECRET\" VALID_API_KEY_ID=\"$VALID_API_KEY_ID\" REQ_BODY=\"$body\" \\"
        print "    node - <<'"'"'NODESCRIPT'"'"'"
        print "const crypto = require(\"crypto\");"
        print "const secret = process.env.API_SECRET || \"\";"
        print "const apiKey = process.env.VALID_API_KEY_ID || \"\";"
        print "const body = process.env.REQ_BODY || \"\";"
        print "const timestamp = Math.floor(Date.now() / 1000);"
        print "const nonce = \"nonce_\" + timestamp + \"_\" + Math.random().toString(36).slice(2);"
        print "const contentSha256 = body ? crypto.createHash(\"sha256\").update(body, \"utf8\").digest(\"hex\") : \"UNSIGNED\";"
        print "const payload = apiKey + nonce + timestamp + body;"
        print "const signature = crypto.createHmac(\"sha256\", secret).update(payload).digest(\"hex\");"
        print "process.stdout.write(\"X-Api-Key: \" + apiKey + \"\\n\");"
        print "process.stdout.write(\"X-Nonce: \" + nonce + \"\\n\");"
        print "process.stdout.write(\"X-Timestamp: \" + timestamp + \"\\n\");"
        print "process.stdout.write(\"X-Content-SHA256: \" + contentSha256 + \"\\n\");"
        print "process.stdout.write(\"X-Signature: \" + signature + \"\\n\");"
        print "NODESCRIPT"
        print "}"
        in_function = 1
        next
    }
    if (in_function == 1 && line_num <= 125) {
        next  # 跳过旧函数内容
    }
    if (line_num == 126) {
        in_function = 0
    }
    print $0
}
' "$BACKUP_FILE" > "$TARGET_FILE.new"

mv "$TARGET_FILE.new" "$TARGET_FILE"

# 3. 语法检查
echo "3️⃣ 语法检查..."
if bash -n "$TARGET_FILE"; then
    echo "   ✅ 语法检查通过"
else
    echo "   ❌ 语法检查失败，恢复备份..."
    cp "$BACKUP_FILE" "$TARGET_FILE"
    exit 1
fi

# 4. 验证 NODESCRIPT 闭合
echo "4️⃣ 验证 heredoc 闭合..."
NODESCRIPT_COUNT=$(grep -c "NODESCRIPT" "$TARGET_FILE" || true)
if [ "$NODESCRIPT_COUNT" -eq 2 ]; then
    echo "   ✅ heredoc 正确闭合（2处 NODESCRIPT）"
else
    echo "   ⚠️  警告：NODESCRIPT 出现 $NODESCRIPT_COUNT 次（预期 2 次）"
fi

echo ""
echo "✅ 修复完成！"
echo ""
echo "📋 下一步："
echo "   bash -n $TARGET_FILE && echo '✅ OK'"
echo "   $TARGET_FILE"
