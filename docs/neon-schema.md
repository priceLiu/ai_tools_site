# Neon / 新库 Schema 与一键迁移

## `docs/code_20260505.sql` 审查结论

| 问题 | 说明 |
|------|------|
| 不完整 | 只有索引、部分函数与触发器、RLS 指令，没有核心业务表的 `CREATE TABLE`。 |
| 与现架构冲突 | `profiles_guard_flags`、`is_admin_user()` 会阻止在控制台改 `is_admin`；项目已用 `20260504160000_drop_supabase_rls_deps.sql` 移除。 |
| Supabase 残留 | `handle_new_user()` 依赖 Supabase `auth.users`；当前注册逻辑在应用内写 `profiles` + `auth_credentials`。 |

该文件已改为占位说明，**不要**再把旧全文贴进 Neon 执行。

## 一键建库（推荐）

前提：安装 `psql`，并设好连接串（建议 Pooler + `sslmode=require`）。

```bash
export DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require'
bash scripts/apply-neon-migrations.sh
```

- 脚本会按文件名**字典序**执行 `supabase/migrations/*.sql`。
- **纯 Neon** 默认 `NEON_SKIP_STORAGE=1`，跳过：
  - `20260502200000_storage_tool_uploads.sql`
  - `20260502270000_site_public_cache_bucket.sql`  
  （依赖 `storage.buckets`，Neon 无 Supabase Storage。）
- 若在 Supabase 上建库且已有 `storage` schema：`NEON_SKIP_STORAGE=0 bash scripts/apply-neon-migrations.sh`

## 新增/调整的「换库」友好迁移（2026-05 起）

| 文件 | 作用 |
|------|------|
| `20260101000000_baseline_core_schema.sql` | 空库基准：`profiles`、`categories`、`tools`、`favorites` 及核心索引；`tools.user_id` 已为 `ON DELETE SET NULL`。 |
| `20260101000001_neon_compat_roles.sql` | 创建占位角色 `anon`、`authenticated`，避免 `TO authenticated` 策略在纯 PG 中报错。 |
| `20260101000002_neon_auth_uid_stub.sql` | `auth.uid()` 桩函数（恒 `NULL`），仅让旧 RLS 迁移能通过语法；权限以应用为准。 |
| `20260504160000_drop_supabase_rls_deps.sql`（已加强） | 先删依赖 `is_admin_user()` 的策略，再删触发器/函数，并重写 `set_tool_tags_for_tool` 去掉 `auth.uid`/`is_admin_user`。 |
| `20260504180000_profiles_disabled_reason.sql` | `profiles.disabled_reason`（若基准已含列则为 no-op）。 |
| `20260505010000_tools_user_id_set_null.sql` | 确保 `tools.user_id` 可空且 FK 为 `ON DELETE SET NULL`（与基准一致时仍幂等）。 |

## 迁移完成后必做

1. 在 Neon 将至少一个账号设为管理员，例如：
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE id = '<你的 user uuid>';
   ```
2. 部署应用环境变量：`DATABASE_URL`、`AUTH_SECRET` 等（见 `deploy.md`）。

## 已有生产库（从 Supabase dump 迁出）

若表已存在，**不要**重复跑基准里的 `CREATE TABLE IF NOT EXISTS` 以外的危险操作；通常只需按时间补**从未执行过**的迁移文件，或用 `ALTER ... IF NOT EXISTS` 类迁移。
