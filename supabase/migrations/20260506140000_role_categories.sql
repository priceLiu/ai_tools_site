-- 首页「按角色」：角色分类（与场景 tag_categories 平级，独立表）+ 角色↔标签多对多

CREATE TABLE IF NOT EXISTS public.role_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  icon        text,
  sort_order  int NOT NULL DEFAULT 0,
  tagline     text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_disabled boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_categories_sort_order_idx
  ON public.role_categories (sort_order);

COMMENT ON TABLE public.role_categories IS
  '首页「按角色」入口与 /role/[slug]；可禁用、可绑定多个标签（role_category_tags），工具集 = 至少命中其一标签的已审核工具。';

CREATE TABLE IF NOT EXISTS public.role_category_tags (
  role_category_id uuid NOT NULL REFERENCES public.role_categories(id) ON DELETE CASCADE,
  tag_id           uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  sort_order       int NOT NULL DEFAULT 0,
  PRIMARY KEY (role_category_id, tag_id)
);

CREATE INDEX IF NOT EXISTS role_category_tags_tag_id_idx
  ON public.role_category_tags (tag_id);

ALTER TABLE public.role_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_category_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_categories_select_all" ON public.role_categories;
CREATE POLICY "role_categories_select_all"
  ON public.role_categories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "role_category_tags_select_all" ON public.role_category_tags;
CREATE POLICY "role_category_tags_select_all"
  ON public.role_category_tags FOR SELECT
  TO anon, authenticated
  USING (true);
