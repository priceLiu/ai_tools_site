-- 用户请求撤销公开发布（通知管理员处理）

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_revoke_requested_at timestamptz;

COMMENT ON COLUMN public.profiles.showcase_revoke_requested_at IS
  '用户点击「通知撤销」的时间；管理员下架或重新审核后应清空';
