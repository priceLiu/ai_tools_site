-- 个人中心「主页门户」与「AI 方案集」公开发布申请
-- RLS：profiles 沿用仓库既有策略；应用层 Neon Server Actions 写权限。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_home_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_disabled_by_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_section_config jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_theme text NOT NULL DEFAULT 'default';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_slug text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_title text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_summary text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_requested_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_reviewed_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_rejection_reason text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_showcase_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_showcase_status_check CHECK (
    showcase_status IN ('none', 'pending', 'approved', 'rejected')
  );

COMMENT ON COLUMN public.profiles.portal_home_enabled IS
  '用户是否启用个人主页（/account/home）；关闭则进入个人信息页为主入口';

COMMENT ON COLUMN public.profiles.portal_disabled_by_admin IS
  '管理员关闭用户门户能力：强制走个人信息页，且不提供主页导航';

COMMENT ON COLUMN public.profiles.portal_section_config IS
  '首页板块顺序与显隐 JSON：[{ "id","visible","order" }, …]，null 表示默认';

COMMENT ON COLUMN public.profiles.portal_theme IS
  '门户视觉模板标识（default/minimal/dense），仅换样式不改数据结构';

COMMENT ON COLUMN public.profiles.showcase_slug IS
  '已通过审核的公开发布 slug（唯一），列表页与详情 URL';

COMMENT ON COLUMN public.profiles.showcase_status IS
  '公开发布状态：none / pending / approved / rejected';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_showcase_slug_key
  ON public.profiles (showcase_slug)
  WHERE showcase_slug IS NOT NULL AND trim(showcase_slug) <> '';
