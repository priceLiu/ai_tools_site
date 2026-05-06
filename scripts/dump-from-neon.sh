#!/usr/bin/env bash
# 从 Neon 导出全库（schema + data + functions + indexes + RLS policies）。
#
# 用法（项目根）：
#   NEON_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
#     bash scripts/dump-from-neon.sh
#
# 也可以从 .env.local 自动读取 DATABASE_URL：
#   bash scripts/dump-from-neon.sh
#
# 产出：
#   dumps/neon-dump.pgcustom   自定义格式（给 pg_restore 用，体积小、可并行）
#   dumps/neon-dump.sql        纯 SQL 备份（人工核对 / 应急）
#   dumps/neon-stats.txt       表行数 / 函数清单 / 扩展清单
#
# 依赖：本机需有 pg_dump / psql；macOS 推荐 `brew install libpq && brew link --force libpq`
#       已经 `brew install postgresql@16` 也可。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/dumps"

# --- 解析 DATABASE_URL：优先环境变量，其次 .env.local ---
DB_URL="${NEON_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" && -f "$ROOT/.env.local" ]]; then
  DB_URL="$(awk -F'=' '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*DATABASE_URL[[:space:]]*=/ {
      val = $0; sub(/^[^=]*=[[:space:]]*/, "", val);
      gsub(/^"|"$|^'\''|'\''$/, "", val);
      print val; exit
    }' "$ROOT/.env.local")"
fi
if [[ -z "$DB_URL" ]]; then
  echo "请设置 NEON_DATABASE_URL 或在 .env.local 配置 DATABASE_URL" >&2
  exit 1
fi

# --- 检查 pg_dump 是否可用 ---
if ! command -v pg_dump >/dev/null 2>&1; then
  cat >&2 <<'EOF'
未找到 pg_dump 命令。

macOS 安装方法：
  方式 1（推荐，最小依赖）：
    brew install libpq
    brew link --force libpq
  方式 2：
    brew install postgresql@16

安装完重开终端，运行 `pg_dump --version` 确认。
EOF
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "未找到 psql 命令。安装方式同 pg_dump（包含在 libpq / postgresql@16 中）。" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

echo "=== Neon → dump"
echo "    URL: $(echo "$DB_URL" | sed -E 's|(://[^:]+):[^@]+@|\1:****@|')"
echo "    输出: $OUT_DIR"

# --- 1. 自定义格式（给 pg_restore；体积最小、并行恢复） ---
echo "=== [1/3] pg_dump (custom format)..."
pg_dump \
  --no-owner \
  --no-privileges \
  --no-acl \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$OUT_DIR/neon-dump.pgcustom" \
  "$DB_URL" 2> "$OUT_DIR/dump.log" || {
    echo "pg_dump (custom) 失败，详情:" >&2
    tail -50 "$OUT_DIR/dump.log" >&2
    exit 3
  }
echo "    OK: $(du -h "$OUT_DIR/neon-dump.pgcustom" | cut -f1)"

# --- 2. 纯 SQL 备份（人工核对 / 应急） ---
echo "=== [2/3] pg_dump (plain SQL)..."
pg_dump \
  --no-owner \
  --no-privileges \
  --no-acl \
  --format=plain \
  --file="$OUT_DIR/neon-dump.sql" \
  "$DB_URL" 2>> "$OUT_DIR/dump.log" || {
    echo "pg_dump (plain) 失败，详情:" >&2
    tail -50 "$OUT_DIR/dump.log" >&2
    exit 3
  }
echo "    OK: $(du -h "$OUT_DIR/neon-dump.sql" | cut -f1)"

# --- 3. 统计：表行数、函数清单、扩展清单 ---
echo "=== [3/3] 统计源端数据..."
{
  echo "# Neon dump 统计 ($(date '+%F %T'))"
  echo
  echo "## 1. public schema 表行数"
  psql "$DB_URL" -At -F $'\t' -c "
    SELECT relname, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC, relname;
  " | column -t
  echo
  echo "## 2. public schema 函数清单"
  psql "$DB_URL" -At -c "
    SELECT proname || '(' || pg_get_function_identity_arguments(oid) || ')'
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
    ORDER BY proname;
  "
  echo
  echo "## 3. auth schema 函数清单（桩函数）"
  psql "$DB_URL" -At -c "
    SELECT proname || '(' || pg_get_function_identity_arguments(oid) || ')'
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    ORDER BY proname;
  " 2>/dev/null || echo "    (无 auth schema)"
  echo
  echo "## 4. 已安装扩展"
  psql "$DB_URL" -At -F $'\t' -c "
    SELECT extname, extversion FROM pg_extension ORDER BY extname;
  " | column -t
  echo
  echo "## 5. RLS 策略数（按表）"
  psql "$DB_URL" -At -F $'\t' -c "
    SELECT schemaname || '.' || tablename, count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY 1
    ORDER BY 1;
  " | column -t
} > "$OUT_DIR/neon-stats.txt" 2>&1
cat "$OUT_DIR/neon-stats.txt"

echo
echo "=== 完成。下一步："
echo "    TENCENT_DATABASE_URL=\"...\" bash scripts/restore-to-tencent.sh"
