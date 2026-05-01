-- 首页侧栏多级菜单（可折叠子项）；由管理后台 CRUD + RLS

CREATE TABLE IF NOT EXISTS public.navigation_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.navigation_menu_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  href text NOT NULL DEFAULT '#',
  icon_name text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_menu_items_parent_sort_idx
  ON public.navigation_menu_items (parent_id, sort_order);

ALTER TABLE public.navigation_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigation_menu_items_public_read" ON public.navigation_menu_items;
CREATE POLICY "navigation_menu_items_public_read"
  ON public.navigation_menu_items FOR SELECT TO anon, authenticated
  USING (is_visible = true);

DROP POLICY IF EXISTS "navigation_menu_items_admin_access" ON public.navigation_menu_items;
CREATE POLICY "navigation_menu_items_admin_access"
  ON public.navigation_menu_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- 首页锚点
INSERT INTO public.navigation_menu_items (label, href, icon_name, sort_order, parent_id)
VALUES
  ('热门工具', '#home-hot', 'Flame', 0, NULL),
  ('最新收录', '#home-latest', 'Clock', 1, NULL);

-- 与 categories 表同步一层分类入口（可在后台为任意项添加子菜单）
INSERT INTO public.navigation_menu_items (label, href, icon_name, sort_order, parent_id)
SELECT
  c.name,
  '/category/' || c.slug,
  COALESCE(NULLIF(trim(c.icon), ''), 'Sparkles'),
  c.sort_order + 100,
  NULL
FROM public.categories c
WHERE c.slug IS DISTINCT FROM 'hot';
