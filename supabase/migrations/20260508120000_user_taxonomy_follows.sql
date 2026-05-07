-- 个人中心「我的关注」：订阅场景分类 / 角色分类（与工具收藏 favorites 独立）

CREATE TABLE IF NOT EXISTS public.user_follow_tag_categories (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tag_category_id uuid NOT NULL REFERENCES public.tag_categories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_tag_categories_user
  ON public.user_follow_tag_categories (user_id);

CREATE TABLE IF NOT EXISTS public.user_follow_role_categories (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_category_id uuid NOT NULL REFERENCES public.role_categories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_role_categories_user
  ON public.user_follow_role_categories (user_id);

COMMENT ON TABLE public.user_follow_tag_categories IS
  '用户订阅的场景分类（tag_categories）；平台禁用后仍可保留行以便「失效」提示与取消关注。';

COMMENT ON TABLE public.user_follow_role_categories IS
  '用户订阅的角色分类（role_categories）；同上。';

-- Neon 应用层校验登录用户；与 favorites 一致
ALTER TABLE public.user_follow_tag_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follow_role_categories DISABLE ROW LEVEL SECURITY;
