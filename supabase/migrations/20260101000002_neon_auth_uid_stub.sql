-- 历史迁移中的 RLS 会写 auth.uid()；Supabase 才有真实实现。纯 Neon 先提供桩函数，使迁移能通过。
-- 返回值恒为 NULL（无 PostgREST 会话）。依赖「本人 id」的策略在启用 RLS 的表上可能较严；
-- profiles / navigation 等后续在业务迁移中会调整或关闭 RLS（见 drop_supabase_rls_deps）。

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULL::uuid
$$;

COMMENT ON FUNCTION auth.uid() IS 'Neon 占位：无 JWT 时恒为 NULL；新库请依赖应用层鉴权';
