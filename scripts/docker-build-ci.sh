#!/usr/bin/env sh
# CI / 本地自动构建：将 DATABASE_URL（或 BUILD_DATABASE_URL）作为 Docker build-arg 传入，
# 使 next build 阶段可执行 generateStaticParams 预渲染工具等路由。
#
# 用法：
#   export DATABASE_URL='postgresql://...'
#   ./scripts/docker-build-ci.sh -t my-registry/ai-tools:tag
#
# 亦可：
#   export BUILD_DATABASE_URL='postgresql://...'
#   ./scripts/docker-build-ci.sh
#
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_TAG="ai-tools:ci"

usage() {
  echo "用法: $0 [-t 镜像名:标签]" >&2
  echo "需要环境变量 DATABASE_URL 或 BUILD_DATABASE_URL（指向构建机可访问的 PostgreSQL）。" >&2
}

while getopts 't:h' opt; do
  case "$opt" in
    t) IMAGE_TAG="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

DB="${DATABASE_URL:-${BUILD_DATABASE_URL:-}}"
if [ -z "$DB" ]; then
  echo "docker-build-ci.sh: 未设置 DATABASE_URL 或 BUILD_DATABASE_URL" >&2
  usage
  exit 1
fi

exec docker build \
  --build-arg "DATABASE_URL=$DB" \
  -t "$IMAGE_TAG" \
  "$ROOT"
