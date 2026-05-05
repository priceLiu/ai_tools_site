-- 评论 moderation：前台隐藏单条评论；归因用户（发表评论时写入）。
-- profiles：评论禁言（仍可使用站点其它功能，仅禁止发表评论）。

ALTER TABLE public.tool_comments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.tool_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tool_comments_tool_hidden_created
  ON public.tool_comments (tool_id, is_hidden, created_at DESC);

COMMENT ON COLUMN public.tool_comments.user_id IS '发表评论的登录用户；历史数据可为空';
COMMENT ON COLUMN public.tool_comments.is_hidden IS 'true 时前台不展示，管理后台仍可检索';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comment_muted boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comment_mute_reason text;

COMMENT ON COLUMN public.profiles.comment_muted IS 'true 时禁止发表评论';
COMMENT ON COLUMN public.profiles.comment_mute_reason IS '管理员禁言可选说明；解除时可清空';
