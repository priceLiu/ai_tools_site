-- 工具 ↔ 左侧产品线 categories 多对多；前台 /category 列表按 tool_categories 聚合。
-- tools.category_id 保留为「主分类 / 卡片展示」外键，写入路径应同步至少一条 junction（见应用层）。

CREATE TABLE IF NOT EXISTS public.tool_categories (
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (tool_id, category_id)
);

CREATE INDEX IF NOT EXISTS tool_categories_category_id_idx
  ON public.tool_categories (category_id);

COMMENT ON TABLE public.tool_categories IS
  '工具可挂载多个菜单产品线分类；/category/[slug] Subtree 列表由此 JOIN，可与 tools.category_id（主分类）并存。';

INSERT INTO public.tool_categories (tool_id, category_id, sort_order)
SELECT id, category_id, 0
FROM public.tools
WHERE category_id IS NOT NULL
ON CONFLICT (tool_id, category_id) DO NOTHING;

ALTER TABLE public.tool_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_categories_select_all" ON public.tool_categories;
CREATE POLICY "tool_categories_select_all"
  ON public.tool_categories FOR SELECT
  TO anon, authenticated
  USING (true);
