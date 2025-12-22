#!/usr/bin/env bash
# 启动本地 PostgreSQL Docker 容器
# 用于本地开发环境

set -euo pipefail

CONTAINER_NAME="scu-postgres"
IMAGE="postgres:16-alpine"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="scu"

# 端口候选列表（按优先级排序）
PORT_CANDIDATES=(5432 5433 5434 15432 25432)
SELECTED_PORT=""

echo "=========================================="
echo "PostgreSQL Docker 容器启动"
echo "=========================================="
echo ""

# 1. 检查 Docker 命令是否存在
echo "步骤 1/4: 检查 Docker 是否已安装..."
if ! command -v docker &> /dev/null; then
  echo "❌ 错误：未检测到 Docker 命令"
  echo ""
  echo "Docker 未安装，请先安装 Docker："
  echo ""
  echo "  macOS:"
  echo "    1. 访问 https://docs.docker.com/desktop/install/mac-install/"
  echo "    2. 下载并安装 Docker Desktop"
  echo "    3. 启动 Docker Desktop 应用"
  echo ""
  echo "  Linux:"
  echo "    1. 访问 https://docs.docker.com/engine/install/"
  echo "    2. 按照对应发行版的安装指南操作"
  echo ""
  exit 1
fi
echo "✅ Docker 命令已找到"
echo ""

# 2. 检查 Docker daemon 是否运行
echo "步骤 2/4: 检查 Docker 服务是否运行..."
if ! docker info >/dev/null 2>&1; then
  echo "❌ 错误：Docker 服务未运行"
  echo ""
  echo "请启动 Docker 服务："
  echo ""
  echo "  macOS:"
  echo "    1. 打开 Docker Desktop 应用"
  echo "    2. 等待 Docker 图标在菜单栏显示为运行状态"
  echo ""
  echo "  Linux:"
  echo "    运行: sudo systemctl start docker"
  echo "    或: sudo service docker start"
  echo ""
  exit 1
fi
echo "✅ Docker 服务正在运行"
echo ""

# 3. 检查容器是否存在并处理坏容器
echo "步骤 3/5: 检查 PostgreSQL 容器状态..."
CONTAINER_EXISTS=false
CONTAINER_RUNNING=false
CONTAINER_STATUS=""

# 检查容器是否存在（包括已停止的）
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
  CONTAINER_EXISTS=true
  CONTAINER_STATUS=$(docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Status}}" 2>/dev/null || echo "")
  echo "✅ 容器已存在: ${CONTAINER_NAME}"
  echo "   状态: ${CONTAINER_STATUS}"
  
  # 检查容器是否处于 Created 状态（可能端口绑定失败）
  if echo "$CONTAINER_STATUS" | grep -q "Created"; then
    echo "⚠️  检测到容器处于 Created 状态，检查是否端口绑定失败..."
    set +e
    ERROR_INFO=$(docker inspect "${CONTAINER_NAME}" --format '{{.State.Error}}' 2>/dev/null || echo "")
    set -e
    
    if echo "$ERROR_INFO" | grep -qi "port is already allocated\|bind.*address already in use"; then
      echo "❌ 容器端口绑定失败，正在删除并重建..."
      docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
      CONTAINER_EXISTS=false
      echo "✅ 已删除坏容器"
    else
      echo "ℹ️  容器状态异常，尝试启动..."
      if docker start "${CONTAINER_NAME}" >/dev/null 2>&1; then
        echo "✅ 容器已启动"
        CONTAINER_RUNNING=true
      else
        echo "❌ 启动失败，删除并重建..."
        docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        CONTAINER_EXISTS=false
      fi
    fi
  # 检查容器是否正在运行
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_RUNNING=true
    echo "✅ 容器正在运行"
    # 获取当前容器的端口映射
    SELECTED_PORT=$(docker port "${CONTAINER_NAME}" 5432/tcp 2>/dev/null | cut -d: -f1 || echo "5432")
  else
    echo "📦 容器已存在但未运行，正在启动..."
    if docker start "${CONTAINER_NAME}" >/dev/null 2>&1; then
      echo "✅ 容器已启动"
      CONTAINER_RUNNING=true
      # 获取当前容器的端口映射
      SELECTED_PORT=$(docker port "${CONTAINER_NAME}" 5432/tcp 2>/dev/null | cut -d: -f1 || echo "5432")
    else
      echo "❌ 错误：启动容器失败"
      echo ""
      echo "请检查容器状态："
      echo "  docker ps -a | grep ${CONTAINER_NAME}"
      echo ""
      echo "如果容器损坏，可以删除后重新创建："
      echo "  docker rm ${CONTAINER_NAME}"
      echo "  然后重新运行: pnpm db:up"
      echo ""
      exit 1
    fi
  fi
else
  echo "📦 容器不存在，准备创建新容器"
fi
echo ""

# 4. 端口自动选择（仅在需要创建容器时）
echo "步骤 4/5: 选择可用端口..."
if [ "$CONTAINER_EXISTS" = false ]; then
  # 端口可用性检测函数
  is_port_available() {
    local port=$1
    set +e
    
    # 优先使用 lsof
    if command -v lsof &> /dev/null; then
      if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
        set -e
        return 1  # 端口被占用
      fi
      set -e
      return 0  # 端口可用
    fi
    
    # 回退到 nc
    if command -v nc &> /dev/null; then
      if nc -z 127.0.0.1 "${port}" >/dev/null 2>&1; then
        set -e
        return 1  # 端口被占用
      fi
      set -e
      return 0  # 端口可用
    fi
    
    # 无法检测，假设可用（让 docker run 来验证）
    set -e
    return 0
  }
  
  # 尝试每个候选端口
  SELECTED_PORT=""
  for port in "${PORT_CANDIDATES[@]}"; do
    if is_port_available "$port"; then
      SELECTED_PORT="$port"
      echo "✅ 选择端口: ${SELECTED_PORT}"
      break
    else
      echo "⚠️  端口 ${port} 已被占用，尝试下一个..."
    fi
  done
  
  # 如果所有端口都被占用，使用第一个并让 docker run 报错
  if [ -z "$SELECTED_PORT" ]; then
    SELECTED_PORT="${PORT_CANDIDATES[0]}"
    echo "⚠️  无法检测端口可用性，使用默认端口 ${SELECTED_PORT}"
    echo "   如果创建失败，将自动尝试其他端口"
  fi
  echo ""
else
  # 容器已存在，使用当前端口
  if [ -z "$SELECTED_PORT" ]; then
    SELECTED_PORT="5432"
  fi
fi

# 5. 创建容器（如果需要）
echo "步骤 5/5: 确保容器就绪..."
if [ "$CONTAINER_EXISTS" = false ]; then
  echo "📦 创建新的 PostgreSQL 容器..."
  echo "   容器名称: ${CONTAINER_NAME}"
  echo "   端口映射: ${SELECTED_PORT}:5432"
  echo "   数据库用户: ${POSTGRES_USER}"
  echo "   数据库名称: ${POSTGRES_DB}"
  echo ""
  
  # 尝试创建容器（最多重试 5 次）
  MAX_RETRIES=5
  RETRY_COUNT=0
  CREATED=false
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$CREATED" = false ]; do
    set +e
    docker run -d \
      --name "${CONTAINER_NAME}" \
      -p "${SELECTED_PORT}:5432" \
      -e "POSTGRES_USER=${POSTGRES_USER}" \
      -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
      -e "POSTGRES_DB=${POSTGRES_DB}" \
      "${IMAGE}" >/dev/null 2>&1
    DOCKER_RUN_EXIT=$?
    set -e
    
    if [ $DOCKER_RUN_EXIT -eq 0 ]; then
      CREATED=true
      echo "✅ PostgreSQL 容器已创建并启动"
      CONTAINER_RUNNING=true
    else
      # 检查是否是端口冲突
      set +e
      ERROR_MSG=$(docker inspect "${CONTAINER_NAME}" --format '{{.State.Error}}' 2>/dev/null 2>&1 || echo "")
      set -e
      
      if echo "$ERROR_MSG" | grep -qi "port is already allocated\|bind.*address already in use"; then
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⚠️  端口 ${SELECTED_PORT} 绑定失败，尝试下一个端口..."
        
        # 删除失败的容器
        docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        
        # 选择下一个端口
        for port in "${PORT_CANDIDATES[@]}"; do
          if [ "$port" != "$SELECTED_PORT" ] && is_port_available "$port"; then
            SELECTED_PORT="$port"
            echo "   选择新端口: ${SELECTED_PORT}"
            break
          fi
        done
        
        # 如果所有端口都试过了，退出
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
          echo "❌ 错误：所有候选端口都不可用"
          echo ""
          echo "请手动检查端口占用："
          echo "  lsof -i :5432 -nP"
          echo "  docker ps | grep 5432"
          echo ""
          exit 1
        fi
      else
        echo "❌ 错误：创建容器失败"
        echo ""
        echo "可能的原因："
        echo "  1. Docker 资源不足"
        echo "  2. 网络问题（无法拉取镜像）"
        echo ""
        echo "请检查："
        echo "  docker ps -a | grep ${CONTAINER_NAME}"
        echo "  docker logs ${CONTAINER_NAME}"
        echo ""
        exit 1
      fi
    fi
  done
  
  # 创建成功后，自动更新 .env.local
  if [ "$CREATED" = true ]; then
    echo ""
    echo "📝 自动更新 .env.local 中的 DATABASE_URL 端口..."
    set +e
    node tools/env/set-database-url-port.js --port "${SELECTED_PORT}" >/dev/null 2>&1
    UPDATE_EXIT=$?
    set -e
    
    if [ $UPDATE_EXIT -eq 0 ]; then
      echo "✅ 已更新 .env.local"
    else
      echo "⚠️  警告：无法自动更新 .env.local"
      echo "   请手动将 DATABASE_URL 中的端口改为 ${SELECTED_PORT}"
    fi
  fi
fi
echo ""

if [ "$CONTAINER_RUNNING" = true ]; then
  # 获取实际使用的端口
  if [ -z "$SELECTED_PORT" ]; then
    PORT_MAPPING=$(docker port "${CONTAINER_NAME}" 5432/tcp 2>/dev/null || echo "")
    if [ -n "$PORT_MAPPING" ]; then
      # 提取端口号（格式：0.0.0.0:5433 或 [::]:5433）
      SELECTED_PORT=$(echo "$PORT_MAPPING" | grep -oE ':[0-9]+' | head -1 | cut -d: -f2 || echo "5432")
    else
      SELECTED_PORT="5432"
    fi
  fi
  
  echo ""
  echo "=========================================="
  echo "✅ PostgreSQL 容器已就绪"
  echo "=========================================="
  echo ""
  echo "容器信息："
  docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "连接信息："
  echo "  容器名称: ${CONTAINER_NAME}"
  echo "  宿主端口: ${SELECTED_PORT}"
  echo "  数据库: ${POSTGRES_DB}"
  echo "  用户: ${POSTGRES_USER}"
  echo ""
  echo "建议的 DATABASE_URL："
  echo "  postgresql://${POSTGRES_USER}:***@localhost:${SELECTED_PORT}/${POSTGRES_DB}?schema=public"
  echo ""
  echo "下一步：运行 pnpm db:init 初始化数据库"
  echo "=========================================="
else
  echo "❌ 错误：容器未运行"
  exit 1
fi

