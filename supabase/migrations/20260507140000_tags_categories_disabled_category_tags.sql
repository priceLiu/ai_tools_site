-- 标签禁用 + 左侧产品线 categories 禁用 + category_tags（菜单分类 ↔ 标签，运营联结）

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tags.is_disabled IS
  '禁用后前台不展示该标签（聚合页 / chip / 工具卡片标签栏）；tool_tags 行保留，后台可见并可重新启用。';

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.is_disabled IS
  '禁用后前台分类页与导航指向该 slug 的入口隐藏；工具仍可挂在 category_id 上，展示时不带出分类名片（JOIN 过滤）。';

CREATE TABLE IF NOT EXISTS public.category_tags (
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, tag_id)
);

CREATE INDEX IF NOT EXISTS category_tags_tag_id_idx ON public.category_tags (tag_id);

COMMENT ON TABLE public.category_tags IS
  '左侧菜单产品线 categories 与标签库的松散联结（可与 tags.tag_category_id 并存）；不负责工具归属（仍为 tools.category_id）。';

ALTER TABLE public.category_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_tags_select_all" ON public.category_tags;
CREATE POLICY "category_tags_select_all"
  ON public.category_tags FOR SELECT
  TO anon, authenticated
  USING (true);
