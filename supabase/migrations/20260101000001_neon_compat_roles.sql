-- 纯 PostgreSQL（Neon）默认没有 Supabase 的 anon / authenticated 角色；
-- 带 TO authenticated / anon 的 RLS 迁移会报错。此处提供空角色占位（NOLOGIN），
-- 策略在后续迁移中可顺利创建；Neon 应用走服务端直连，不依赖这些策略。
-- 若你只在 Supabase 上跑迁移，此文件无害（IF NOT EXISTS）。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;
