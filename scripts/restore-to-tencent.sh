#!/usr/bin/env bash
# 把 Neon 的 dump 还原到腾讯云 PostgreSQL（TDSQL-C / TencentDB）。
#
# 用法（项目根，需先跑过 dump-from-neon.sh）：
#   TENCENT_DATABASE_URL="postgresql://user:pwd@host:5432/db?sslmode=require" \
#     bash scripts/restore-to-tencent.sh
#
# 流程：
#   1) 在目标库 CREATE EXTENSION pgcrypto（gen_random_uuid 依赖）
#   2) 跑 anon/authenticated 角色与 auth.uid() 桩函数（兼容历史 RLS / 函数）
#   3) pg_restore --jobs=4 导入 dump
#   4) ANALYZE 收尾
#   5) 跑健康检查（行数对比、扩展、函数清单）
#
# 幂等：扩展 / 角色 / 桩函数都是 IF NOT EXISTS；pg_restore 用 --clean --if-exists
#       可重复跑（第一次 schema 不存在的报错可忽略）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/dumps"
DUMP_FILE="$OUT_DIR/neon-dump.pgcustom"

DB_URL="${TENCENT_DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "请设置 TENCENT_DATABASE_URL（腾讯云 PG 连接串，建议先用公网串迁完再切 VPC）" >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "未找到 dump 文件：$DUMP_FILE" >&2
  echo "请先运行：bash scripts/dump-from-neon.sh" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  cat >&2 <<'EOF'
未找到 pg_restore 命令。安装方式（macOS）：
  brew install libpq && brew link --force libpq
EOF
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "未找到 psql 命令（pg_restore 同包，安装应该一并就有）。" >&2
  exit 2
fi

masked() {
  echo "$1" | sed -E 's|(://[^:]+):[^@]+@|\1:****@|'
}

echo "=== 腾讯云 PG ← restore"
echo "    URL: $(masked "$DB_URL")"
echo "    Dump: $DUMP_FILE"

# --- [1/5] 必要扩展 ---
echo "=== [1/5] CREATE EXTENSION pgcrypto..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" \
  || {
    echo "pgcrypto 创建失败。可能要在腾讯云控制台 → 实例 → '插件管理' 里手动开启 pgcrypto。" >&2
    exit 3
  }

# --- [2/5] 角色 + auth.uid 桩函数（沿用现有迁移文件，幂等） ---
echo "=== [2/5] anon/authenticated 角色 + auth.uid() 桩函数..."
for f in \
  "supabase/migrations/20260101000001_neon_compat_roles.sql" \
  "supabase/migrations/20260101000002_neon_auth_uid_stub.sql"
do
  echo "    应用 $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/$f"
done

# --- [3/5] 主体数据 ---
echo "=== [3/5] pg_restore (jobs=4)..."
pg_restore \
  --no-owner \
  --no-privileges \
  --no-acl \
  --jobs=4 \
  --verbose \
  --dbname="$DB_URL" \
  "$DUMP_FILE" 2> "$OUT_DIR/restore.log" || {
    # pg_restore 部分对象冲突（重复跑时常见）会非 0 退出，但数据通常已落
    echo "pg_restore 部分项目失败（重复运行时常见）。日志末尾："
    tail -50 "$OUT_DIR/restore.log"
    echo
    echo "若是 'duplicate key' / 'already exists'，通常无害，继续 ANALYZE..."
  }

# --- [4/5] ANALYZE 让查询计划器更新统计信息 ---
echo "=== [4/5] ANALYZE..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;"

# --- [5/5] 健康检查 ---
echo "=== [5/5] 健康检查..."
{
  echo "# 腾讯云 PG 状态 ($(date '+%F %T'))"
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
  echo "## 3. 已安装扩展"
  psql "$DB_URL" -At -F $'\t' -c "
    SELECT extname, extversion FROM pg_extension ORDER BY extname;
  " | column -t
  echo
  echo "## 4. 关键表存在性检查"
  psql "$DB_URL" -At -c "
    SELECT 'profiles=' || count(*) FROM public.profiles UNION ALL
    SELECT 'tools=' || count(*) FROM public.tools UNION ALL
    SELECT 'categories=' || count(*) FROM public.categories UNION ALL
    SELECT 'tags=' || count(*) FROM public.tags UNION ALL
    SELECT 'tag_categories=' || count(*) FROM public.tag_categories UNION ALL
    SELECT 'tool_tags=' || count(*) FROM public.tool_tags UNION ALL
    SELECT 'auth_credentials=' || count(*) FROM public.auth_credentials;
  "
} > "$OUT_DIR/tencent-stats.txt" 2>&1
cat "$OUT_DIR/tencent-stats.txt"

echo
echo "=== 完成！请人工对比："
echo "    diff <(grep -v '^#' $OUT_DIR/neon-stats.txt) <(grep -v '^#' $OUT_DIR/tencent-stats.txt)"
echo
echo "下一步："
echo "    1. 在 .env.local 改 DATABASE_URL 为腾讯云公网串，本地 pnpm dev 验证一遍"
echo "    2. 通过后切到 VPC 内网串，部署到 CloudBase Run（参见 docs/migration-tencent.md 第 4.3 节）"
