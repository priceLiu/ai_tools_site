-- 场景分类：支持后台「禁用」（前台首页 / SEO / sitemap / 公有路由不曝光该分类本体页）

ALTER TABLE public.tag_categories
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tag_categories.is_disabled IS
  '禁用后前台不展示「按场景找 AI」卡片与 /tag-category/[slug]；归属标签仍存在，可作后续迁移。';

