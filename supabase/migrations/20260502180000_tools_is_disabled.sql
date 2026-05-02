-- 已通过工具可被管理员禁用；禁用后前台不展示

ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tools.is_disabled IS '管理员禁用后，前台列表与详情均不展示（仍为 approved）';

CREATE INDEX IF NOT EXISTS tools_approved_not_disabled_idx
  ON public.tools (status, is_disabled)
  WHERE status = 'approved' AND is_disabled = false;
