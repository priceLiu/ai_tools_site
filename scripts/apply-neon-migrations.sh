#!/usr/bin/env bash
# 按文件名排序依次执行 supabase/migrations/*.sql，用于 **全新 Neon 空库** 或 CI。
#
# 用法:
#   export DATABASE_URL='postgresql://...?sslmode=require'
#   ./scripts/apply-neon-migrations.sh
#
# 纯 Neon（无 Supabase Storage）时默认跳过写入 storage.buckets 的迁移（否则会报错）。
# 若你在 Supabase 上建库并已有 storage schema，可关闭跳过：
#   NEON_SKIP_STORAGE=0 ./scripts/apply-neon-migrations.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "请设置 DATABASE_URL（Neon 连接串）" >&2
  exit 1
fi

NEON_SKIP_STORAGE="${NEON_SKIP_STORAGE:-1}"

skip_file() {
  local base="$1"
  case "$base" in
    20260502200000_storage_tool_uploads.sql|20260502270000_site_public_cache_bucket.sql)
      if [[ "$NEON_SKIP_STORAGE" == "1" ]]; then
        return 0
      fi
      ;;
  esac
  return 1
}

listfile="$(mktemp)"
trap 'rm -f "$listfile"' EXIT
(
  for f in "$MIGRATIONS"/*.sql; do
    [[ -f "$f" ]] && printf '%s\n' "$f"
  done
) | LC_ALL=C sort > "$listfile"

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  base="$(basename "$f")"
  if skip_file "$base"; then
    echo "=== SKIP (NEON_SKIP_STORAGE=1): $base"
    continue
  fi
  echo "=== $base"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done < "$listfile"

echo "=== 全部迁移已执行完毕"
