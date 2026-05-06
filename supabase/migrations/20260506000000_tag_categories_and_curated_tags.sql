-- 标签管理系统改造（schema）
-- 1) 新增 tag_categories 表（场景一级分类，与 categories 解耦）
-- 2) tags 加列：tag_category_id / is_curated / aliases
-- 3) 放宽 tool_tags.sort_order 上限到 19（即单工具最多 20 个标签）
-- 4) 同步 set_tool_tags_for_tool 函数：EXIT WHEN i >= 20

-- Phase: tags-import-and-scenarios

-- =========================================================
-- 0) Neon 兼容：保证 anon / authenticated 角色存在
--    （Supabase 默认有；纯 Neon 库可能没有；与 20260101000001_neon_compat_roles.sql 等价）
-- =========================================================
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

-- =========================================================
-- 1) tag_categories
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tag_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  icon        text,
  sort_order  int NOT NULL DEFAULT 0,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tag_categories_sort_order_idx
  ON public.tag_categories (sort_order);

ALTER TABLE public.tag_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_categories_select_all" ON public.tag_categories;
CREATE POLICY "tag_categories_select_all"
  ON public.tag_categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- =========================================================
-- 2) tags 加列
-- =========================================================
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS tag_category_id uuid
    REFERENCES public.tag_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_curated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aliases   text[]  NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS tags_tag_category_id_idx
  ON public.tags (tag_category_id);
CREATE INDEX IF NOT EXISTS tags_is_curated_idx
  ON public.tags (is_curated);

-- =========================================================
-- 3) tool_tags.sort_order 放宽到 0..19（最多 20 个标签）
-- =========================================================
ALTER TABLE public.tool_tags
  DROP CONSTRAINT IF EXISTS tool_tags_sort_order_range;
ALTER TABLE public.tool_tags
  ADD CONSTRAINT tool_tags_sort_order_range
  CHECK (sort_order >= 0 AND sort_order <= 19);

-- =========================================================
-- 4) set_tool_tags_for_tool 上限同步到 20
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_tool_tags_for_tool(p_tool_id uuid, p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int := 0;
  n text;
  vid uuid;
  seen uuid[] := '{}';
BEGIN
  IF p_tool_id IS NULL THEN
    RAISE EXCEPTION 'invalid tool id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tools t
    WHERE t.id = p_tool_id
      AND (
        t.user_id = auth.uid()
        OR public.is_admin_user()
      )
  ) THEN
    RAISE EXCEPTION 'not allowed to set tags for this tool';
  END IF;

  DELETE FROM public.tool_tags WHERE tool_id = p_tool_id;

  IF p_names IS NULL OR cardinality(p_names) = 0 THEN
    RETURN;
  END IF;

  FOREACH n IN ARRAY p_names
  LOOP
    EXIT WHEN i >= 20;
    n := trim(n);
    CONTINUE WHEN n = '';
    vid := public.upsert_tag_by_display_name(n);
    CONTINUE WHEN vid IS NULL;
    IF vid = ANY (seen) THEN
      CONTINUE;
    END IF;
    seen := array_append(seen, vid);
    INSERT INTO public.tool_tags (tool_id, tag_id, sort_order)
    VALUES (p_tool_id, vid, i);
    i := i + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tool_tags_for_tool(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tool_tags_for_tool(uuid, text[]) TO authenticated;
