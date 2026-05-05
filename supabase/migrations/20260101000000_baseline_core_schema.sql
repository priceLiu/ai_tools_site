-- 全新空库基准：在 **任何** 业务迁移之前执行（文件名时间戳最小）。
-- 适用于从 Supabase 时代起未纳入仓库的「初始表」：profiles / categories / tools / favorites。
-- Neon 纯 PG 项目：后续迁移会补 auth_credentials、app_kv、评论、标签等。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles（应用注册时由 Neon 写入 id，与 auth_credentials.user_id 一致）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  is_disabled boolean NOT NULL DEFAULT false,
  disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.profiles.disabled_reason IS
  '管理员禁用账号时填写的原因；解除禁用时清空';

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx
  ON public.categories (parent_id);

-- ---------------------------------------------------------------------------
-- tools
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  logo_url text,
  screenshot_url text,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  is_featured boolean NOT NULL DEFAULT false,
  is_disabled boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  favorite_count integer NOT NULL DEFAULT 0,
  introduction text,
  introduction_format text NOT NULL DEFAULT 'markdown',
  use_cases text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tools_slug_key UNIQUE (slug),
  CONSTRAINT tools_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT tools_introduction_format_check CHECK (
    introduction_format IN ('plain', 'markdown', 'html')
  )
);

CREATE INDEX IF NOT EXISTS idx_tools_category ON public.tools (category_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON public.tools (status);
CREATE INDEX IF NOT EXISTS idx_tools_featured
  ON public.tools (is_featured)
  WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS tools_approved_not_disabled_idx
  ON public.tools (status, is_disabled)
  WHERE status = 'approved' AND is_disabled = false;

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_user_id_tool_id_key UNIQUE (user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_tool ON public.favorites (tool_id);

-- ---------------------------------------------------------------------------
-- Neon 应用不走 PostgREST：关闭 RLS，权限在 Next 应用层校验
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;
