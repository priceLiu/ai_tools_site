-- 管理员禁用账号时记录原因；解除禁用时由应用清空
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_reason text;

COMMENT ON COLUMN public.profiles.disabled_reason IS '管理员禁用账号时填写的原因；解除禁用时清空';
